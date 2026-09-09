// POST /api/buyer/sourcing-requests/[id]/candidatures/[candidatureId]/accept
// — the buyer accepts one PENDING candidature (Phase 3). In a single
// transaction: SourcingRequest -> IN_PROGRESS (+selectedCandidatureId),
// the chosen Candidature -> ACCEPTED, every other still-PENDING
// candidature on this request -> REJECTED, a Mission is created (status
// defaults to RECU, seeded with one MissionStatusEvent for an audit trail
// from the start — Phase 4 builds the rest of the pipeline on top of this),
// and a BUYER_AGENT Conversation is created for the two participants
// (Phase 5 wires the actual messaging UI on top of this row). Notifications
// are sent best-effort, after commit — never inside the transaction.
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireMarketplaceRole } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { createNotification } from '@/lib/server/notifications';
import { candidatureAccepted, candidatureRejected } from '@/lib/server/notifications/templates';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const Body = z.object({ agreedCommissionAmount: z.number().int().positive().optional() });

type Discriminator =
  | { kind: 'REQUEST_NOT_FOUND' }
  | { kind: 'REQUEST_NOT_OPEN' }
  | { kind: 'CANDIDATURE_NOT_FOUND' }
  | { kind: 'CANDIDATURE_NOT_PENDING' }
  | { kind: 'COMMISSION_REQUIRED' }
  | {
      kind: 'OK';
      requestTitle: string;
      mission: { id: string; status: string };
      conversationId: string;
      acceptedCandidatureId: string;
      acceptedAgentUserId: string;
      rejected: { candidatureId: string; agentUserId: string }[];
    };

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; candidatureId: string }> },
): Promise<NextResponse> {
  const reqCtx = makeRequestContext(req.headers);
  return withRequestContext(reqCtx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireMarketplaceRole('BUYER');
    if (auth instanceof NextResponse) return auth;

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'VALIDATION_FAILED' }, { status: 400 });
    }

    const { id, candidatureId } = await ctx.params;

    const result: Discriminator = await prisma.$transaction(async (tx) => {
      const request = await tx.sourcingRequest.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          buyerId: true,
          status: true,
          product: { select: { wholesalerProfileId: true } },
        },
      });
      if (!request || request.buyerId !== auth.user.sub) {
        return { kind: 'REQUEST_NOT_FOUND' as const };
      }
      if (request.status !== 'OPEN') {
        return { kind: 'REQUEST_NOT_OPEN' as const };
      }

      const candidature = await tx.candidature.findUnique({
        where: { id: candidatureId },
        select: {
          id: true,
          sourcingRequestId: true,
          agentProfileId: true,
          proposedCommissionAmount: true,
          currency: true,
          status: true,
          fulfillmentType: true,
          agentProfile: { select: { userId: true } },
        },
      });
      if (!candidature || candidature.sourcingRequestId !== id) {
        return { kind: 'CANDIDATURE_NOT_FOUND' as const };
      }
      if (candidature.status !== 'PENDING') {
        return { kind: 'CANDIDATURE_NOT_PENDING' as const };
      }

      const agreedCommissionAmount =
        parsed.data.agreedCommissionAmount ?? candidature.proposedCommissionAmount;
      if (agreedCommissionAmount == null) {
        return { kind: 'COMMISSION_REQUIRED' as const };
      }

      await tx.sourcingRequest.update({
        where: { id },
        data: { status: 'IN_PROGRESS', selectedCandidatureId: candidature.id },
      });
      await tx.candidature.update({
        where: { id: candidature.id },
        data: { status: 'ACCEPTED' },
      });

      const others = await tx.candidature.findMany({
        where: { sourcingRequestId: id, id: { not: candidature.id }, status: 'PENDING' },
        select: { id: true, agentProfile: { select: { userId: true } } },
      });
      if (others.length) {
        await tx.candidature.updateMany({
          where: { id: { in: others.map((o) => o.id) } },
          data: { status: 'REJECTED' },
        });
      }

      const mission = await tx.mission.create({
        data: {
          sourcingRequestId: id,
          buyerId: request.buyerId,
          agentProfileId: candidature.agentProfileId,
          wholesalerProfileId: request.product?.wholesalerProfileId ?? null,
          agreedCommissionAmount,
          currency: candidature.currency,
          fulfillmentType: candidature.fulfillmentType ?? 'STANDARD',
        },
        select: { id: true, status: true },
      });

      await tx.missionStatusEvent.create({
        data: {
          missionId: mission.id,
          status: mission.status,
          createdByUserId: request.buyerId,
          note: 'Mission créée après acceptation de la candidature.',
        },
      });

      const conversation = await tx.conversation.create({
        data: {
          kind: 'BUYER_AGENT',
          subjectType: 'MISSION',
          subjectId: mission.id,
          participantAId: request.buyerId,
          participantBId: candidature.agentProfile.userId,
        },
        select: { id: true },
      });

      return {
        kind: 'OK' as const,
        requestTitle: request.title,
        mission,
        conversationId: conversation.id,
        acceptedCandidatureId: candidature.id,
        acceptedAgentUserId: candidature.agentProfile.userId,
        rejected: others.map((o) => ({ candidatureId: o.id, agentUserId: o.agentProfile.userId })),
      };
    });

    if (result.kind === 'REQUEST_NOT_FOUND') {
      return NextResponse.json({ error: 'REQUEST_NOT_FOUND' }, { status: 404 });
    }
    if (result.kind === 'REQUEST_NOT_OPEN') {
      return NextResponse.json({ error: 'REQUEST_NOT_OPEN' }, { status: 409 });
    }
    if (result.kind === 'CANDIDATURE_NOT_FOUND') {
      return NextResponse.json({ error: 'CANDIDATURE_NOT_FOUND' }, { status: 404 });
    }
    if (result.kind === 'CANDIDATURE_NOT_PENDING') {
      return NextResponse.json({ error: 'CANDIDATURE_NOT_PENDING' }, { status: 409 });
    }
    if (result.kind === 'COMMISSION_REQUIRED') {
      return NextResponse.json({ error: 'COMMISSION_REQUIRED' }, { status: 400 });
    }

    try {
      await createNotification(
        prisma,
        candidatureAccepted(
          result.acceptedAgentUserId,
          id,
          result.requestTitle,
          result.acceptedCandidatureId,
        ),
      );
      for (const r of result.rejected) {
        await createNotification(
          prisma,
          candidatureRejected(r.agentUserId, id, result.requestTitle, r.candidatureId),
        );
      }
    } catch {
      // Best-effort — the acceptance is already committed.
    }

    return NextResponse.json(
      { mission: result.mission, conversationId: result.conversationId },
      { headers: { 'x-request-id': reqCtx.requestId } },
    );
  });
}
