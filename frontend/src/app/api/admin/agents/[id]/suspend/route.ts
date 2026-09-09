// POST /api/admin/agents/[id]/suspend — Phase 8. `[id]` is AgentProfile.id.
// Manual counterpart to the Phase 6 `AGENT_RATING_ALERT` ("suspension
// manuelle peut être envisagée" — never automatic, see that template's
// comment in notifications/templates.ts). Suspending hides the agent's
// public profile (already gated on isSuspended, Phase 3) and blocks new
// candidatures (guarded locally in POST /api/agent/candidatures — existing
// missions are unaffected, only new work is blocked).
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAdmin } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { logAdminAction } from '@/lib/server/admin/audit';
import { createNotification } from '@/lib/server/notifications';
import { agentSuspended } from '@/lib/server/notifications/templates';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const Body = z.object({ reason: z.string().trim().min(1).max(500).optional() });

type Discriminator =
  | { kind: 'NOT_FOUND' }
  | { kind: 'ALREADY_SUSPENDED' }
  | { kind: 'OK'; agentProfileId: string; ownerUserId: string };

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

    const { id } = await ctx.params;
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'VALIDATION_FAILED' }, { status: 400 });
    }
    const suspendedAt = new Date();

    const result: Discriminator = await prisma.$transaction(async (tx) => {
      const agentProfile = await tx.agentProfile.findUnique({
        where: { id },
        select: { id: true, userId: true, isSuspended: true },
      });
      if (!agentProfile) return { kind: 'NOT_FOUND' as const };
      if (agentProfile.isSuspended) return { kind: 'ALREADY_SUSPENDED' as const };

      await tx.agentProfile.update({ where: { id }, data: { isSuspended: true } });

      await logAdminAction(tx, {
        actorId: auth.admin.id,
        action: 'agent.suspend',
        targetType: 'AgentProfile',
        targetId: id,
        metadata: { ...(parsed.data.reason ? { reason: parsed.data.reason } : {}) },
      });

      return { kind: 'OK' as const, agentProfileId: id, ownerUserId: agentProfile.userId };
    });

    if (result.kind === 'NOT_FOUND') {
      return NextResponse.json({ error: 'AGENT_NOT_FOUND' }, { status: 404 });
    }
    if (result.kind === 'ALREADY_SUSPENDED') {
      return NextResponse.json({ error: 'AGENT_ALREADY_SUSPENDED' }, { status: 409 });
    }

    try {
      await createNotification(
        prisma,
        agentSuspended(
          result.ownerUserId,
          result.agentProfileId,
          parsed.data.reason ?? null,
          suspendedAt,
        ),
      );
    } catch {
      // Best-effort — the suspension is already committed.
    }

    return NextResponse.json(
      { agentProfile: { id: result.agentProfileId, isSuspended: true } },
      { headers: { 'x-request-id': reqCtx.requestId } },
    );
  });
}
