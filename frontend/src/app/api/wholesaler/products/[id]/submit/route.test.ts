// POST /api/wholesaler/products/[id]/submit — DRAFT -> PENDING.
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
import { POST } from './route';

const mockRequireMarketplaceRole = vi.mocked(requireMarketplaceRole);
const mockVerifyCsrf = vi.mocked(verifyCsrf);

const authedCtx = {
  user: { sub: 'user-1', email: 'maridiath@example.com' },
  marketplaceRole: 'WHOLESALER' as const,
};

function req(): NextRequest {
  const headers = new Headers({ 'x-csrf-token': 'csrf-token', cookie: 'app-csrf=csrf-token' });
  return new NextRequest('http://localhost/api/wholesaler/products/prod-1/submit', {
    method: 'POST',
    headers,
  });
}
function ctx(id = 'prod-1') {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  mockRequireMarketplaceRole.mockResolvedValue(authedCtx);
  mockVerifyCsrf.mockReturnValue(null);
  prismaMock.wholesalerProfile.findUnique.mockResolvedValue({ id: 'shop-1' } as never);
});

it('returns 403 on missing CSRF', async () => {
  mockVerifyCsrf.mockReturnValueOnce(NextResponse.json({ error: 'CSRF_INVALID' }, { status: 403 }));
  const res = await POST(req(), ctx());
  expect(res.status).toBe(403);
});

it('returns 404 for a product owned by another wholesaler', async () => {
  prismaMock.product.findUnique.mockResolvedValue({
    id: 'prod-1',
    wholesalerProfileId: 'other-shop',
    status: 'DRAFT',
    _count: { media: 1 },
  } as never);
  const res = await POST(req(), ctx());
  expect(res.status).toBe(404);
});

it('returns 409 PRODUCT_NOT_DRAFT when status is not DRAFT', async () => {
  prismaMock.product.findUnique.mockResolvedValue({
    id: 'prod-1',
    wholesalerProfileId: 'shop-1',
    status: 'PENDING',
    _count: { media: 1 },
  } as never);
  const res = await POST(req(), ctx());
  expect(res.status).toBe(409);
  const body = await res.json();
  expect(body).toMatchObject({ error: 'PRODUCT_NOT_DRAFT' });
});

it('returns 400 PRODUCT_MISSING_PHOTOS when there are zero media rows', async () => {
  prismaMock.product.findUnique.mockResolvedValue({
    id: 'prod-1',
    wholesalerProfileId: 'shop-1',
    status: 'DRAFT',
    _count: { media: 0 },
  } as never);
  const res = await POST(req(), ctx());
  expect(res.status).toBe(400);
  const body = await res.json();
  expect(body).toMatchObject({ error: 'PRODUCT_MISSING_PHOTOS' });
});

it('transitions DRAFT -> PENDING and clears any prior moderation trace', async () => {
  prismaMock.product.findUnique.mockResolvedValue({
    id: 'prod-1',
    wholesalerProfileId: 'shop-1',
    status: 'DRAFT',
    _count: { media: 2 },
  } as never);
  prismaMock.product.update.mockResolvedValue({ id: 'prod-1', status: 'PENDING' } as never);

  const res = await POST(req(), ctx());
  expect(res.status).toBe(200);
  expect(prismaMock.product.update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: {
        status: 'PENDING',
        moderatedByUserId: null,
        moderatedAt: null,
        rejectionReason: null,
      },
    }),
  );
});
