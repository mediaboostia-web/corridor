// GET /api/subscriptions/me — Phase 7.
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies } from '@/test-utils/mock-cookies';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

mockNextCookies();

vi.mock('@/lib/server/middleware', () => ({
  requireAnyMarketplaceRole: vi.fn(),
}));

import { requireAnyMarketplaceRole } from '@/lib/server/middleware';
import { GET } from './route';

const mockRequireAnyMarketplaceRole = vi.mocked(requireAnyMarketplaceRole);

const agentCtx = {
  user: { sub: 'user-1', email: 'karim@example.com' },
  marketplaceRole: 'AGENT' as const,
};

function req(): NextRequest {
  return new NextRequest('http://test/api/subscriptions/me');
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/subscriptions/me', () => {
  it('returns a synthetic INACTIVE row (plan derived from role) when no ProSubscription exists', async () => {
    mockRequireAnyMarketplaceRole.mockResolvedValue(agentCtx);
    prismaMock.proSubscription.findUnique.mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subscription).toMatchObject({
      plan: 'AGENT_PRO',
      status: 'INACTIVE',
      isPro: false,
    });
  });

  it('returns the existing row and isPro:true for ACTIVE', async () => {
    mockRequireAnyMarketplaceRole.mockResolvedValue(agentCtx);
    prismaMock.proSubscription.findUnique.mockResolvedValue({
      plan: 'AGENT_PRO',
      status: 'ACTIVE',
      currentPeriodEnd: new Date('2026-07-01'),
      graceEndsAt: null,
      updatedAt: new Date('2026-06-01'),
    } as never);
    const res = await GET(req());
    const body = await res.json();
    expect(body.subscription.status).toBe('ACTIVE');
    expect(body.subscription.isPro).toBe(true);
  });

  it('marks GRACE as isPro:true (still has Pro benefits)', async () => {
    mockRequireAnyMarketplaceRole.mockResolvedValue(agentCtx);
    prismaMock.proSubscription.findUnique.mockResolvedValue({
      plan: 'AGENT_PRO',
      status: 'GRACE',
      currentPeriodEnd: new Date('2026-06-01'),
      graceEndsAt: new Date('2026-06-08'),
      updatedAt: new Date('2026-06-01'),
    } as never);
    const res = await GET(req());
    const body = await res.json();
    expect(body.subscription.isPro).toBe(true);
  });
});
