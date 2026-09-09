// GET /api/admin/products — moderation queue (Phase 1 "/admin/produits").
// Defaults to `status=PENDING` (the actionable queue); pass `?status=` to
// see other lifecycle states. Mirrors the admin/orders listing pattern
// (cursor pagination, ADMIN minimum role).
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { requireAdmin } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { resolveMediaUrls } from '@/lib/server/marketplace/media';
import { clampLimit, cursorWhere, buildPage, decodeCursor } from '@/lib/server/pagination/paginate';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const PRODUCT_SELECT = {
  id: true,
  name: true,
  category: true,
  description: true,
  priceAmount: true,
  currency: true,
  minQuantity: true,
  status: true,
  rejectionReason: true,
  createdAt: true,
  wholesalerProfile: { select: { id: true, shopName: true, slug: true } },
  media: { select: { fileUploadId: true, position: true }, orderBy: { position: 'asc' } },
} as const satisfies Prisma.ProductSelect;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAdmin('ADMIN');
    if (auth instanceof NextResponse) return auth;

    const limited = await enforceAdminRateLimit(auth.admin.id);
    if (limited) return limited;

    const url = req.nextUrl;
    const limit = clampLimit(url.searchParams.get('limit'));
    const status = url.searchParams.get('status') ?? 'PENDING';
    const cursor = decodeCursor(url.searchParams.get('cursor'));

    const where: Prisma.ProductWhereInput = { status, ...cursorWhere(cursor) };

    const rows = await prisma.product.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: PRODUCT_SELECT,
    });

    const page = buildPage(rows, limit);
    const allMediaIds = page.items.flatMap((p) => p.media.map((m) => m.fileUploadId));
    const urls = await resolveMediaUrls(allMediaIds);

    const items = page.items.map((p) => ({
      ...p,
      media: p.media.map((m) => ({ url: urls.get(m.fileUploadId) ?? null })),
    }));

    return NextResponse.json(
      { items, nextCursor: page.nextCursor },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
