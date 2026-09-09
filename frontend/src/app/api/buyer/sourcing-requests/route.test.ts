// GET/POST /api/buyer/sourcing-requests — Phase 2 "Demander un sourcing" +
// "Mes demandes" list.
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
import { GET, POST } from './route';

const mockRequireMarketplaceRole = vi.mocked(requireMarketplaceRole);
const mockVerifyCsrf = vi.mocked(verifyCsrf);

const authedCtx = {
  user: { sub: 'user-1', email: 'jenni@example.com' },
  marketplaceRole: 'BUYER' as const,
};

function req(method: string, path: string, body?: unknown): NextRequest {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (method !== 'GET') {
    headers.set('x-csrf-token', 'csrf-token');
    headers.set('cookie', 'app-csrf=csrf-token');
  }
  return new NextRequest(`http://localhost/api/buyer/sourcing-requests${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  mockRequireMarketplaceRole.mockResolvedValue(authedCtx);
  mockVerifyCsrf.mockReturnValue(null);
  prismaMock.sourcingRequest.count.mockResolvedValue(0);
});

const baseRequest = {
  id: 'req-1',
  buyerId: 'user-1',
  title: 'Robes africaines',
  description: "J'aimerais recevoir des propositions pour des robes wax.",
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

it('GET lists requests scoped to the caller buyerId', async () => {
  prismaMock.sourcingRequest.findMany.mockResolvedValue([baseRequest] as never);
  const res = await GET(req('GET', ''));
  expect(res.status).toBe(200);
  expect(prismaMock.sourcingRequest.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: expect.objectContaining({ buyerId: 'user-1' }) }),
  );
});

const validBody = {
  title: 'Robes africaines',
  description: "J'aimerais recevoir des propositions pour des robes wax.",
  deliveryCountry: 'Gabon',
  budgetAmount: 50000,
  quantity: 3,
};

it('POST returns 403 on missing CSRF', async () => {
  mockVerifyCsrf.mockReturnValueOnce(NextResponse.json({ error: 'CSRF_INVALID' }, { status: 403 }));
  const res = await POST(req('POST', '', validBody));
  expect(res.status).toBe(403);
  expect(prismaMock.sourcingRequest.create).not.toHaveBeenCalled();
});

it('POST returns 400 VALIDATION_FAILED for a too-short description', async () => {
  const res = await POST(req('POST', '', { ...validBody, description: 'short' }));
  expect(res.status).toBe(400);
});

it('POST returns 409 TOO_MANY_ACTIVE_REQUESTS at the 3-active cap', async () => {
  prismaMock.sourcingRequest.count.mockResolvedValue(3);
  const res = await POST(req('POST', '', validBody));
  expect(res.status).toBe(409);
  const body = await res.json();
  expect(body).toMatchObject({ error: 'TOO_MANY_ACTIVE_REQUESTS' });
  expect(prismaMock.sourcingRequest.create).not.toHaveBeenCalled();
});

it('POST returns 400 PRODUCT_NOT_AVAILABLE when productId points to a non-PUBLISHED product', async () => {
  prismaMock.product.findUnique.mockResolvedValue({ status: 'DRAFT' } as never);
  const res = await POST(req('POST', '', { ...validBody, productId: 'prod-1' }));
  expect(res.status).toBe(400);
  const body = await res.json();
  expect(body).toMatchObject({ error: 'PRODUCT_NOT_AVAILABLE' });
});

it('POST returns 400 UPLOAD_NOT_FOUND when a media id is not owned by the caller', async () => {
  prismaMock.fileUpload.count.mockResolvedValue(0);
  const res = await POST(req('POST', '', { ...validBody, mediaFileUploadIds: ['not-mine'] }));
  expect(res.status).toBe(400);
  const body = await res.json();
  expect(body).toMatchObject({ error: 'UPLOAD_NOT_FOUND' });
});

it('POST creates an OPEN request scoped to the caller', async () => {
  prismaMock.sourcingRequest.create.mockResolvedValue(baseRequest as never);
  const res = await POST(req('POST', '', validBody));
  expect(res.status).toBe(201);
  expect(prismaMock.sourcingRequest.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        buyerId: 'user-1',
        title: 'Robes africaines',
        productId: null,
      }),
    }),
  );
});
