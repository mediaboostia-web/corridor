// GET /api/admin/dashboard — Phase 8 (PRD 3.21).
import { prismaMock } from '@/test-utils/prisma-mock';
import { it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/server/middleware', () => ({
  requireAdmin: vi.fn(),
}));
vi.mock('@/lib/server/middleware/rate-limit-by-userid', () => ({
  enforceAdminRateLimit: vi.fn(),
}));

import { requireAdmin } from '@/lib/server/middleware';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { GET } from './route';

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockRateLimit = vi.mocked(enforceAdminRateLimit);

const adminCtx = {
  user: { sub: 'admin-1', email: 'admin@test.local' },
  admin: { id: 'admin-1', email: 'admin@test.local', role: 'ADMIN' as const },
};

function req(): NextRequest {
  return new NextRequest('http://localhost/api/admin/dashboard');
}

// Complex conditional Prisma types (groupBy/aggregate) don't expose
// .mockResolvedValue cleanly — cast the mock accessor, not the value
// (established pattern, see review.aggregate in buyer/missions/[id]/review).
function mockUserGroupBy(value: unknown) {
  (
    prismaMock.user.groupBy as unknown as { mockResolvedValue: (v: unknown) => void }
  ).mockResolvedValue(value);
}
function mockMissionGroupBy(value: unknown) {
  (
    prismaMock.mission.groupBy as unknown as { mockResolvedValue: (v: unknown) => void }
  ).mockResolvedValue(value);
}
function mockOrderAggregate(value: unknown) {
  (
    prismaMock.order.aggregate as unknown as { mockResolvedValue: (v: unknown) => void }
  ).mockResolvedValue(value);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(adminCtx);
  mockRateLimit.mockResolvedValue(null);
  mockUserGroupBy([]);
  prismaMock.sourcingRequest.count.mockResolvedValue(0);
  mockOrderAggregate({ _sum: { amount: null } });
  mockMissionGroupBy([]);
});

it('returns 403 propagated from requireAdmin', async () => {
  mockRequireAdmin.mockResolvedValueOnce(
    NextResponse.json({ error: 'ADMIN_REQUIRED' }, { status: 403 }),
  );
  const res = await GET(req());
  expect(res.status).toBe(403);
});

it('returns 429 propagated from the rate limiter', async () => {
  mockRateLimit.mockResolvedValueOnce(
    NextResponse.json({ error: 'TOO_MANY_REQUESTS' }, { status: 429 }),
  );
  const res = await GET(req());
  expect(res.status).toBe(429);
});

it('returns zeroed KPIs when there is no data', async () => {
  const res = await GET(req());
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body).toEqual({
    usersByMarketplaceRole: { BUYER: 0, AGENT: 0, WHOLESALER: 0 },
    activeSourcingRequests: 0,
    subscriptionRevenueTotal: 0,
    missions: { total: 0, completed: 0, completionRate: 0 },
  });
});

it('aggregates users per marketplace role, active requests, revenue, and mission completion rate', async () => {
  mockUserGroupBy([
    { marketplaceRole: 'BUYER', _count: 5 },
    { marketplaceRole: 'AGENT', _count: 3 },
    { marketplaceRole: 'WHOLESALER', _count: 2 },
  ]);
  prismaMock.sourcingRequest.count.mockResolvedValue(4);
  mockOrderAggregate({ _sum: { amount: 65000 } });
  mockMissionGroupBy([
    { status: 'LIVRE', _count: 3 },
    { status: 'AUTO_LIVRE', _count: 1 },
    { status: 'EXPEDIE', _count: 2 },
  ]);

  const res = await GET(req());
  const body = await res.json();
  expect(body.usersByMarketplaceRole).toEqual({ BUYER: 5, AGENT: 3, WHOLESALER: 2 });
  expect(body.activeSourcingRequests).toBe(4);
  expect(body.subscriptionRevenueTotal).toBe(65000);
  expect(body.missions).toEqual({ total: 6, completed: 4, completionRate: 4 / 6 });
});

it('only aggregates PAID orders for subscription revenue', async () => {
  await GET(req());
  const call = (
    prismaMock.order.aggregate as unknown as {
      mock: { calls: Array<[{ where: { status: string } }]> };
    }
  ).mock.calls[0]?.[0];
  expect(call?.where.status).toBe('PAID');
});
