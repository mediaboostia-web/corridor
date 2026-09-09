// POST /api/subscriptions/cancel — Phase 7.
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies } from '@/test-utils/mock-cookies';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

mockNextCookies();

vi.mock('@/lib/server/middleware', () => ({
  requireAnyMarketplaceRole: vi.fn(),
}));

import { requireAnyMarketplaceRole } from '@/lib/server/middleware';
import { POST } from './route';

const mockRequireAnyMarketplaceRole = vi.mocked(requireAnyMarketplaceRole);

const agentCtx = {
  user: { sub: 'user-1', email: 'karim@example.com' },
  marketplaceRole: 'AGENT' as const,
};

function req(): NextRequest {
  return new NextRequest('http://test/api/subscriptions/cancel', {
    method: 'POST',
    headers: { 'x-csrf-token': 'csrf-tok', cookie: 'app-csrf=csrf-tok' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/subscriptions/cancel', () => {
  it('returns 409 SUBSCRIPTION_NOT_ACTIVE when there is no active/grace subscription', async () => {
    mockRequireAnyMarketplaceRole.mockResolvedValue(agentCtx);
    prismaMock.proSubscription.findUnique.mockResolvedValue(null);
    const res = await POST(req());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('SUBSCRIPTION_NOT_ACTIVE');
  });

  it('cancels an ACTIVE subscription immediately (isPro:false in the response)', async () => {
    mockRequireAnyMarketplaceRole.mockResolvedValue(agentCtx);
    prismaMock.proSubscription.findUnique.mockResolvedValue({ status: 'ACTIVE' } as never);
    prismaMock.proSubscription.update.mockResolvedValue({
      plan: 'AGENT_PRO',
      status: 'CANCELLED',
      currentPeriodEnd: new Date('2026-07-01'),
      graceEndsAt: null,
    } as never);
    const res = await POST(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subscription.status).toBe('CANCELLED');
    expect(body.subscription.isPro).toBe(false);
    expect(prismaMock.proSubscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'CANCELLED', graceEndsAt: null } }),
    );
  });

  it('also allows cancelling a GRACE subscription', async () => {
    mockRequireAnyMarketplaceRole.mockResolvedValue(agentCtx);
    prismaMock.proSubscription.findUnique.mockResolvedValue({ status: 'GRACE' } as never);
    prismaMock.proSubscription.update.mockResolvedValue({
      plan: 'AGENT_PRO',
      status: 'CANCELLED',
      currentPeriodEnd: null,
      graceEndsAt: null,
    } as never);
    const res = await POST(req());
    expect(res.status).toBe(200);
  });
});
