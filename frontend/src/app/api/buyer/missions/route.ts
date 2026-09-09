// GET /api/buyer/missions — the authed BUYER's own missions (Phase 4 "Mes
// commandes"). Cursor-paginated, optional ?status= filter.
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { requireMarketplaceRole } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { clampLimit, cursorWhere, buildPage, decodeCursor } from '@/lib/server/pagination/paginate';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const MISSION_SELECT = {
  id: true,
  status: true,
  agreedCommissionAmount: true,
  currency: true,
  createdAt: true,
  updatedAt: true,
  sourcingRequest: { select: { id: true, title: true, deliveryCountry: true } },
  agentProfile: { select: { id: true, displayName: true, publicSlug: true } },
} as const satisfies Prisma.MissionSelect;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireMarketplaceRole('BUYER');
    if (auth instanceof NextResponse) return auth;

    const url = req.nextUrl;
    const limit = clampLimit(url.searchParams.get('limit'));
    const status = url.searchParams.get('status');
    const cursor = decodeCursor(url.searchParams.get('cursor'));

    const where: Prisma.MissionWhereInput = {
      buyerId: auth.user.sub,
      ...(status ? { status } : {}),
      ...cursorWhere(cursor),
    };

    const rows = await prisma.mission.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: MISSION_SELECT,
    });

    const page = buildPage(rows, limit);

    return NextResponse.json(
      { items: page.items, nextCursor: page.nextCursor },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
