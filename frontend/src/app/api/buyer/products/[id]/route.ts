// GET /api/buyer/products/[id] — single PUBLISHED product, buyer-facing.
// Used to prefill /buyer/demander-un-sourcing?productId=... with the
// product's name/description/shop. Only PUBLISHED products are visible
// here — same rule as the feed and the public shop page.
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { requireMarketplaceRole } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { resolveMediaUrls } from '@/lib/server/marketplace/media';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const reqCtx = makeRequestContext(req.headers);
  return withRequestContext(reqCtx, async () => {
    const auth = await requireMarketplaceRole('BUYER');
    if (auth instanceof NextResponse) return auth;

    const { id } = await ctx.params;
    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        category: true,
        description: true,
        priceAmount: true,
        currency: true,
        minQuantity: true,
        availability: true,
        status: true,
        wholesalerProfile: { select: { shopName: true, slug: true } },
        media: { select: { fileUploadId: true, position: true }, orderBy: { position: 'asc' } },
      },
    });
    if (!product || product.status !== 'PUBLISHED') {
      return NextResponse.json({ error: 'PRODUCT_NOT_FOUND' }, { status: 404 });
    }

    const urls = await resolveMediaUrls(product.media.map((m) => m.fileUploadId));

    return NextResponse.json(
      {
        product: {
          id: product.id,
          name: product.name,
          category: product.category,
          description: product.description,
          priceAmount: product.priceAmount,
          currency: product.currency,
          minQuantity: product.minQuantity,
          availability: product.availability,
          wholesaler: product.wholesalerProfile,
          media: product.media.map((m) => ({ url: urls.get(m.fileUploadId) ?? null })),
        },
      },
      { headers: { 'x-request-id': reqCtx.requestId } },
    );
  });
}
