// GET /api/agent/missions — Phase 4 "Mes missions" list.
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
  user: { sub: 'user-1', email: 'karim@example.com' },
  marketplaceRole: 'AGENT' as const,
};

function req(qs = ''): NextRequest {
  return new NextRequest(`http://localhost/api/agent/missions${qs}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  mockRequireMarketplaceRole.mockResolvedValue(authedCtx);
});

it('returns 404 PROFILE_NOT_FOUND when no AgentProfile exists', async () => {
  prismaMock.agentProfile.findUnique.mockResolvedValue(null);
  const res = await GET(req());
  expect(res.status).toBe(404);
});

it('lists missions scoped to the caller agentProfileId', async () => {
  prismaMock.agentProfile.findUnique.mockResolvedValue({ id: 'agent-1' } as never);
  prismaMock.mission.findMany.mockResolvedValue([
    {
      id: 'mission-1',
      status: 'RECU',
      agreedCommissionAmount: 5000,
      currency: 'XOF',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
      sourcingRequest: { id: 'req-1', title: 'Robes wax', deliveryCountry: 'Gabon' },
    },
  ] as never);

  const res = await GET(req());
  expect(res.status).toBe(200);
  expect(prismaMock.mission.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: expect.objectContaining({ agentProfileId: 'agent-1' }) }),
  );
  const body = await res.json();
  expect(body.items).toHaveLength(1);
});

it('filters by ?status=', async () => {
  prismaMock.agentProfile.findUnique.mockResolvedValue({ id: 'agent-1' } as never);
  prismaMock.mission.findMany.mockResolvedValue([]);
  await GET(req('?status=EXPEDIE'));
  expect(prismaMock.mission.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: expect.objectContaining({ status: 'EXPEDIE' }) }),
  );
});
