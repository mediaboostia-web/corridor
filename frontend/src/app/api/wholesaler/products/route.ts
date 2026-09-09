// GET/POST /api/wholesaler/products — the authed WHOLESALER's own catalogue
// (Phase 1 "Catalogue" + "Ajouter un produit"). Created products start as
// DRAFT; POST /api/wholesaler/products/[id]/submit moves DRAFT -> PENDING
// for admin moderation (see /api/admin/products).
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { verifyCsrf } from '@/lib/server/auth';
import { requireMarketplaceRole } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { resolveMediaUrls } from '@/lib/server/marketplace/media';
import { PRODUCT_MAX_MEDIA, WHOLESALER_FREE_PRODUCT_LIMIT, isProActive } from '@/lib/marketplace';
import { clampLimit, cursorWhere, buildPage, decodeCursor } from '@/lib/server/pagination/paginate';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const PRODUCT_SELECT = {
  id: true,
  name: true,
  category: true,
  description: true,
  priceAmount: true,
  currency: true,
  minQuantity: true,
  availability: true,
  status: true,
  rejectionReason: true,
  viewCount: true,
  createdAt: true,
  updatedAt: true,
  media: { select: { id: true, fileUploadId: true, position: true }, orderBy: { position: 'asc' } },
} as const satisfies Prisma.ProductSelect;

type ProductRow = Prisma.ProductGetPayload<{ select: typeof PRODUCT_SELECT }>;

async function serializeProduct(product: ProductRow) {
  const urls = await resolveMediaUrls(product.media.map((m) => m.fileUploadId));
  const { media, ...rest } = product;
  return {
    ...rest,
    media: media.map((m) => ({
      id: m.id,
      position: m.position,
      url: urls.get(m.fileUploadId) ?? null,
    })),
  };
}

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

    const where: Prisma.ProductWhereInput = {
      wholesalerProfileId: profile.id,
      ...(status ? { status } : {}),
      ...cursorWhere(cursor),
    };

    const rows = await prisma.product.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: PRODUCT_SELECT,
    });

    const page = buildPage(rows, limit);
    const items = await Promise.all(page.items.map(serializeProduct));

    return NextResponse.json(
      { items, nextCursor: page.nextCursor },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}

const CreateBody = z.object({
  name: z.string().trim().min(2).max(150),
  category: z.string().trim().min(2).max(60),
  description: z.string().trim().min(10).max(3000),
  priceAmount: z.number().int().positive(),
  minQuantity: z.number().int().positive().max(100000).default(1),
  mediaFileUploadIds: z.array(z.string()).max(PRODUCT_MAX_MEDIA).default([]),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireMarketplaceRole('WHOLESALER');
    if (auth instanceof NextResponse) return auth;

    const profile = await prisma.wholesalerProfile.findUnique({
      where: { userId: auth.user.sub },
      select: { id: true },
    });
    if (!profile) return NextResponse.json({ error: 'PROFILE_NOT_FOUND' }, { status: 404 });

    const parsed = CreateBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'VALIDATION_FAILED' }, { status: 400 });
    }
    const { mediaFileUploadIds, ...fields } = parsed.data;

    // Phase 7 (F13) — free tier caps the catalogue at
    // WHOLESALER_FREE_PRODUCT_LIMIT; Pro (ACTIVE or GRACE) is unlimited.
    const sub = await prisma.proSubscription.findUnique({
      where: { userId: auth.user.sub },
      select: { status: true },
    });
    if (!isProActive(sub?.status ?? 'INACTIVE')) {
      const productCount = await prisma.product.count({
        where: { wholesalerProfileId: profile.id },
      });
      if (productCount >= WHOLESALER_FREE_PRODUCT_LIMIT) {
        return NextResponse.json(
          {
            error: 'PRODUCT_LIMIT_REACHED',
            message: `Limite de ${WHOLESALER_FREE_PRODUCT_LIMIT} produits atteinte en plan gratuit.`,
          },
          { status: 403 },
        );
      }
    }

    if (mediaFileUploadIds.length) {
      const owned = await prisma.fileUpload.count({
        where: { id: { in: mediaFileUploadIds }, userId: auth.user.sub },
      });
      if (owned !== mediaFileUploadIds.length) {
        return NextResponse.json({ error: 'UPLOAD_NOT_FOUND' }, { status: 400 });
      }
    }

    const created = await prisma.product.create({
      data: {
        ...fields,
        wholesalerProfileId: profile.id,
        media: {
          create: mediaFileUploadIds.map((fileUploadId, position) => ({ fileUploadId, position })),
        },
      },
      select: PRODUCT_SELECT,
    });

    return NextResponse.json(
      { product: await serializeProduct(created) },
      { status: 201, headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
