// GET /api/buyer/missions/[id] — mission detail for the owning buyer
// (Phase 4 "Mes commandes"). Includes the full status-event history with
// resolved proof-photo URLs and the agent's public info.
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { requireMarketplaceRole } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { resolveMediaUrls } from '@/lib/server/marketplace/media';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const MISSION_SELECT = {
  id: true,
  status: true,
  fulfillmentType: true,
  agreedCommissionAmount: true,
  currency: true,
  deliveryConfirmedAt: true,
  autoClosedAt: true,
  createdAt: true,
  updatedAt: true,
  buyerId: true,
  agentProfile: {
    select: {
      id: true,
      userId: true,
      displayName: true,
      publicSlug: true,
      avgRating: true,
      reviewCount: true,
    },
  },
  wholesalerProfile: { select: { id: true, shopName: true, slug: true, userId: true } },
  sourcingRequest: {
    select: { id: true, title: true, description: true, deliveryCountry: true, quantity: true },
  },
  review: { select: { id: true, rating: true, comment: true, createdAt: true } },
  statusEvents: {
    select: {
      id: true,
      status: true,
      note: true,
      createdByUserId: true,
      createdAt: true,
      media: { select: { fileUploadId: true } },
    },
    orderBy: { createdAt: 'asc' },
  },
} as const satisfies Prisma.MissionSelect;

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const reqCtx = makeRequestContext(req.headers);
  return withRequestContext(reqCtx, async () => {
    const auth = await requireMarketplaceRole('BUYER');
    if (auth instanceof NextResponse) return auth;

    const { id } = await ctx.params;
    const mission = await prisma.mission.findUnique({ where: { id }, select: MISSION_SELECT });
    if (!mission || mission.buyerId !== auth.user.sub) {
      return NextResponse.json({ error: 'MISSION_NOT_FOUND' }, { status: 404 });
    }

    const allMediaIds = mission.statusEvents.flatMap((e) => e.media.map((m) => m.fileUploadId));
    const urls = await resolveMediaUrls(allMediaIds);

    return NextResponse.json(
      {
        mission: {
          id: mission.id,
          status: mission.status,
          fulfillmentType: mission.fulfillmentType,
          agreedCommissionAmount: mission.agreedCommissionAmount,
          currency: mission.currency,
          deliveryConfirmedAt: mission.deliveryConfirmedAt,
          autoClosedAt: mission.autoClosedAt,
          createdAt: mission.createdAt,
          updatedAt: mission.updatedAt,
          agentProfile: mission.agentProfile,
          wholesalerProfile: mission.wholesalerProfile,
          sourcingRequest: mission.sourcingRequest,
          review: mission.review,
          statusEvents: mission.statusEvents.map((e) => ({
            id: e.id,
            status: e.status,
            note: e.note,
            createdAt: e.createdAt,
            media: e.media.map((m) => ({ url: urls.get(m.fileUploadId) ?? null })),
          })),
        },
      },
      { headers: { 'x-request-id': reqCtx.requestId } },
    );
  });
}
