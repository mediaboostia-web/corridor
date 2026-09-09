// GET/PATCH /api/buyer/sourcing-requests/[id] — request detail + cancel.
// GET also returns the request's candidatures (Phase 3 "Vue candidatures")
// so the buyer's request-detail page can review and accept one — see
// POST .../candidatures/[candidatureId]/accept for the accept action.
// PATCH only supports { status: 'CANCELLED' } and only while OPEN (no
// candidature accepted yet) — once a mission exists (Phase 3/4), cancelling
// is a different, more careful flow that isn't built yet.
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { verifyCsrf } from '@/lib/server/auth';
import { requireMarketplaceRole } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { resolveMediaUrls } from '@/lib/server/marketplace/media';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const CANDIDATURE_SELECT = {
  id: true,
  proposedCommissionAmount: true,
  currency: true,
  message: true,
  status: true,
  createdAt: true,
  agentProfile: {
    select: {
      id: true,
      displayName: true,
      publicSlug: true,
      actionZone: true,
      missionCount: true,
      avgRating: true,
      reviewCount: true,
    },
  },
} as const satisfies Prisma.CandidatureSelect;

const REQUEST_SELECT = {
  id: true,
  buyerId: true,
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

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const reqCtx = makeRequestContext(req.headers);
  return withRequestContext(reqCtx, async () => {
    const auth = await requireMarketplaceRole('BUYER');
    if (auth instanceof NextResponse) return auth;

    const { id } = await ctx.params;
    const request = await prisma.sourcingRequest.findUnique({
      where: { id },
      select: REQUEST_SELECT,
    });
    if (!request || request.buyerId !== auth.user.sub) {
      return NextResponse.json({ error: 'REQUEST_NOT_FOUND' }, { status: 404 });
    }

    const candidatures = await prisma.candidature.findMany({
      where: { sourcingRequestId: id },
      orderBy: { createdAt: 'asc' },
      select: CANDIDATURE_SELECT,
    });

    return NextResponse.json(
      { request: await serializeRequest(request), candidatures },
      { headers: { 'x-request-id': reqCtx.requestId } },
    );
  });
}

const Body = z.object({ status: z.literal('CANCELLED') });

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const reqCtx = makeRequestContext(req.headers);
  return withRequestContext(reqCtx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireMarketplaceRole('BUYER');
    if (auth instanceof NextResponse) return auth;

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'VALIDATION_FAILED' }, { status: 400 });
    }

    const { id } = await ctx.params;
    const request = await prisma.sourcingRequest.findUnique({
      where: { id },
      select: { id: true, buyerId: true, status: true },
    });
    if (!request || request.buyerId !== auth.user.sub) {
      return NextResponse.json({ error: 'REQUEST_NOT_FOUND' }, { status: 404 });
    }
    if (request.status !== 'OPEN') {
      return NextResponse.json({ error: 'REQUEST_NOT_CANCELLABLE' }, { status: 409 });
    }

    const updated = await prisma.sourcingRequest.update({
      where: { id },
      data: { status: 'CANCELLED' },
      select: REQUEST_SELECT,
    });

    return NextResponse.json(
      { request: await serializeRequest(updated) },
      { headers: { 'x-request-id': reqCtx.requestId } },
    );
  });
}
