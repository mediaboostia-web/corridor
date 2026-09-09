// GET /api/public/catalogue-teaser — Phase 9. A handful of PUBLISHED
// products for the anonymous homepage ("teaser catalogue sans compte" —
// PRD Phase 9). Fully public, no auth, mirrors the pattern already used by
// /api/boutiques/[slug] and /api/agents/[slug]. Deliberately unpaginated
// (fixed small count) — this is a landing-page teaser, not the real feed
// (that stays gated behind BUYER auth at /api/buyer/catalogue).
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import { resolveMediaUrls } from '@/lib/server/marketplace/media';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const TEASER_COUNT = 6;
const TEASER_THUMB_WIDTH = 400;

const PRODUCT_SELECT = {
  id: true,
  name: true,
  priceAmount: true,
  currency: true,
  wholesalerProfile: { select: { shopName: true, slug: true } },
  media: { select: { fileUploadId: true, position: true }, orderBy: { position: 'asc' }, take: 1 },
} as const satisfies Prisma.ProductSelect;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const products = await prisma.product.findMany({
      where: { status: 'PUBLISHED', availability: 'AVAILABLE' },
      orderBy: { createdAt: 'desc' },
      take: TEASER_COUNT,
      select: PRODUCT_SELECT,
    });

    const urls = await resolveMediaUrls(
      products.flatMap((p) => p.media.map((m) => m.fileUploadId)),
      { width: TEASER_THUMB_WIDTH },
    );
    const items = products.map((p) => ({
      id: p.id,
      name: p.name,
      priceAmount: p.priceAmount,
      currency: p.currency,
      wholesaler: p.wholesalerProfile,
      imageUrl: p.media[0] ? (urls.get(p.media[0].fileUploadId) ?? null) : null,
    }));

    return NextResponse.json({ items }, { headers: { 'x-request-id': ctx.requestId } });
  });
}
