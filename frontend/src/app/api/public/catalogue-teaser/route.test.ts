// GET /api/public/catalogue-teaser — Phase 9, fully public homepage teaser.
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies, __cookieStore } from '@/test-utils/mock-cookies';
import { it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

mockNextCookies();

import { GET } from './route';

function req(): NextRequest {
  return new NextRequest('http://localhost/api/public/catalogue-teaser');
}

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
});

it('returns an empty list when there are no published products', async () => {
  prismaMock.product.findMany.mockResolvedValue([]);
  const res = await GET(req());
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ items: [] });
});

it('only queries PUBLISHED + AVAILABLE products, capped at 6', async () => {
  prismaMock.product.findMany.mockResolvedValue([]);
  await GET(req());
  const args = prismaMock.product.findMany.mock.calls[0]?.[0] as {
    where: { status: string; availability: string };
    take: number;
  };
  expect(args.where).toEqual({ status: 'PUBLISHED', availability: 'AVAILABLE' });
  expect(args.take).toBe(6);
});

it('maps products with resolved image URLs and shop info, no auth required', async () => {
  prismaMock.product.findMany.mockResolvedValue([
    {
      id: 'prod-1',
      name: 'Robe wax',
      priceAmount: 12000,
      currency: 'XOF',
      wholesalerProfile: { shopName: 'Maridiath Shop', slug: 'maridiath' },
      media: [{ fileUploadId: 'fu-1', position: 0 }],
    },
  ] as never);
  prismaMock.fileUpload.findMany.mockResolvedValue([
    { id: 'fu-1', key: 'products/robe-wax' },
  ] as never);

  const res = await GET(req());
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.items).toHaveLength(1);
  expect(body.items[0]).toMatchObject({
    id: 'prod-1',
    name: 'Robe wax',
    priceAmount: 12000,
    currency: 'XOF',
    wholesaler: { shopName: 'Maridiath Shop', slug: 'maridiath' },
  });
  expect(body.items[0].imageUrl).toContain('w_400');
});

it('sets imageUrl to null for a product with no media', async () => {
  prismaMock.product.findMany.mockResolvedValue([
    {
      id: 'prod-2',
      name: 'Sac en pagne',
      priceAmount: 5000,
      currency: 'XOF',
      wholesalerProfile: { shopName: 'Maridiath Shop', slug: 'maridiath' },
      media: [],
    },
  ] as never);

  const res = await GET(req());
  const body = await res.json();
  expect(body.items[0].imageUrl).toBeNull();
});
