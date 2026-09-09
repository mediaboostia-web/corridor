// GET /api/boutiques/[slug] — fully public shop page data.
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies, __cookieStore } from '@/test-utils/mock-cookies';
import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

mockNextCookies();

import { GET } from './route';

function req(): NextRequest {
  return new NextRequest('http://localhost/api/boutiques/maridiath');
}
function ctx(slug = 'maridiath') {
  return { params: Promise.resolve({ slug }) };
}

const activeProfile = {
  id: 'shop-1',
  userId: 'user-shop-1',
  shopName: 'Maridiath Shop',
  slug: 'maridiath',
  description: 'Grossiste textiles à Dantokpa.',
  locationCity: 'Cotonou',
  locationDetail: 'Dantokpa',
  hours: '8h-18h',
  whatsappLink: 'https://wa.me/22900000000',
  logoUploadId: null,
  coverUploadId: null,
  status: 'ACTIVE',
  createdAt: new Date('2026-01-01'),
};

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  prismaMock.wholesalerProfile.update.mockResolvedValue({} as never);
  prismaMock.liveAnnouncement.findFirst.mockResolvedValue(null);
  prismaMock.product.findMany.mockResolvedValue([]);
  prismaMock.proSubscription.findUnique.mockResolvedValue(null);
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-01T12:00:00.000Z'));
});
afterEach(() => vi.useRealTimers());

it('returns 404 SHOP_NOT_FOUND when the slug does not exist', async () => {
  prismaMock.wholesalerProfile.findUnique.mockResolvedValue(null);
  const res = await GET(req(), ctx());
  expect(res.status).toBe(404);
});

it('returns 404 SHOP_NOT_FOUND for a suspended shop', async () => {
  prismaMock.wholesalerProfile.findUnique.mockResolvedValue({
    ...activeProfile,
    status: 'SUSPENDED',
  } as never);
  const res = await GET(req(), ctx());
  expect(res.status).toBe(404);
});

it('returns profile + published products + a currently-LIVE announcement', async () => {
  prismaMock.wholesalerProfile.findUnique.mockResolvedValue(activeProfile as never);
  prismaMock.product.findMany.mockResolvedValue([
    {
      id: 'prod-1',
      name: 'Sac à main',
      category: 'Textiles',
      description: 'Sac artisanal.',
      priceAmount: 15000,
      currency: 'XOF',
      minQuantity: 1,
      availability: 'AVAILABLE',
      media: [],
    },
  ] as never);
  prismaMock.liveAnnouncement.findFirst.mockResolvedValue({
    id: 'live-1',
    title: 'Déstockage',
    externalLink: 'https://tiktok.com/@shop/live',
    scheduledStart: new Date('2026-06-01T11:00:00.000Z'),
    scheduledEnd: new Date('2026-06-01T13:00:00.000Z'),
    status: 'SCHEDULED',
  } as never);

  const res = await GET(req(), ctx());
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.profile.id).toBe('shop-1');
  expect(body.profile.shopName).toBe('Maridiath Shop');
  expect(body.profile.isPro).toBe(false);
  expect(body.products).toHaveLength(1);
  expect(body.live.derivedStatus).toBe('LIVE');
  expect(prismaMock.wholesalerProfile.update).toHaveBeenCalledWith(
    expect.objectContaining({ data: { viewCount: { increment: 1 } } }),
  );
});

it('marks isPro true when the shop owner has an ACTIVE ProSubscription', async () => {
  prismaMock.wholesalerProfile.findUnique.mockResolvedValue(activeProfile as never);
  prismaMock.proSubscription.findUnique.mockResolvedValue({ status: 'ACTIVE' } as never);
  const res = await GET(req(), ctx());
  const body = await res.json();
  expect(body.profile.isPro).toBe(true);
  expect(prismaMock.proSubscription.findUnique).toHaveBeenCalledWith(
    expect.objectContaining({ where: { userId: 'user-shop-1' } }),
  );
});

it('only queries PUBLISHED products for the given shop', async () => {
  prismaMock.wholesalerProfile.findUnique.mockResolvedValue(activeProfile as never);
  await GET(req(), ctx());
  expect(prismaMock.product.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { wholesalerProfileId: 'shop-1', status: 'PUBLISHED' },
    }),
  );
});
