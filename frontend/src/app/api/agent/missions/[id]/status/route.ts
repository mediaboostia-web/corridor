// POST /api/agent/missions/[id]/status — advance a mission to the next
// agent-settable status (Phase 4, F16/F17/US4). No target status is
// accepted from the client — the server always computes "next" from the
// fixed RECU->EN_ACHAT->ACHETE->EMBALLE->EXPEDIE sequence
// (lib/mission-status.ts), so a request can never forge a skip. Past
// EXPEDIE, only the buyer (confirm-delivery) or the mission-auto-deliver
// cron can close the mission — this route 409s there.
//
// `wholesalerProfileId` is optional and settable at most once: a mission
// created from a free-form sourcing request (no linked Product) starts
// with wholesalerProfileId=null; once the agent identifies which boutique
// they bought from, they can attach it here so the mission surfaces on
// that shop's /wholesaler/commandes.
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireMarketplaceRole } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { createNotification } from '@/lib/server/notifications';
import { missionStatusChanged } from '@/lib/server/notifications/templates';
import { MISSION_STATUS_EVENT_MAX_MEDIA } from '@/lib/marketplace';
import {
  nextAgentStatus,
  isTerminalMissionStatus,
  MISSION_STATUS_LABEL,
} from '@/lib/mission-status';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const Body = z.object({
  note: z.string().trim().max(500).optional(),
  mediaFileUploadIds: z.array(z.string()).max(MISSION_STATUS_EVENT_MAX_MEDIA).default([]),
  wholesalerProfileId: z.string().optional(),
});

type Discriminator =
  | { kind: 'NOT_FOUND' }
  | { kind: 'ALREADY_CLOSED' }
  | { kind: 'AWAITING_DELIVERY' }
  | { kind: 'WHOLESALER_MISMATCH' }
  | {
      kind: 'OK';
      mission: { id: string; status: string };
      buyerId: string;
      requestTitle: string;
    };

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const reqCtx = makeRequestContext(req.headers);
  return withRequestContext(reqCtx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireMarketplaceRole('AGENT');
    if (auth instanceof NextResponse) return auth;

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'VALIDATION_FAILED' }, { status: 400 });
    }
    const { note, mediaFileUploadIds, wholesalerProfileId } = parsed.data;

    const agentProfile = await prisma.agentProfile.findUnique({
      where: { userId: auth.user.sub },
      select: { id: true },
    });
    if (!agentProfile) {
      return NextResponse.json({ error: 'PROFILE_NOT_FOUND' }, { status: 404 });
    }

    if (mediaFileUploadIds.length) {
      const owned = await prisma.fileUpload.count({
        where: { id: { in: mediaFileUploadIds }, userId: auth.user.sub },
      });
      if (owned !== mediaFileUploadIds.length) {
        return NextResponse.json({ error: 'UPLOAD_NOT_FOUND' }, { status: 400 });
      }
    }

    if (wholesalerProfileId) {
      const shop = await prisma.wholesalerProfile.findUnique({
        where: { id: wholesalerProfileId },
        select: { id: true, status: true },
      });
      if (!shop || shop.status !== 'ACTIVE') {
        return NextResponse.json({ error: 'WHOLESALER_NOT_FOUND' }, { status: 400 });
      }
    }

    const { id } = await ctx.params;

    const result: Discriminator = await prisma.$transaction(async (tx) => {
      const mission = await tx.mission.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          buyerId: true,
          wholesalerProfileId: true,
          fulfillmentType: true,
          agentProfile: { select: { userId: true } },
          sourcingRequest: { select: { title: true } },
        },
      });
      if (!mission || mission.agentProfile.userId !== auth.user.sub) {
        return { kind: 'NOT_FOUND' as const };
      }
      if (isTerminalMissionStatus(mission.status)) {
        return { kind: 'ALREADY_CLOSED' as const };
      }
      const next = nextAgentStatus(mission.status, mission.fulfillmentType);
      if (!next) {
        return { kind: 'AWAITING_DELIVERY' as const };
      }
      if (
        wholesalerProfileId &&
        mission.wholesalerProfileId &&
        mission.wholesalerProfileId !== wholesalerProfileId
      ) {
        return { kind: 'WHOLESALER_MISMATCH' as const };
      }

      const updated = await tx.mission.update({
        where: { id },
        data: {
          status: next,
          ...(wholesalerProfileId && !mission.wholesalerProfileId ? { wholesalerProfileId } : {}),
        },
        select: { id: true, status: true },
      });

      await tx.missionStatusEvent.create({
        data: {
          missionId: id,
          status: next,
          note: note ?? null,
          createdByUserId: auth.user.sub,
          media: { create: mediaFileUploadIds.map((fileUploadId) => ({ fileUploadId })) },
        },
      });

      return {
        kind: 'OK' as const,
        mission: updated,
        buyerId: mission.buyerId,
        requestTitle: mission.sourcingRequest.title,
      };
    });

    if (result.kind === 'NOT_FOUND') {
      return NextResponse.json({ error: 'MISSION_NOT_FOUND' }, { status: 404 });
    }
    if (result.kind === 'ALREADY_CLOSED') {
      return NextResponse.json({ error: 'MISSION_ALREADY_CLOSED' }, { status: 409 });
    }
    if (result.kind === 'AWAITING_DELIVERY') {
      return NextResponse.json(
        { error: 'MISSION_AWAITING_DELIVERY_CONFIRMATION' },
        { status: 409 },
      );
    }
    if (result.kind === 'WHOLESALER_MISMATCH') {
      return NextResponse.json({ error: 'WHOLESALER_ALREADY_SET' }, { status: 409 });
    }

    try {
      await createNotification(
        prisma,
        missionStatusChanged(
          result.buyerId,
          result.mission.id,
          result.mission.status,
          MISSION_STATUS_LABEL[result.mission.status as keyof typeof MISSION_STATUS_LABEL],
          result.requestTitle,
        ),
      );
    } catch {
      // Best-effort — the status update is already committed.
    }

    return NextResponse.json(
      { mission: result.mission },
      { headers: { 'x-request-id': reqCtx.requestId } },
    );
  });
}
