// GET /api/boutiques/[slug] — fully public shop page data (Phase 1 "page
// publique boutique"). No auth required (guests browse freely, per PRD
// "catalogue en mode invité"). Returns the shop profile, its PUBLISHED
// products (any `availability` — an UNAVAILABLE one still shows here with a
// stock badge, just hidden from the Phase 2 buyer discovery feed), and the
// nearest non-cancelled, non-ended live announcement (SCHEDULED or
// currently LIVE) for the "EN LIVE" badge.
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { resolveMediaUrls } from '@/lib/server/marketplace/media';
import { deriveLiveStatus } from '@/lib/live-status';
import { isProActive } from '@/lib/marketplace';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const reqCtx = makeRequestContext(req.headers);
  return withRequestContext(reqCtx, async () => {
    const { slug } = await ctx.params;

    const profile = await prisma.wholesalerProfile.findUnique({
      where: { slug },
      select: {
        id: true,
        userId: true,
        shopName: true,
        slug: true,
        description: true,
        locationCity: true,
        locationDetail: true,
        hours: true,
        whatsappLink: true,
        logoUploadId: true,
        coverUploadId: true,
        status: true,
        createdAt: true,
      },
    });
    if (!profile || profile.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'SHOP_NOT_FOUND' }, { status: 404 });
    }

    await prisma.wholesalerProfile
      .update({ where: { id: profile.id }, data: { viewCount: { increment: 1 } } })
      .catch(() => undefined);

    const [products, nextLive, sub] = await Promise.all([
      prisma.product.findMany({
        where: { wholesalerProfileId: profile.id, status: 'PUBLISHED' },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          category: true,
          description: true,
          priceAmount: true,
          currency: true,
          minQuantity: true,
          availability: true,
          media: { select: { fileUploadId: true, position: true }, orderBy: { position: 'asc' } },
        },
      }),
      prisma.liveAnnouncement.findFirst({
        where: {
          wholesalerProfileId: profile.id,
          status: { not: 'CANCELLED' },
          scheduledEnd: { gte: new Date() },
        },
        orderBy: { scheduledStart: 'asc' },
        select: {
          id: true,
          title: true,
          externalLink: true,
          scheduledStart: true,
          scheduledEnd: true,
          status: true,
        },
      }),
      // Phase 7 — "Grossiste partenaire" badge (visibility-only benefit).
      prisma.proSubscription.findUnique({
        where: { userId: profile.userId },
        select: { status: true },
      }),
    ]);

    const allMediaIds = [
      profile.logoUploadId,
      profile.coverUploadId,
      ...products.flatMap((p) => p.media.map((m) => m.fileUploadId)),
    ].filter((id): id is string => id !== null);
    const urls = await resolveMediaUrls(allMediaIds);

    return NextResponse.json(
      {
        profile: {
          id: profile.id,
          shopName: profile.shopName,
          slug: profile.slug,
          description: profile.description,
          locationCity: profile.locationCity,
          locationDetail: profile.locationDetail,
          hours: profile.hours,
          whatsappLink: profile.whatsappLink,
          logoUrl: profile.logoUploadId ? (urls.get(profile.logoUploadId) ?? null) : null,
          coverUrl: profile.coverUploadId ? (urls.get(profile.coverUploadId) ?? null) : null,
          memberSince: profile.createdAt,
          isPro: isProActive(sub?.status ?? 'INACTIVE'),
        },
        products: products.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          description: p.description,
          priceAmount: p.priceAmount,
          currency: p.currency,
          minQuantity: p.minQuantity,
          availability: p.availability,
          media: p.media.map((m) => ({ url: urls.get(m.fileUploadId) ?? null })),
        })),
        live: nextLive ? { ...nextLive, derivedStatus: deriveLiveStatus(nextLive) } : null,
      },
      { headers: { 'x-request-id': reqCtx.requestId } },
    );
  });
}
