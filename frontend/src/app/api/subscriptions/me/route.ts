// GET /api/subscriptions/me — the authed AGENT/WHOLESALER's own
// ProSubscription (Phase 7, F27). Returns a synthetic INACTIVE row when
// none exists yet (a user who never checked out has no ProSubscription
// row — cheaper than eagerly creating one at role-choice time for a
// feature most users won't touch immediately).
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { requireAnyMarketplaceRole } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { planForProfileType, isProActive, type SubscriptionProfileType } from '@/lib/marketplace';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAnyMarketplaceRole(['AGENT', 'WHOLESALER']);
    if (auth instanceof NextResponse) return auth;

    const profileType: SubscriptionProfileType =
      auth.marketplaceRole === 'AGENT' ? 'AGENT' : 'WHOLESALER';

    const sub = await prisma.proSubscription.findUnique({
      where: { userId: auth.user.sub },
      select: {
        plan: true,
        status: true,
        currentPeriodEnd: true,
        graceEndsAt: true,
        updatedAt: true,
      },
    });

    const subscription = sub ?? {
      plan: planForProfileType(profileType),
      status: 'INACTIVE' as const,
      currentPeriodEnd: null,
      graceEndsAt: null,
      updatedAt: null,
    };

    return NextResponse.json(
      { subscription: { ...subscription, isPro: isProActive(subscription.status) } },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
