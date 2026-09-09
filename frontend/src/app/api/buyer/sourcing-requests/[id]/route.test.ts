// GET/PATCH /api/buyer/sourcing-requests/[id] — detail + cancel-only.
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies, __cookieStore } from '@/test-utils/mock-cookies';
import { it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

mockNextCookies();

vi.mock('@/lib/server/middleware', () => ({
  requireMarketplaceRole: vi.fn(),
}));
vi.mock('@/lib/server/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/server/auth')>('@/lib/server/auth');
  return { ...actual, verifyCsrf: vi.fn() };
});

import { requireMarketplaceRole } from '@/lib/server/middleware';
import { verifyCsrf } from '@/lib/server/auth';
import { GET, PATCH } from './route';

const mockRequireMarketplaceRole = vi.mocked(requireMarketplaceRole);
const mockVerifyCsrf = vi.mocked(verifyCsrf);

const authedCtx = {
  user: { sub: 'user-1', email: 'jenni@example.com' },
  marketplaceRole: 'BUYER' as const,
};

function req(method: string, body?: unknown): NextRequest {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (method !== 'GET') {
    headers.set('x-csrf-token', 'csrf-token');
    headers.set('cookie', 'app-csrf=csrf-token');
  }
  return new NextRequest('http://localhost/api/buyer/sourcing-requests/req-1', {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
function ctx(id = 'req-1') {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  mockRequireMarketplaceRole.mockResolvedValue(authedCtx);
  mockVerifyCsrf.mockReturnValue(null);
});

const ownRequest = {
  id: 'req-1',
  buyerId: 'user-1',
  title: 'Robes africaines',
  description: 'desc',
  productId: null,
  tiktokLink: null,
  facebookLink: null,
  budgetAmount: 50000,
  currency: 'XOF',
  quantity: 3,
  deliveryCountry: 'Gabon',
  status: 'OPEN',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  media: [],
};

it('GET returns 404 for a request owned by another buyer', async () => {
  prismaMock.sourcingRequest.findUnique.mockResolvedValue({
    ...ownRequest,
    buyerId: 'someone-else',
  } as never);
  const res = await GET(req('GET'), ctx());
  expect(res.status).toBe(404);
});

it('GET returns the request when owned', async () => {
  prismaMock.sourcingRequest.findUnique.mockResolvedValue(ownRequest as never);
  prismaMock.candidature.findMany.mockResolvedValue([]);
  const res = await GET(req('GET'), ctx());
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.request.id).toBe('req-1');
  expect(body.candidatures).toEqual([]);
});

it('GET includes candidatures with agent profile info', async () => {
  prismaMock.sourcingRequest.findUnique.mockResolvedValue(ownRequest as never);
  prismaMock.candidature.findMany.mockResolvedValue([
    {
      id: 'cand-1',
      proposedCommissionAmount: 5000,
      currency: 'XOF',
      message: 'Je peux trouver ce produit rapidement.',
      status: 'PENDING',
      createdAt: new Date('2026-01-02'),
      agentProfile: {
        id: 'agent-1',
        displayName: 'Karim',
        publicSlug: 'karim',
        actionZone: 'Dantokpa',
        missionCount: 5,
        avgRating: 4.5,
        reviewCount: 5,
      },
    },
  ] as never);
  const res = await GET(req('GET'), ctx());
  const body = await res.json();
  expect(body.candidatures).toHaveLength(1);
  expect(body.candidatures[0].agentProfile.displayName).toBe('Karim');
});

it('PATCH returns 403 on missing CSRF', async () => {
  mockVerifyCsrf.mockReturnValueOnce(NextResponse.json({ error: 'CSRF_INVALID' }, { status: 403 }));
  const res = await PATCH(req('PATCH', { status: 'CANCELLED' }), ctx());
  expect(res.status).toBe(403);
});

it('PATCH returns 404 for a request owned by another buyer', async () => {
  prismaMock.sourcingRequest.findUnique.mockResolvedValue({
    id: 'req-1',
    buyerId: 'someone-else',
    status: 'OPEN',
  } as never);
  const res = await PATCH(req('PATCH', { status: 'CANCELLED' }), ctx());
  expect(res.status).toBe(404);
});

it('PATCH returns 409 REQUEST_NOT_CANCELLABLE when status is not OPEN', async () => {
  prismaMock.sourcingRequest.findUnique.mockResolvedValue({
    id: 'req-1',
    buyerId: 'user-1',
    status: 'IN_PROGRESS',
  } as never);
  const res = await PATCH(req('PATCH', { status: 'CANCELLED' }), ctx());
  expect(res.status).toBe(409);
  expect(prismaMock.sourcingRequest.update).not.toHaveBeenCalled();
});

it('PATCH cancels an OPEN request', async () => {
  prismaMock.sourcingRequest.findUnique.mockResolvedValue({
    id: 'req-1',
    buyerId: 'user-1',
    status: 'OPEN',
  } as never);
  prismaMock.sourcingRequest.update.mockResolvedValue({
    ...ownRequest,
    status: 'CANCELLED',
  } as never);

  const res = await PATCH(req('PATCH', { status: 'CANCELLED' }), ctx());
  expect(res.status).toBe(200);
  expect(prismaMock.sourcingRequest.update).toHaveBeenCalledWith(
    expect.objectContaining({ data: { status: 'CANCELLED' } }),
  );
});
