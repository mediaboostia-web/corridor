// POST /api/buyer/missions/[id]/review — the buyer leaves a rating (+
// optional comment) once a Mission is closed (Phase 6, F20). One review per
// mission (`Review.missionId @unique`). `AgentProfile.avgRating`/
// `reviewCount` are recomputed from the aggregate (not incremented) in the
// same transaction as the insert, per the schema's own comment. If the
// fresh average drops/stays below 3.0 across 3+ reviews, every admin gets a
// best-effort alert — never an auto-suspension (the plan's own decision).
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireMarketplaceRole } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { createNotification } from '@/lib/server/notifications';
import { agentRatingAlert } from '@/lib/server/notifications/templates';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const RATING_ALERT_THRESHOLD = 3.0;
const RATING_ALERT_MIN_REVIEWS = 3;

const Body = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

type Discriminator =
  | { kind: 'NOT_FOUND' }
  | { kind: 'MISSION_NOT_CLOSED' }
  | { kind: 'ALREADY_REVIEWED' }
  | {
      kind: 'OK';
      review: { id: string; rating: number; comment: string | null; createdAt: Date };
      agentProfileId: string;
      agentDisplayName: string;
      avgRating: number;
      reviewCount: number;
    };

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const reqCtx = makeRequestContext(req.headers);
  return withRequestContext(reqCtx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireMarketplaceRole('BUYER');
    if (auth instanceof NextResponse) return auth;

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'VALIDATION_FAILED' }, { status: 400 });
    }
    const { rating, comment } = parsed.data;

    const { id } = await ctx.params;

    let result: Discriminator;
    try {
      result = await prisma.$transaction(async (tx) => {
        const mission = await tx.mission.findUnique({
          where: { id },
          select: {
            id: true,
            status: true,
            buyerId: true,
            agentProfileId: true,
            agentProfile: { select: { displayName: true } },
          },
        });
        if (!mission || mission.buyerId !== auth.user.sub) {
          return { kind: 'NOT_FOUND' as const };
        }
        if (mission.status !== 'LIVRE' && mission.status !== 'AUTO_LIVRE') {
          return { kind: 'MISSION_NOT_CLOSED' as const };
        }

        const review = await tx.review.create({
          data: {
            missionId: id,
            authorId: auth.user.sub,
            agentProfileId: mission.agentProfileId,
            rating,
            comment: comment ?? null,
          },
          select: { id: true, rating: true, comment: true, createdAt: true },
        });

        const agg = await tx.review.aggregate({
          where: { agentProfileId: mission.agentProfileId },
          _avg: { rating: true },
          _count: true,
        });
        const avgRating = agg._avg.rating ?? rating;
        const reviewCount = agg._count;

        await tx.agentProfile.update({
          where: { id: mission.agentProfileId },
          data: { avgRating, reviewCount },
        });

        return {
          kind: 'OK' as const,
          review,
          agentProfileId: mission.agentProfileId,
          agentDisplayName: mission.agentProfile.displayName,
          avgRating,
          reviewCount,
        };
      });
    } catch (err) {
      // Duck-typed P2002 catch on Review.missionId @unique — mirrors the
      // slug.ts / candidature-uniqueness pattern (avoids a TOCTOU pre-check).
      if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
        return NextResponse.json({ error: 'REVIEW_ALREADY_EXISTS' }, { status: 409 });
      }
      throw err;
    }

    if (result.kind === 'NOT_FOUND') {
      return NextResponse.json({ error: 'MISSION_NOT_FOUND' }, { status: 404 });
    }
    if (result.kind === 'MISSION_NOT_CLOSED') {
      return NextResponse.json({ error: 'MISSION_NOT_CLOSED' }, { status: 409 });
    }

    if (
      result.avgRating < RATING_ALERT_THRESHOLD &&
      result.reviewCount >= RATING_ALERT_MIN_REVIEWS
    ) {
      try {
        const admins = await prisma.user.findMany({
          where: { role: { in: ['ADMIN', 'SUPERADMIN'] } },
          select: { id: true },
        });
        for (const admin of admins) {
          await createNotification(
            prisma,
            agentRatingAlert(
              admin.id,
              result.agentProfileId,
              result.agentDisplayName,
              result.avgRating,
              result.reviewCount,
              result.review.id,
            ),
          );
        }
      } catch {
        // Best-effort — the review is already committed.
      }
    }

    return NextResponse.json(
      { review: result.review },
      { status: 201, headers: { 'x-request-id': reqCtx.requestId } },
    );
  });
}
