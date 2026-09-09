// GET /api/wholesaler/missions — Phase 4 read-only "/wholesaler/commandes".
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies, __cookieStore } from '@/test-utils/mock-cookies';
import { it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

mockNextCookies();

vi.mock('@/lib/server/middleware', () => ({
  requireMarketplaceRole: vi.fn(),
}));

import { requireMarketplaceRole } from '@/lib/server/middleware';
import { GET } from './route';

const mockRequireMarketplaceRole = vi.mocked(requireMarketplaceRole);

const authedCtx = {
  user: { sub: 'user-1', email: 'maridiath@example.com' },
  marketplaceRole: 'WHOLESALER' as const,
};

function req(qs = ''): NextRequest {
  return new NextRequest(`http://localhost/api/wholesaler/missions${qs}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  mockRequireMarketplaceRole.mockResolvedValue(authedCtx);
});

it('returns 404 PROFILE_NOT_FOUND when no WholesalerProfile exists', async () => {
  prismaMock.wholesalerProfile.findUnique.mockResolvedValue(null);
  const res = await GET(req());
  expect(res.status).toBe(404);
});

it('lists missions scoped to the caller wholesalerProfileId', async () => {
  prismaMock.wholesalerProfile.findUnique.mockResolvedValue({ id: 'wp-1' } as never);
  prismaMock.mission.findMany.mockResolvedValue([
    {
      id: 'mission-1',
      status: 'EN_ACHAT',
      agreedCommissionAmount: 5000,
      currency: 'XOF',
      createdAt: new Date('2026-01-01'),
      sourcingRequest: { id: 'req-1', title: 'Robes wax', deliveryCountry: 'Gabon' },
      agentProfile: { id: 'agent-1', displayName: 'Karim' },
    },
  ] as never);

  const res = await GET(req());
  expect(res.status).toBe(200);
  expect(prismaMock.mission.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: expect.objectContaining({ wholesalerProfileId: 'wp-1' }) }),
  );
  const body = await res.json();
  expect(body.items).toHaveLength(1);
});
