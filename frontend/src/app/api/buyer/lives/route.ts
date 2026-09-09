// GET /api/buyer/lives — Phase 2 "/buyer/lives": the full list of Lives
// (à venir/historique) across every wholesaler, for buyers who want to
// browse deliberately instead of discovering them in the feed. No
// registration/reminders — just a filterable list, per the "signal, not a
// scheduling system" decision.
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { requireMarketplaceRole } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { deriveLiveStatus } from '@/lib/live-status';
import { clampLimit, cursorWhere, buildPage, decodeCursor } from '@/lib/server/pagination/paginate';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const LIVE_SELECT = {
  id: true,
  title: true,
  externalLink: true,
  scheduledStart: true,
  scheduledEnd: true,
  status: true,
  createdAt: true,
  wholesalerProfile: { select: { shopName: true, slug: true } },
} as const satisfies Prisma.LiveAnnouncementSelect;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireMarketplaceRole('BUYER');
    if (auth instanceof NextResponse) return auth;

    const url = req.nextUrl;
    const limit = clampLimit(url.searchParams.get('limit'));
    // "upcoming" = SCHEDULED or LIVE window (scheduledEnd in the future),
    // not CANCELLED. "past" = everything else. Derivable via scheduledEnd
    // vs now() at the query level — no need to fetch+filter in memory.
    const scope = url.searchParams.get('scope') === 'past' ? 'past' : 'upcoming';
    const cursor = decodeCursor(url.searchParams.get('cursor'));
    const now = new Date();

    const where: Prisma.LiveAnnouncementWhereInput =
      scope === 'upcoming'
        ? { status: { not: 'CANCELLED' }, scheduledEnd: { gte: now } }
        : { OR: [{ status: 'CANCELLED' }, { scheduledEnd: { lt: now } }] };

    // Both scopes paginate on (createdAt desc, id desc) — matches the
    // generic cursorWhere/buildPage codec (hardcoded to createdAt). Ordering
    // "upcoming" by announcement recency rather than by scheduledStart is a
    // deliberate v1 simplification: a bespoke scheduledStart cursor isn't
    // worth it while the list stays short (per the plan's own note on Live
    // volume).
    const rows = await prisma.liveAnnouncement.findMany({
      where: { ...where, ...cursorWhere(cursor) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: LIVE_SELECT,
    });

    const page = buildPage(rows, limit);
    const items = page.items.map((l) => ({ ...l, derivedStatus: deriveLiveStatus(l) }));

    return NextResponse.json(
      { items, nextCursor: page.nextCursor },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
