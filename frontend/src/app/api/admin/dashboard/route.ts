// GET /api/admin/dashboard — Phase 8 (PRD 3.21). Read-only KPI snapshot:
// users per marketplace role, active sourcing requests, cumulative
// subscription revenue, and the Mission completion rate. All figures are
// computed live (no cache/materialized view — traffic is low enough per
// the plan's own risk notes on subscription volume).
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAdmin('ADMIN');
    if (auth instanceof NextResponse) return auth;

    const limited = await enforceAdminRateLimit(auth.admin.id);
    if (limited) return limited;

    const [usersByRole, activeSourcingRequests, subscriptionRevenue, missionsByStatus] =
      await Promise.all([
        prisma.user.groupBy({
          by: ['marketplaceRole'],
          _count: true,
          where: { marketplaceRole: { not: null } },
        }),
        prisma.sourcingRequest.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
        // Order is reserved for Pro-subscription payments (see the comment
        // above `model Order` in schema.prisma) — every PAID row is
        // subscription revenue, no metadata filter needed.
        prisma.order.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } }),
        prisma.mission.groupBy({ by: ['status'], _count: true }),
      ]);

    const usersByMarketplaceRole = { BUYER: 0, AGENT: 0, WHOLESALER: 0 } as Record<string, number>;
    for (const row of usersByRole) {
      if (row.marketplaceRole) usersByMarketplaceRole[row.marketplaceRole] = row._count;
    }

    const totalMissions = missionsByStatus.reduce((sum, row) => sum + row._count, 0);
    const completedMissions = missionsByStatus
      .filter((row) => row.status === 'LIVRE' || row.status === 'AUTO_LIVRE')
      .reduce((sum, row) => sum + row._count, 0);
    const missionCompletionRate = totalMissions > 0 ? completedMissions / totalMissions : 0;

    return NextResponse.json(
      {
        usersByMarketplaceRole,
        activeSourcingRequests,
        subscriptionRevenueTotal: subscriptionRevenue._sum.amount ?? 0,
        missions: {
          total: totalMissions,
          completed: completedMissions,
          completionRate: missionCompletionRate,
        },
      },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
