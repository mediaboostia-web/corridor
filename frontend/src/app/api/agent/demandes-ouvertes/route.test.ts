// GET /api/agent/demandes-ouvertes — Phase 3 open-request browsing queue.
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
  return new NextRequest(`http://localhost/api/agent/demandes-ouvertes${qs}`);
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

it('lists OPEN requests and annotates the caller own candidature status', async () => {
  prismaMock.agentProfile.findUnique.mockResolvedValue({ id: 'agent-1' } as never);
  prismaMock.sourcingRequest.findMany.mockResolvedValue([
    {
      id: 'req-1',
      title: 'Robes wax',
      description: 'desc',
      budgetAmount: 50000,
      currency: 'XOF',
      quantity: 3,
      deliveryCountry: 'Gabon',
      createdAt: new Date('2026-01-01'),
      media: [],
    },
  ] as never);
  prismaMock.candidature.findMany.mockResolvedValue([
    { id: 'cand-1', sourcingRequestId: 'req-1', status: 'PENDING' },
  ] as never);

  const res = await GET(req());
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(prismaMock.sourcingRequest.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: expect.objectContaining({ status: 'OPEN' }) }),
  );
  expect(body.items).toHaveLength(1);
  expect(body.items[0]).toMatchObject({
    id: 'req-1',
    myCandidatureId: 'cand-1',
    myCandidatureStatus: 'PENDING',
  });
});

it('marks items with no candidature as null', async () => {
  prismaMock.agentProfile.findUnique.mockResolvedValue({ id: 'agent-1' } as never);
  prismaMock.sourcingRequest.findMany.mockResolvedValue([
    {
      id: 'req-2',
      title: 'Chaussures',
      description: 'desc',
      budgetAmount: null,
      currency: 'XOF',
      quantity: null,
      deliveryCountry: 'Togo',
      createdAt: new Date('2026-01-01'),
      media: [],
    },
  ] as never);
  prismaMock.candidature.findMany.mockResolvedValue([]);

  const res = await GET(req());
  const body = await res.json();
  expect(body.items[0]).toMatchObject({ myCandidatureId: null, myCandidatureStatus: null });
});
