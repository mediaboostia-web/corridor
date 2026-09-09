// GET /api/wholesaler/missions — read-only visibility into missions
// sourced from this wholesaler's shop (Phase 4 "/wholesaler/commandes").
// `wholesalerProfileId` is only set on a Mission once known (at creation,
// from a product-linked sourcing request, or later via
// POST /api/agent/missions/[id]/status) — a shop with no attached missions
// yet simply sees an empty list, not an error.
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
  sourcingRequest: { select: { id: true, title: true, deliveryCountry: true } },
  agentProfile: { select: { id: true, userId: true, displayName: true } },
} as const satisfies Prisma.MissionSelect;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireMarketplaceRole('WHOLESALER');
    if (auth instanceof NextResponse) return auth;

    const profile = await prisma.wholesalerProfile.findUnique({
      where: { userId: auth.user.sub },
      select: { id: true },
    });
    if (!profile) return NextResponse.json({ error: 'PROFILE_NOT_FOUND' }, { status: 404 });

    const url = req.nextUrl;
    const limit = clampLimit(url.searchParams.get('limit'));
    const status = url.searchParams.get('status');
    const cursor = decodeCursor(url.searchParams.get('cursor'));

    const where: Prisma.MissionWhereInput = {
      wholesalerProfileId: profile.id,
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
