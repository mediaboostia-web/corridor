// POST /api/admin/agents/[id]/reject — PENDING -> REJECTED with a reason
// the agent can act on (unlike Product rejection, which reuses DRAFT,
// AgentProfile has a dedicated REJECTED state per the schema comment on
// verificationStatus — POST /api/agent/verification allows resubmission
// from REJECTED). Audit metadata shape: action 'agent.verify.reject',
// metadata { reason }.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAdmin } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { logAdminAction } from '@/lib/server/admin/audit';
import { createNotification } from '@/lib/server/notifications';
import { verificationRejected } from '@/lib/server/notifications/templates';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const Body = z.object({ reason: z.string().trim().min(1).max(500) });

type Discriminator =
  | { kind: 'NOT_FOUND' }
  | { kind: 'NOT_PENDING' }
  | { kind: 'OK'; agentProfile: { id: string; verificationStatus: string }; ownerUserId: string };

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const reqCtx = makeRequestContext(req.headers);
  return withRequestContext(reqCtx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAdmin('ADMIN');
    if (auth instanceof NextResponse) return auth;

    const limited = await enforceAdminRateLimit(auth.admin.id);
    if (limited) return limited;

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'VALIDATION_FAILED' }, { status: 400 });
    }

    const { id } = await ctx.params;
    const reviewedAt = new Date();

    const result: Discriminator = await prisma.$transaction(async (tx) => {
      const agentProfile = await tx.agentProfile.findUnique({
        where: { id },
        select: { id: true, verificationStatus: true, userId: true },
      });
      if (!agentProfile) return { kind: 'NOT_FOUND' as const };
      if (agentProfile.verificationStatus !== 'PENDING') return { kind: 'NOT_PENDING' as const };

      const updated = await tx.agentProfile.update({
        where: { id },
        data: {
          verificationStatus: 'REJECTED',
          verificationReviewedAt: reviewedAt,
          verificationReviewerId: auth.admin.id,
          verificationRejectionReason: parsed.data.reason,
        },
        select: { id: true, verificationStatus: true },
      });

      await logAdminAction(tx, {
        actorId: auth.admin.id,
        action: 'agent.verify.reject',
        targetType: 'AgentProfile',
        targetId: id,
        metadata: { reason: parsed.data.reason },
      });

      return { kind: 'OK' as const, agentProfile: updated, ownerUserId: agentProfile.userId };
    });

    if (result.kind === 'NOT_FOUND') {
      return NextResponse.json({ error: 'AGENT_NOT_FOUND' }, { status: 404 });
    }
    if (result.kind === 'NOT_PENDING') {
      return NextResponse.json({ error: 'AGENT_NOT_PENDING' }, { status: 409 });
    }

    try {
      await createNotification(
        prisma,
        verificationRejected(
          result.ownerUserId,
          result.agentProfile.id,
          parsed.data.reason,
          reviewedAt,
        ),
      );
    } catch {
      // Best-effort — the rejection is already committed.
    }

    return NextResponse.json(
      { agentProfile: result.agentProfile },
      { headers: { 'x-request-id': reqCtx.requestId } },
    );
  });
}
