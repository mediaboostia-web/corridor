// POST /api/admin/agents/[id]/unsuspend — Phase 8. `[id]` is AgentProfile.id.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAdmin } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { logAdminAction } from '@/lib/server/admin/audit';
import { createNotification } from '@/lib/server/notifications';
import { agentUnsuspended } from '@/lib/server/notifications/templates';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

type Discriminator =
  | { kind: 'NOT_FOUND' }
  | { kind: 'NOT_SUSPENDED' }
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
    const unsuspendedAt = new Date();

    const result: Discriminator = await prisma.$transaction(async (tx) => {
      const agentProfile = await tx.agentProfile.findUnique({
        where: { id },
        select: { id: true, userId: true, isSuspended: true },
      });
      if (!agentProfile) return { kind: 'NOT_FOUND' as const };
      if (!agentProfile.isSuspended) return { kind: 'NOT_SUSPENDED' as const };

      await tx.agentProfile.update({ where: { id }, data: { isSuspended: false } });

      await logAdminAction(tx, {
        actorId: auth.admin.id,
        action: 'agent.unsuspend',
        targetType: 'AgentProfile',
        targetId: id,
      });

      return { kind: 'OK' as const, agentProfileId: id, ownerUserId: agentProfile.userId };
    });

    if (result.kind === 'NOT_FOUND') {
      return NextResponse.json({ error: 'AGENT_NOT_FOUND' }, { status: 404 });
    }
    if (result.kind === 'NOT_SUSPENDED') {
      return NextResponse.json({ error: 'AGENT_NOT_SUSPENDED' }, { status: 409 });
    }

    try {
      await createNotification(
        prisma,
        agentUnsuspended(result.ownerUserId, result.agentProfileId, unsuspendedAt),
      );
    } catch {
      // Best-effort — the reactivation is already committed.
    }

    return NextResponse.json(
      { agentProfile: { id: result.agentProfileId, isSuspended: false } },
      { headers: { 'x-request-id': reqCtx.requestId } },
    );
  });
}
