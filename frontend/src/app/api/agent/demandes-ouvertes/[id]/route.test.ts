// GET /api/agent/demandes-ouvertes/[id] — Phase 3 request detail for candidater prefill.
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

function req(): NextRequest {
  return new NextRequest('http://localhost/api/agent/demandes-ouvertes/req-1');
}
function ctx(id = 'req-1') {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  mockRequireMarketplaceRole.mockResolvedValue(authedCtx);
});

it('returns 404 PROFILE_NOT_FOUND when no AgentProfile exists', async () => {
  prismaMock.agentProfile.findUnique.mockResolvedValue(null);
  const res = await GET(req(), ctx());
  expect(res.status).toBe(404);
});

it('returns 404 REQUEST_NOT_FOUND for an unknown request', async () => {
  prismaMock.agentProfile.findUnique.mockResolvedValue({ id: 'agent-1' } as never);
  prismaMock.sourcingRequest.findUnique.mockResolvedValue(null);
  const res = await GET(req(), ctx());
  expect(res.status).toBe(404);
});

it('returns the request detail with myCandidatureStatus null when the agent has not candidated', async () => {
  prismaMock.agentProfile.findUnique.mockResolvedValue({ id: 'agent-1' } as never);
  prismaMock.sourcingRequest.findUnique.mockResolvedValue({
    id: 'req-1',
    title: 'Robes wax',
    description: 'desc',
    tiktokLink: null,
    facebookLink: null,
    budgetAmount: 50000,
    currency: 'XOF',
    quantity: 3,
    deliveryCountry: 'Gabon',
    status: 'OPEN',
    createdAt: new Date('2026-01-01'),
    product: null,
    media: [],
  } as never);
  prismaMock.candidature.findUnique.mockResolvedValue(null);

  const res = await GET(req(), ctx());
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.request).toMatchObject({
    id: 'req-1',
    myCandidatureId: null,
    myCandidatureStatus: null,
  });
});

it('includes the caller own candidature status when present', async () => {
  prismaMock.agentProfile.findUnique.mockResolvedValue({ id: 'agent-1' } as never);
  prismaMock.sourcingRequest.findUnique.mockResolvedValue({
    id: 'req-1',
    title: 'Robes wax',
    description: 'desc',
    tiktokLink: null,
    facebookLink: null,
    budgetAmount: 50000,
    currency: 'XOF',
    quantity: 3,
    deliveryCountry: 'Gabon',
    status: 'OPEN',
    createdAt: new Date('2026-01-01'),
    product: null,
    media: [],
  } as never);
  prismaMock.candidature.findUnique.mockResolvedValue({ id: 'cand-1', status: 'PENDING' } as never);

  const res = await GET(req(), ctx());
  const body = await res.json();
  expect(body.request).toMatchObject({ myCandidatureId: 'cand-1', myCandidatureStatus: 'PENDING' });
});
