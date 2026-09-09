// POST /api/wholesaler/products/[id]/submit — DRAFT -> PENDING, the owner's
// half of the moderation handshake (admin's half is
// POST /api/admin/products/[id]/{approve,reject}). Requires at least one
// product photo — a submission with zero images has nothing for admin to
// review or a buyer to see in the feed.
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { verifyCsrf } from '@/lib/server/auth';
import { requireMarketplaceRole } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const reqCtx = makeRequestContext(req.headers);
  return withRequestContext(reqCtx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireMarketplaceRole('WHOLESALER');
    if (auth instanceof NextResponse) return auth;

    const { id } = await ctx.params;

    const profile = await prisma.wholesalerProfile.findUnique({
      where: { userId: auth.user.sub },
      select: { id: true },
    });
    if (!profile) return NextResponse.json({ error: 'PROFILE_NOT_FOUND' }, { status: 404 });

    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        wholesalerProfileId: true,
        status: true,
        _count: { select: { media: true } },
      },
    });
    if (!product || product.wholesalerProfileId !== profile.id) {
      return NextResponse.json({ error: 'PRODUCT_NOT_FOUND' }, { status: 404 });
    }
    if (product.status !== 'DRAFT') {
      return NextResponse.json({ error: 'PRODUCT_NOT_DRAFT' }, { status: 409 });
    }
    if (product._count.media === 0) {
      return NextResponse.json({ error: 'PRODUCT_MISSING_PHOTOS' }, { status: 400 });
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        status: 'PENDING',
        moderatedByUserId: null,
        moderatedAt: null,
        rejectionReason: null,
      },
      select: { id: true, status: true },
    });

    return NextResponse.json(
      { product: updated },
      { headers: { 'x-request-id': reqCtx.requestId } },
    );
  });
}
