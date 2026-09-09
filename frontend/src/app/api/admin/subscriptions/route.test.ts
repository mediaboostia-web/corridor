// GET /api/admin/subscriptions — Phase 8 (PRD 3.24).
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

function req(qs = ''): NextRequest {
  return new NextRequest(`http://localhost/api/admin/subscriptions${qs}`);
}

function mockGroupBy(value: unknown) {
  (
    prismaMock.proSubscription.groupBy as unknown as { mockResolvedValue: (v: unknown) => void }
  ).mockResolvedValue(value);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(adminCtx);
  mockRateLimit.mockResolvedValue(null);
  prismaMock.proSubscription.findMany.mockResolvedValue([]);
  mockGroupBy([]);
});

it('returns 403 propagated from requireAdmin', async () => {
  mockRequireAdmin.mockResolvedValueOnce(
    NextResponse.json({ error: 'ADMIN_REQUIRED' }, { status: 403 }),
  );
  const res = await GET(req());
  expect(res.status).toBe(403);
});

it('returns empty list + mrr:0 when there are no subscriptions', async () => {
  const res = await GET(req());
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ items: [], nextCursor: null, mrr: 0 });
});

it('computes MRR from ACTIVE+GRACE subscriptions using the plan price table', async () => {
  mockGroupBy([
    { plan: 'AGENT_PRO', _count: 3 }, // 3 * 5000
    { plan: 'WHOLESALER_PRO', _count: 2 }, // 2 * 13000
  ]);
  const res = await GET(req());
  const body = await res.json();
  expect(body.mrr).toBe(3 * 5000 + 2 * 13000);
  const groupByCall = (
    prismaMock.proSubscription.groupBy as unknown as {
      mock: { calls: Array<[{ where: { status: { in: string[] } } }]> };
    }
  ).mock.calls[0]?.[0];
  expect(groupByCall?.where.status.in).toEqual(['ACTIVE', 'GRACE']);
});

it('filters by ?status= and ?plan=', async () => {
  await GET(req('?status=ACTIVE&plan=AGENT_PRO'));
  const args = prismaMock.proSubscription.findMany.mock.calls[0]?.[0];
  const where = args?.where as Record<string, unknown> | undefined;
  expect(where?.['status']).toBe('ACTIVE');
  expect(where?.['plan']).toBe('AGENT_PRO');
});

it('lists subscriptions with the owning user email + marketplaceRole included', async () => {
  prismaMock.proSubscription.findMany.mockResolvedValue([
    {
      id: 'sub-1',
      userId: 'user-1',
      user: { email: 'karim@example.com', marketplaceRole: 'AGENT' },
      profileType: 'AGENT',
      plan: 'AGENT_PRO',
      status: 'ACTIVE',
      currentPeriodEnd: new Date('2026-07-01'),
      graceEndsAt: null,
      createdAt: new Date('2026-06-01'),
      updatedAt: new Date('2026-06-01'),
    },
  ] as never);
  const res = await GET(req());
  const body = await res.json();
  expect(body.items).toHaveLength(1);
  expect(body.items[0].user.email).toBe('karim@example.com');
});
