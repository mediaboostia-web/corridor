// GET /api/admin/products — moderation queue listing.
import { prismaMock } from '@/test-utils/prisma-mock';
import { it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/server/middleware', () => ({
  requireAdmin: vi.fn(),
}));
vi.mock('@/lib/server/middleware/rate-limit-by-userid', () => ({
  enforceAdminRateLimit: vi.fn(),
}));

import { requireAdmin } from '@/lib/server/middleware';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { GET } from './route';

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockRateLimit = vi.mocked(enforceAdminRateLimit);

const adminCtx = {
  user: { sub: 'admin-1', email: 'admin@test.local' },
  admin: { id: 'admin-1', email: 'admin@test.local', role: 'ADMIN' as const },
};

function req(qs = ''): NextRequest {
  return new NextRequest(`http://localhost/api/admin/products${qs}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(adminCtx);
  mockRateLimit.mockResolvedValue(null);
  prismaMock.product.findMany.mockResolvedValue([]);
});

it('passes through requireAdmin short-circuit', async () => {
  mockRequireAdmin.mockResolvedValueOnce(
    NextResponse.json({ error: 'ADMIN_REQUIRED' }, { status: 403 }),
  );
  const res = await GET(req());
  expect(res.status).toBe(403);
});

it('defaults to status=PENDING', async () => {
  await GET(req());
  expect(prismaMock.product.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: expect.objectContaining({ status: 'PENDING' }) }),
  );
});

it('honors an explicit ?status= filter', async () => {
  await GET(req('?status=PUBLISHED'));
  expect(prismaMock.product.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: expect.objectContaining({ status: 'PUBLISHED' }) }),
  );
});

it('resolves media URLs for the returned page', async () => {
  prismaMock.product.findMany.mockResolvedValue([
    {
      id: 'prod-1',
      name: 'Sac',
      category: 'Textiles',
      description: 'desc',
      priceAmount: 1000,
      currency: 'XOF',
      minQuantity: 1,
      status: 'PENDING',
      rejectionReason: null,
      createdAt: new Date('2026-01-01'),
      wholesalerProfile: { id: 'shop-1', shopName: 'Shop', slug: 'shop' },
      media: [{ fileUploadId: 'up-1', position: 0 }],
    },
  ] as never);
  prismaMock.fileUpload.findMany.mockResolvedValue([{ id: 'up-1', key: 'shop-1/photo' }] as never);

  const res = await GET(req());
  const body = await res.json();
  expect(body.items[0].media[0].url).toContain('shop-1/photo');
});
