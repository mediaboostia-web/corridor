// GET /api/buyer/catalogue — the buyer feed (PUBLISHED products + a small
// upcoming/live-announcement list on the first page only).
import { prismaMock } from '@/test-utils/prisma-mock';
import { it, expect, vi, beforeEach, afterEach } from 'vitest';
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

function req(qs = ''): NextRequest {
  return new NextRequest(`http://localhost/api/buyer/catalogue${qs}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireMarketplaceRole.mockResolvedValue(authedCtx);
  prismaMock.product.findMany.mockResolvedValue([]);
  prismaMock.liveAnnouncement.findMany.mockResolvedValue([]);
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-01T12:00:00.000Z'));
});
afterEach(() => vi.useRealTimers());

it('passes through requireMarketplaceRole short-circuit', async () => {
  mockRequireMarketplaceRole.mockResolvedValueOnce(
    NextResponse.json({ error: 'MARKETPLACE_ROLE_REQUIRED' }, { status: 403 }),
  );
  const res = await GET(req());
  expect(res.status).toBe(403);
});

it('only queries PUBLISHED products', async () => {
  await GET(req());
  expect(prismaMock.product.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: expect.objectContaining({ status: 'PUBLISHED' }) }),
  );
});

it('filters by ?category= when provided', async () => {
  await GET(req('?category=Textiles'));
  expect(prismaMock.product.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: expect.objectContaining({ category: 'Textiles' }) }),
  );
});

it('includes liveAnnouncements on the first page (no cursor)', async () => {
  prismaMock.liveAnnouncement.findMany.mockResolvedValue([
    {
      id: 'live-1',
      title: 'Déstockage',
      externalLink: 'https://tiktok.com/@shop/live',
      scheduledStart: new Date('2026-06-01T11:00:00.000Z'),
      scheduledEnd: new Date('2026-06-01T13:00:00.000Z'),
      status: 'SCHEDULED',
      wholesalerProfile: { shopName: 'Shop', slug: 'shop' },
    },
  ] as never);

  const res = await GET(req());
  const body = await res.json();
  expect(body.liveAnnouncements).toHaveLength(1);
  expect(body.liveAnnouncements[0].derivedStatus).toBe('LIVE');
});

it('omits liveAnnouncements when a cursor is present (not the first page)', async () => {
  const res = await GET(req('?cursor=abc'));
  const body = await res.json();
  expect(body.liveAnnouncements).toEqual([]);
  expect(prismaMock.liveAnnouncement.findMany).not.toHaveBeenCalled();
});

it('resolves product media URLs and attaches the wholesaler shop info', async () => {
  prismaMock.product.findMany.mockResolvedValue([
    {
      id: 'prod-1',
      name: 'Sac',
      category: 'Textiles',
      description: 'desc',
      priceAmount: 1000,
      currency: 'XOF',
      minQuantity: 1,
      availability: 'AVAILABLE',
      createdAt: new Date(),
      wholesalerProfile: { shopName: 'Shop', slug: 'shop' },
      media: [{ fileUploadId: 'up-1', position: 0 }],
    },
  ] as never);
  prismaMock.fileUpload.findMany.mockResolvedValue([{ id: 'up-1', key: 'shop-1/photo' }] as never);

  const res = await GET(req());
  const body = await res.json();
  expect(body.items[0].wholesaler).toEqual({ shopName: 'Shop', slug: 'shop' });
  expect(body.items[0].media[0].url).toContain('shop-1/photo');
});
