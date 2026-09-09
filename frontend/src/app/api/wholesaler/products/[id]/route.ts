// GET/PATCH/DELETE /api/wholesaler/products/[id] — single-product ownership
// boundary. PATCH edits fields only (name/category/description/price/
// minQuantity/availability/media) and never touches `status` — the
// moderation lifecycle only moves via POST .../submit (owner) or
// POST /api/admin/products/[id]/{approve,reject} (admin). Editing a
// PUBLISHED product does NOT require re-moderation in v1 (kept simple —
// revisit if abuse becomes a problem).
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { verifyCsrf } from '@/lib/server/auth';
import { requireMarketplaceRole } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { resolveMediaUrls } from '@/lib/server/marketplace/media';
import { stripUndefined } from '@/lib/server/object-utils';
import { PRODUCT_MAX_MEDIA } from '@/lib/marketplace';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const PRODUCT_SELECT = {
  id: true,
  wholesalerProfileId: true,
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
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    description: product.description,
    priceAmount: product.priceAmount,
    currency: product.currency,
    minQuantity: product.minQuantity,
    availability: product.availability,
    status: product.status,
    rejectionReason: product.rejectionReason,
    viewCount: product.viewCount,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    media: product.media.map((m) => ({
      id: m.id,
      position: m.position,
      url: urls.get(m.fileUploadId) ?? null,
    })),
  };
}

async function loadOwnedProduct(id: string, userId: string) {
  const profile = await prisma.wholesalerProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) return { profile: null, product: null };
  const product = await prisma.product.findUnique({ where: { id }, select: PRODUCT_SELECT });
  if (!product || product.wholesalerProfileId !== profile.id) return { profile, product: null };
  return { profile, product };
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const reqCtx = makeRequestContext(req.headers);
  return withRequestContext(reqCtx, async () => {
    const auth = await requireMarketplaceRole('WHOLESALER');
    if (auth instanceof NextResponse) return auth;

    const { id } = await ctx.params;
    const { product } = await loadOwnedProduct(id, auth.user.sub);
    if (!product) return NextResponse.json({ error: 'PRODUCT_NOT_FOUND' }, { status: 404 });

    return NextResponse.json(
      { product: await serializeProduct(product) },
      { headers: { 'x-request-id': reqCtx.requestId } },
    );
  });
}

const PatchBody = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  category: z.string().trim().min(2).max(60).optional(),
  description: z.string().trim().min(10).max(3000).optional(),
  priceAmount: z.number().int().positive().optional(),
  minQuantity: z.number().int().positive().max(100000).optional(),
  availability: z.enum(['AVAILABLE', 'UNAVAILABLE']).optional(),
  mediaFileUploadIds: z.array(z.string()).max(PRODUCT_MAX_MEDIA).optional(),
});

export async function PATCH(
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
    const { product } = await loadOwnedProduct(id, auth.user.sub);
    if (!product) return NextResponse.json({ error: 'PRODUCT_NOT_FOUND' }, { status: 404 });

    const parsed = PatchBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'VALIDATION_FAILED' }, { status: 400 });
    }
    const { mediaFileUploadIds, ...fields } = parsed.data;

    if (mediaFileUploadIds) {
      if (mediaFileUploadIds.length) {
        const owned = await prisma.fileUpload.count({
          where: { id: { in: mediaFileUploadIds }, userId: auth.user.sub },
        });
        if (owned !== mediaFileUploadIds.length) {
          return NextResponse.json({ error: 'UPLOAD_NOT_FOUND' }, { status: 400 });
        }
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (mediaFileUploadIds) {
        await tx.productMedia.deleteMany({ where: { productId: id } });
        if (mediaFileUploadIds.length) {
          await tx.productMedia.createMany({
            data: mediaFileUploadIds.map((fileUploadId, position) => ({
              productId: id,
              fileUploadId,
              position,
            })),
          });
        }
      }
      return tx.product.update({
        where: { id },
        data: stripUndefined(fields),
        select: PRODUCT_SELECT,
      });
    });

    return NextResponse.json(
      { product: await serializeProduct(updated) },
      { headers: { 'x-request-id': reqCtx.requestId } },
    );
  });
}

export async function DELETE(
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
    const { product } = await loadOwnedProduct(id, auth.user.sub);
    if (!product) return NextResponse.json({ error: 'PRODUCT_NOT_FOUND' }, { status: 404 });

    await prisma.product.delete({ where: { id } });

    return NextResponse.json({ ok: true }, { headers: { 'x-request-id': reqCtx.requestId } });
  });
}
