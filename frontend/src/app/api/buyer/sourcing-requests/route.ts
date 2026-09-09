// GET/POST /api/buyer/sourcing-requests — Phase 2 "Demander un sourcing" +
// "Mes demandes" list. F12/US1: a buyer can't have more than
// MAX_ACTIVE_SOURCING_REQUESTS (OPEN | IN_PROGRESS) requests at once — the
// free-plan gate from the PRD §6 funnel table.
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { verifyCsrf } from '@/lib/server/auth';
import { requireMarketplaceRole } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { resolveMediaUrls } from '@/lib/server/marketplace/media';
import { stripUndefined } from '@/lib/server/object-utils';
import { MAX_ACTIVE_SOURCING_REQUESTS, SOURCING_REQUEST_MAX_MEDIA } from '@/lib/marketplace';
import { clampLimit, cursorWhere, buildPage, decodeCursor } from '@/lib/server/pagination/paginate';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const ACTIVE_STATUSES = ['OPEN', 'IN_PROGRESS'] as const;

const REQUEST_SELECT = {
  id: true,
  title: true,
  description: true,
  productId: true,
  tiktokLink: true,
  facebookLink: true,
  budgetAmount: true,
  currency: true,
  quantity: true,
  deliveryCountry: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  media: { select: { id: true, fileUploadId: true, position: true }, orderBy: { position: 'asc' } },
} as const satisfies Prisma.SourcingRequestSelect;

type RequestRow = Prisma.SourcingRequestGetPayload<{ select: typeof REQUEST_SELECT }>;

async function serializeRequest(request: RequestRow) {
  const urls = await resolveMediaUrls(request.media.map((m) => m.fileUploadId));
  return {
    id: request.id,
    title: request.title,
    description: request.description,
    productId: request.productId,
    tiktokLink: request.tiktokLink,
    facebookLink: request.facebookLink,
    budgetAmount: request.budgetAmount,
    currency: request.currency,
    quantity: request.quantity,
    deliveryCountry: request.deliveryCountry,
    status: request.status,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    media: request.media.map((m) => ({
      id: m.id,
      position: m.position,
      url: urls.get(m.fileUploadId) ?? null,
    })),
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireMarketplaceRole('BUYER');
    if (auth instanceof NextResponse) return auth;

    const url = req.nextUrl;
    const limit = clampLimit(url.searchParams.get('limit'));
    const status = url.searchParams.get('status');
    const cursor = decodeCursor(url.searchParams.get('cursor'));

    const where: Prisma.SourcingRequestWhereInput = {
      buyerId: auth.user.sub,
      ...(status ? { status } : {}),
      ...cursorWhere(cursor),
    };

    const rows = await prisma.sourcingRequest.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: REQUEST_SELECT,
    });

    const page = buildPage(rows, limit);
    const items = await Promise.all(page.items.map(serializeRequest));

    return NextResponse.json(
      { items, nextCursor: page.nextCursor },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}

const CreateBody = z.object({
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().min(10).max(3000),
  productId: z.string().nullable().optional(),
  tiktokLink: z.string().trim().url().max(500).nullable().optional(),
  facebookLink: z.string().trim().url().max(500).nullable().optional(),
  budgetAmount: z.number().int().positive().nullable().optional(),
  quantity: z.number().int().positive().nullable().optional(),
  deliveryCountry: z.string().trim().min(2).max(80),
  mediaFileUploadIds: z.array(z.string()).max(SOURCING_REQUEST_MAX_MEDIA).default([]),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireMarketplaceRole('BUYER');
    if (auth instanceof NextResponse) return auth;

    const parsed = CreateBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'VALIDATION_FAILED' }, { status: 400 });
    }
    const { mediaFileUploadIds, productId, ...fields } = parsed.data;

    const activeCount = await prisma.sourcingRequest.count({
      where: { buyerId: auth.user.sub, status: { in: [...ACTIVE_STATUSES] } },
    });
    if (activeCount >= MAX_ACTIVE_SOURCING_REQUESTS) {
      return NextResponse.json(
        {
          error: 'TOO_MANY_ACTIVE_REQUESTS',
          message: `Tu as déjà ${MAX_ACTIVE_SOURCING_REQUESTS} demandes actives. Clôture-en une pour en créer une nouvelle.`,
        },
        { status: 409 },
      );
    }

    if (productId) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { status: true },
      });
      if (!product || product.status !== 'PUBLISHED') {
        return NextResponse.json({ error: 'PRODUCT_NOT_AVAILABLE' }, { status: 400 });
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

    const created = await prisma.sourcingRequest.create({
      data: {
        ...stripUndefined(fields),
        productId: productId ?? null,
        buyerId: auth.user.sub,
        media: {
          create: mediaFileUploadIds.map((fileUploadId, position) => ({ fileUploadId, position })),
        },
      },
      select: REQUEST_SELECT,
    });

    return NextResponse.json(
      { request: await serializeRequest(created) },
      { status: 201, headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
