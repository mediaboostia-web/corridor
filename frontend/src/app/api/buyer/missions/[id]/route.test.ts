// GET /api/buyer/missions/[id] — Phase 4 mission detail for the owning buyer.
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
  user: { sub: 'user-1', email: 'jenni@example.com' },
  marketplaceRole: 'BUYER' as const,
};

function req(): NextRequest {
  return new NextRequest('http://localhost/api/buyer/missions/mission-1');
}
function ctx(id = 'mission-1') {
  return { params: Promise.resolve({ id }) };
}

const baseMission = {
  id: 'mission-1',
  status: 'RECU',
  agreedCommissionAmount: 5000,
  currency: 'XOF',
  deliveryConfirmedAt: null,
  autoClosedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  buyerId: 'user-1',
  agentProfile: {
    id: 'agent-1',
    displayName: 'Karim',
    publicSlug: 'karim',
    avgRating: null,
    reviewCount: 0,
  },
  wholesalerProfile: null,
  sourcingRequest: {
    id: 'req-1',
    title: 'Robes wax',
    description: 'desc',
    deliveryCountry: 'Gabon',
    quantity: 3,
  },
  statusEvents: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  mockRequireMarketplaceRole.mockResolvedValue(authedCtx);
});

it('returns 404 MISSION_NOT_FOUND for an unknown mission', async () => {
  prismaMock.mission.findUnique.mockResolvedValue(null);
  const res = await GET(req(), ctx());
  expect(res.status).toBe(404);
});

it('returns 404 MISSION_NOT_FOUND for a mission owned by another buyer', async () => {
  prismaMock.mission.findUnique.mockResolvedValue({
    ...baseMission,
    buyerId: 'someone-else',
  } as never);
  const res = await GET(req(), ctx());
  expect(res.status).toBe(404);
});

it('returns the mission detail when owned', async () => {
  prismaMock.mission.findUnique.mockResolvedValue(baseMission as never);
  const res = await GET(req(), ctx());
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.mission.id).toBe('mission-1');
  expect(body.mission.agentProfile.displayName).toBe('Karim');
});
