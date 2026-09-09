// GET /api/buyer/catalogue — the buyer's "Catalogue" page IS the feed (per
// user decision, not a separate discovery page): PUBLISHED products across
// every wholesaler, paginated, each card carrying its shop's name/slug so
// the buyer can jump to /boutiques/[slug]. On the FIRST page only (no
// cursor) the response also includes a short list of active/upcoming
// LiveAnnouncements (max 10, next 7 days) for the client to intersperse
// among the product cards — Lives are a signal, not a separate paginated
// stream, so they aren't merged into the cursor itself.
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { requireMarketplaceRole } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { resolveMediaUrls } from '@/lib/server/marketplace/media';
import { deriveLiveStatus } from '@/lib/live-status';
import { clampLimit, cursorWhere, buildPage, decodeCursor } from '@/lib/server/pagination/paginate';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const UPCOMING_LIVE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_UPCOMING_LIVES = 10;

const PRODUCT_SELECT = {
  id: true,
  name: true,
  category: true,
  description: true,
  priceAmount: true,
  currency: true,
  minQuantity: true,
  availability: true,
  createdAt: true,
  wholesalerProfile: { select: { shopName: true, slug: true } },
  media: { select: { fileUploadId: true, position: true }, orderBy: { position: 'asc' } },
} as const satisfies Prisma.ProductSelect;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireMarketplaceRole('BUYER');
    if (auth instanceof NextResponse) return auth;

    const url = req.nextUrl;
    const limit = clampLimit(url.searchParams.get('limit'));
    const category = url.searchParams.get('category');
    const cursorRaw = url.searchParams.get('cursor');
    const cursor = decodeCursor(cursorRaw);

    const where: Prisma.ProductWhereInput = {
      status: 'PUBLISHED',
      ...(category ? { category } : {}),
      ...cursorWhere(cursor),
    };

    const rows = await prisma.product.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: PRODUCT_SELECT,
    });

    const page = buildPage(rows, limit);
    const urls = await resolveMediaUrls(
      page.items.flatMap((p) => p.media.map((m) => m.fileUploadId)),
    );
    const items = page.items.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      description: p.description,
      priceAmount: p.priceAmount,
      currency: p.currency,
      minQuantity: p.minQuantity,
      availability: p.availability,
      wholesaler: p.wholesalerProfile,
      media: p.media.map((m) => ({ url: urls.get(m.fileUploadId) ?? null })),
    }));

    let liveAnnouncements: unknown[] = [];
    if (!cursorRaw) {
      const now = new Date();
      const lives = await prisma.liveAnnouncement.findMany({
        where: {
          status: { not: 'CANCELLED' },
          scheduledEnd: { gte: now },
          scheduledStart: { lte: new Date(now.getTime() + UPCOMING_LIVE_WINDOW_MS) },
        },
        orderBy: { scheduledStart: 'asc' },
        take: MAX_UPCOMING_LIVES,
        select: {
          id: true,
          title: true,
          externalLink: true,
          scheduledStart: true,
          scheduledEnd: true,
          status: true,
          wholesalerProfile: { select: { shopName: true, slug: true } },
        },
      });
      liveAnnouncements = lives.map((l) => ({ ...l, derivedStatus: deriveLiveStatus(l) }));
    }

    return NextResponse.json(
      { items, nextCursor: page.nextCursor, liveAnnouncements },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
