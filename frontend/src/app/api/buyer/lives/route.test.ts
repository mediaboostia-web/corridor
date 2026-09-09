// GET /api/buyer/lives — full lives listing (upcoming/historique) across
// all wholesalers.
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
  return new NextRequest(`http://localhost/api/buyer/lives${qs}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireMarketplaceRole.mockResolvedValue(authedCtx);
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

it('defaults to scope=upcoming: not-CANCELLED and scheduledEnd >= now', async () => {
  await GET(req());
  expect(prismaMock.liveAnnouncement.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        status: { not: 'CANCELLED' },
        scheduledEnd: { gte: new Date('2026-06-01T12:00:00.000Z') },
      }),
    }),
  );
});

it('scope=past matches CANCELLED or scheduledEnd < now', async () => {
  await GET(req('?scope=past'));
  expect(prismaMock.liveAnnouncement.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        OR: [
          { status: 'CANCELLED' },
          { scheduledEnd: { lt: new Date('2026-06-01T12:00:00.000Z') } },
        ],
      }),
    }),
  );
});

it('attaches derivedStatus and the wholesaler shop info per item', async () => {
  prismaMock.liveAnnouncement.findMany.mockResolvedValue([
    {
      id: 'live-1',
      title: 'Déstockage',
      externalLink: 'https://tiktok.com/@shop/live',
      scheduledStart: new Date('2026-06-01T11:00:00.000Z'),
      scheduledEnd: new Date('2026-06-01T13:00:00.000Z'),
      status: 'SCHEDULED',
      createdAt: new Date('2026-05-30'),
      wholesalerProfile: { shopName: 'Shop', slug: 'shop' },
    },
  ] as never);

  const res = await GET(req());
  const body = await res.json();
  expect(body.items[0].derivedStatus).toBe('LIVE');
  expect(body.items[0].wholesalerProfile).toEqual({ shopName: 'Shop', slug: 'shop' });
});
