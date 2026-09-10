// GET /api/agent/demandes-ouvertes — the OPEN SourcingRequest queue any
// AGENT can browse (Phase 3 "Demandes ouvertes"). Deliberately available
// to UNVERIFIED agents too — requireMarketplaceRole('AGENT'), not
// requireVerifiedAgent() — per AgentProfile verification's design intent
// (F10/US2: browsing is free, candidating requires verification, enforced
// in POST /api/agent/candidatures). Each item is annotated with the
// caller's own candidature status/id, if any, so the UI can show "déjà
// candidaté" without a second round trip.
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { requireMarketplaceRole } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { resolveMediaUrls } from '@/lib/server/marketplace/media';
import { clampLimit, cursorWhere, buildPage, decodeCursor } from '@/lib/server/pagination/paginate';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const REQUEST_SELECT = {
  id: true,
  title: true,
  description: true,
  budgetAmount: true,
  currency: true,
  quantity: true,
  deliveryCountry: true,
  createdAt: true,
  product: {
    select: {
      id: true,
      name: true,
      wholesalerProfile: { select: { shopName: true, slug: true } },
    },
  },
  media: { select: { fileUploadId: true, position: true }, orderBy: { position: 'asc' }, take: 1 },
} as const satisfies Prisma.SourcingRequestSelect;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireMarketplaceRole('AGENT');
    if (auth instanceof NextResponse) return auth;

    const agentProfile = await prisma.agentProfile.findUnique({
      where: { userId: auth.user.sub },
      select: { id: true },
    });
    if (!agentProfile) {
      return NextResponse.json({ error: 'PROFILE_NOT_FOUND' }, { status: 404 });
    }

    const url = req.nextUrl;
    const limit = clampLimit(url.searchParams.get('limit'));
    const q = url.searchParams.get('q')?.trim();
    const cursor = decodeCursor(url.searchParams.get('cursor'));

    const where: Prisma.SourcingRequestWhereInput = {
      status: 'OPEN',
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...cursorWhere(cursor),
    };

    const rows = await prisma.sourcingRequest.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: REQUEST_SELECT,
    });

    const page = buildPage(rows, limit);
    const allMediaIds = page.items.flatMap((r) => r.media.map((m) => m.fileUploadId));
    const urls = await resolveMediaUrls(allMediaIds);

    const myCandidatures = page.items.length
      ? await prisma.candidature.findMany({
          where: {
            agentProfileId: agentProfile.id,
            sourcingRequestId: { in: page.items.map((r) => r.id) },
          },
          select: { id: true, sourcingRequestId: true, status: true },
        })
      : [];
    const candidatureByRequestId = new Map(myCandidatures.map((c) => [c.sourcingRequestId, c]));

    const items = page.items.map((r) => {
      const mine = candidatureByRequestId.get(r.id);
      return {
        id: r.id,
        title: r.title,
        description: r.description,
        budgetAmount: r.budgetAmount,
        currency: r.currency,
        quantity: r.quantity,
        deliveryCountry: r.deliveryCountry,
        createdAt: r.createdAt,
        thumbnailUrl: r.media[0] ? (urls.get(r.media[0].fileUploadId) ?? null) : null,
        product: r.product
          ? {
              id: r.product.id,
              name: r.product.name,
              wholesalerShopName: r.product.wholesalerProfile?.shopName ?? null,
              wholesalerSlug: r.product.wholesalerProfile?.slug ?? null,
            }
          : null,
        myCandidatureId: mine?.id ?? null,
        myCandidatureStatus: mine?.status ?? null,
      };
    });

    return NextResponse.json(
      { items, nextCursor: page.nextCursor },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
