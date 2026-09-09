// GET /api/buyer/products/[id] — single PUBLISHED product for prefill.
import { prismaMock } from '@/test-utils/prisma-mock';
import { it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

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
  return new NextRequest('http://localhost/api/buyer/products/prod-1');
}
function ctx(id = 'prod-1') {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireMarketplaceRole.mockResolvedValue(authedCtx);
});

it('passes through requireMarketplaceRole short-circuit', async () => {
  mockRequireMarketplaceRole.mockResolvedValueOnce(
    NextResponse.json({ error: 'MARKETPLACE_ROLE_REQUIRED' }, { status: 403 }),
  );
  const res = await GET(req(), ctx());
  expect(res.status).toBe(403);
});

it('returns 404 for an unknown product', async () => {
  prismaMock.product.findUnique.mockResolvedValue(null);
  const res = await GET(req(), ctx());
  expect(res.status).toBe(404);
});

it('returns 404 for a non-PUBLISHED product (e.g. DRAFT)', async () => {
  prismaMock.product.findUnique.mockResolvedValue({
    id: 'prod-1',
    status: 'DRAFT',
    media: [],
    wholesalerProfile: { shopName: 'Shop', slug: 'shop' },
  } as never);
  const res = await GET(req(), ctx());
  expect(res.status).toBe(404);
});

it('returns the PUBLISHED product with resolved media', async () => {
  prismaMock.product.findUnique.mockResolvedValue({
    id: 'prod-1',
    name: 'Sac',
    category: 'Textiles',
    description: 'desc',
    priceAmount: 1000,
    currency: 'XOF',
    minQuantity: 1,
    availability: 'AVAILABLE',
    status: 'PUBLISHED',
    wholesalerProfile: { shopName: 'Shop', slug: 'shop' },
    media: [{ fileUploadId: 'up-1', position: 0 }],
  } as never);
  prismaMock.fileUpload.findMany.mockResolvedValue([{ id: 'up-1', key: 'shop-1/photo' }] as never);

  const res = await GET(req(), ctx());
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.product.name).toBe('Sac');
  expect(body.product.media[0].url).toContain('shop-1/photo');
});
