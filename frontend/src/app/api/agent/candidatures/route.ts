// POST /api/agent/candidatures — an agent candidates on an OPEN
// SourcingRequest (Phase 3 "Candidater"). Requires a VERIFIED agent
// (requireVerifiedAgent) — F10/US2: unverified agents can browse but not
// candidate. The (sourcingRequestId, agentProfileId) unique constraint is
// the source of truth for "already candidated" — caught as P2002 rather
// than pre-checked, avoiding a TOCTOU race between the check and the write.
//
// Phase 8 — an admin-suspended agent (AgentProfile.isSuspended, toggled via
// POST /api/admin/agents/[id]/suspend) is blocked from NEW candidatures
// here; existing missions are untouched. Checked locally rather than in
// requireVerifiedAgent (protected middleware) since this is the only
// write-path consumer that needs it.
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { verifyCsrf } from '@/lib/server/auth';
import { requireVerifiedAgent } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { stripUndefined } from '@/lib/server/object-utils';
import { createNotification } from '@/lib/server/notifications';
import { newCandidature } from '@/lib/server/notifications/templates';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const Body = z.object({
  sourcingRequestId: z.string(),
  proposedCommissionAmount: z.number().int().positive().optional(),
  message: z.string().trim().min(10).max(1000),
  // Agent's choice of pipeline — defaults to STANDARD (see lib/mission-status.ts).
  fulfillmentType: z.enum(['STANDARD', 'INSTANTANE']).default('STANDARD'),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireVerifiedAgent();
    if (auth instanceof NextResponse) return auth;

    const agentProfile = await prisma.agentProfile.findUnique({
      where: { id: auth.agentProfileId },
      select: { isSuspended: true },
    });
    if (agentProfile?.isSuspended) {
      return NextResponse.json({ error: 'AGENT_SUSPENDED' }, { status: 403 });
    }

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'VALIDATION_FAILED' }, { status: 400 });
    }
    const { sourcingRequestId, ...fields } = parsed.data;

    const request = await prisma.sourcingRequest.findUnique({
      where: { id: sourcingRequestId },
      select: { id: true, title: true, buyerId: true, status: true },
    });
    if (!request) {
      return NextResponse.json({ error: 'REQUEST_NOT_FOUND' }, { status: 404 });
    }
    if (request.status !== 'OPEN') {
      return NextResponse.json({ error: 'REQUEST_NOT_OPEN' }, { status: 409 });
    }

    let created;
    try {
      created = await prisma.candidature.create({
        data: {
          sourcingRequestId,
          agentProfileId: auth.agentProfileId,
          ...stripUndefined(fields),
        },
        select: {
          id: true,
          sourcingRequestId: true,
          agentProfileId: true,
          proposedCommissionAmount: true,
          currency: true,
          message: true,
          status: true,
          fulfillmentType: true,
          createdAt: true,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return NextResponse.json({ error: 'ALREADY_CANDIDATED' }, { status: 409 });
      }
      throw err;
    }

    try {
      await createNotification(
        prisma,
        newCandidature(request.buyerId, request.id, request.title, created.id),
      );
    } catch {
      // Best-effort — the candidature is already committed.
    }

    return NextResponse.json(
      { candidature: created },
      { status: 201, headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
