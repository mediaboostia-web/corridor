// POST /api/subscriptions/cancel — Phase 7, F27 ("peut annuler"). Cancels
// the authed AGENT/WHOLESALER's Pro subscription immediately.
//
// V1 stance: cancellation is immediate, not "at period end" — there is no
// recurring-charge API on the Bictorys provider (see checkout/route.ts), so
// a subscription only ever renews via the user manually checking out again.
// "Cancel" here just means "stop nudging me to renew" plus an immediate
// loss of Pro benefits (isProActive excludes CANCELLED), which is the
// simplest, least-surprising behavior for a fork with no real recurring
// billing to unwind.
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAnyMarketplaceRole } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { isProActive } from '@/lib/marketplace';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAnyMarketplaceRole(['AGENT', 'WHOLESALER']);
    if (auth instanceof NextResponse) return auth;

    const existing = await prisma.proSubscription.findUnique({
      where: { userId: auth.user.sub },
      select: { status: true },
    });
    if (!existing || !isProActive(existing.status)) {
      return NextResponse.json({ error: 'SUBSCRIPTION_NOT_ACTIVE' }, { status: 409 });
    }

    const updated = await prisma.proSubscription.update({
      where: { userId: auth.user.sub },
      data: { status: 'CANCELLED', graceEndsAt: null },
      select: { plan: true, status: true, currentPeriodEnd: true, graceEndsAt: true },
    });

    return NextResponse.json(
      { subscription: { ...updated, isPro: false } },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
