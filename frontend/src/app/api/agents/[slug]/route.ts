// GET /api/agents/[slug] — fully public agent profile (Phase 3 "page
// publique agent"). No auth required. Only VERIFIED agents are reachable
// here (mirrors /api/boutiques/[slug] gating on WholesalerProfile.status
// === 'ACTIVE') — an unverified agent has no public trust signal to show
// yet, and PENDING/REJECTED are not for public consumption. No ID
// documents or phone are ever returned — this is a trust/portfolio page,
// not a contact page (messaging happens after a candidature is accepted,
// Phase 5).
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { isProActive } from '@/lib/marketplace';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const reqCtx = makeRequestContext(req.headers);
  return withRequestContext(reqCtx, async () => {
    const { slug } = await ctx.params;

    const profile = await prisma.agentProfile.findUnique({
      where: { publicSlug: slug },
      select: {
        id: true,
        userId: true,
        displayName: true,
        bio: true,
        actionZone: true,
        verificationStatus: true,
        missionCount: true,
        avgRating: true,
        reviewCount: true,
        isSuspended: true,
        createdAt: true,
      },
    });
    if (!profile || profile.verificationStatus !== 'VERIFIED' || profile.isSuspended) {
      return NextResponse.json({ error: 'AGENT_NOT_FOUND' }, { status: 404 });
    }

    // Reviews are shown anonymously (rating + comment only) — this is a
    // public trust/portfolio page, not a place to expose buyer identity.
    const [reviews, sub] = await Promise.all([
      prisma.review.findMany({
        where: { agentProfileId: profile.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, rating: true, comment: true, createdAt: true },
      }),
      // Phase 7 — "Agent Pro" badge (visibility-only benefit, never a lock
      // on candidater; see the plan's explicit gating note).
      prisma.proSubscription.findUnique({
        where: { userId: profile.userId },
        select: { status: true },
      }),
    ]);

    return NextResponse.json(
      {
        profile: {
          displayName: profile.displayName,
          bio: profile.bio,
          actionZone: profile.actionZone,
          missionCount: profile.missionCount,
          avgRating: profile.avgRating,
          reviewCount: profile.reviewCount,
          memberSince: profile.createdAt,
          isPro: isProActive(sub?.status ?? 'INACTIVE'),
        },
        reviews,
      },
      { headers: { 'x-request-id': reqCtx.requestId } },
    );
  });
}
