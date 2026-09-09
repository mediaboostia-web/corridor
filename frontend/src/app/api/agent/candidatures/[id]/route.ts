// PATCH /api/agent/candidatures/[id] — an agent withdraws their own
// candidature. Mirrors the buyer sourcing-request cancel pattern (Phase 2):
// only supports { status: 'WITHDRAWN' }, only while PENDING (once a buyer
// has accepted/rejected it, withdrawing no longer makes sense).
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireMarketplaceRole } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const Body = z.object({ status: z.literal('WITHDRAWN') });

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const reqCtx = makeRequestContext(req.headers);
  return withRequestContext(reqCtx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireMarketplaceRole('AGENT');
    if (auth instanceof NextResponse) return auth;

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'VALIDATION_FAILED' }, { status: 400 });
    }

    const agentProfile = await prisma.agentProfile.findUnique({
      where: { userId: auth.user.sub },
      select: { id: true },
    });
    if (!agentProfile) {
      return NextResponse.json({ error: 'PROFILE_NOT_FOUND' }, { status: 404 });
    }

    const { id } = await ctx.params;
    const candidature = await prisma.candidature.findUnique({
      where: { id },
      select: { id: true, agentProfileId: true, status: true },
    });
    if (!candidature || candidature.agentProfileId !== agentProfile.id) {
      return NextResponse.json({ error: 'CANDIDATURE_NOT_FOUND' }, { status: 404 });
    }
    if (candidature.status !== 'PENDING') {
      return NextResponse.json({ error: 'CANDIDATURE_NOT_WITHDRAWABLE' }, { status: 409 });
    }

    const updated = await prisma.candidature.update({
      where: { id },
      data: { status: 'WITHDRAWN' },
      select: { id: true, status: true },
    });

    return NextResponse.json(
      { candidature: updated },
      { headers: { 'x-request-id': reqCtx.requestId } },
    );
  });
}
