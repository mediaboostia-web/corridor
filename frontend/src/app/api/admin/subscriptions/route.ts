// GET /api/admin/subscriptions — Phase 8 (PRD 3.24). Paginated ProSubscription
// list (?status= ?plan= filters, cursor pagination) plus the current MRR
// (sum of ACTIVE + GRACE subscriptions' plan price — both still count
// toward recurring revenue expectation; only CANCELLED/EXPIRED/INACTIVE
// don't). Read-only — no admin mutation on subscriptions in v1 (the plan's
// own action list for this page is "voir", never "modifier").
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { requireAdmin } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { clampLimit, cursorWhere, buildPage, decodeCursor } from '@/lib/server/pagination/paginate';
import { SUBSCRIPTION_PLAN_PRICE, type SubscriptionPlan } from '@/lib/marketplace';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const SUB_SELECT = {
  id: true,
  userId: true,
  user: { select: { email: true, marketplaceRole: true } },
  profileType: true,
  plan: true,
  status: true,
  currentPeriodEnd: true,
  graceEndsAt: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.ProSubscriptionSelect;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAdmin('ADMIN');
    if (auth instanceof NextResponse) return auth;

    const limited = await enforceAdminRateLimit(auth.admin.id);
    if (limited) return limited;

    const url = req.nextUrl;
    const limit = clampLimit(url.searchParams.get('limit'));
    const status = url.searchParams.get('status');
    const plan = url.searchParams.get('plan');
    const cursor = decodeCursor(url.searchParams.get('cursor'));

    const where: Prisma.ProSubscriptionWhereInput = {
      ...(status ? { status } : {}),
      ...(plan ? { plan } : {}),
      ...cursorWhere(cursor),
    };

    const [rows, mrrRows] = await Promise.all([
      prisma.proSubscription.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        select: SUB_SELECT,
      }),
      prisma.proSubscription.groupBy({
        by: ['plan'],
        _count: true,
        where: { status: { in: ['ACTIVE', 'GRACE'] } },
      }),
    ]);

    const page = buildPage(rows, limit);
    const mrr = mrrRows.reduce(
      (sum, row) => sum + (SUBSCRIPTION_PLAN_PRICE[row.plan as SubscriptionPlan] ?? 0) * row._count,
      0,
    );

    return NextResponse.json(
      { items: page.items, nextCursor: page.nextCursor, mrr },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
