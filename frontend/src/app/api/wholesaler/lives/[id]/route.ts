// PATCH /api/wholesaler/lives/[id] — the only mutation after creation:
// cancelling an announcement (SCHEDULED or currently-LIVE-by-derivation ->
// CANCELLED). Already-ENDED or already-CANCELLED announcements can't be
// cancelled again — history stays meaningful for the "historique" view.
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireMarketplaceRole } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { deriveLiveStatus } from '@/lib/live-status';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const Body = z.object({ status: z.literal('CANCELLED') });

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const reqCtx = makeRequestContext(req.headers);
  return withRequestContext(reqCtx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireMarketplaceRole('WHOLESALER');
    if (auth instanceof NextResponse) return auth;

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'VALIDATION_FAILED' }, { status: 400 });
    }

    const { id } = await ctx.params;
    const profile = await prisma.wholesalerProfile.findUnique({
      where: { userId: auth.user.sub },
      select: { id: true },
    });
    if (!profile) return NextResponse.json({ error: 'PROFILE_NOT_FOUND' }, { status: 404 });

    const live = await prisma.liveAnnouncement.findUnique({
      where: { id },
      select: {
        id: true,
        wholesalerProfileId: true,
        status: true,
        scheduledStart: true,
        scheduledEnd: true,
      },
    });
    if (!live || live.wholesalerProfileId !== profile.id) {
      return NextResponse.json({ error: 'LIVE_NOT_FOUND' }, { status: 404 });
    }
    if (deriveLiveStatus(live) === 'ENDED' || live.status === 'CANCELLED') {
      return NextResponse.json({ error: 'LIVE_NOT_CANCELLABLE' }, { status: 409 });
    }

    const updated = await prisma.liveAnnouncement.update({
      where: { id },
      data: { status: 'CANCELLED' },
      select: { id: true, status: true },
    });

    return NextResponse.json({ live: updated }, { headers: { 'x-request-id': reqCtx.requestId } });
  });
}
