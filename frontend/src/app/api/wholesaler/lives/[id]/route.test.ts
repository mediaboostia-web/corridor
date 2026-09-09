// PATCH /api/wholesaler/lives/[id] — cancel-only mutation.
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies, __cookieStore } from '@/test-utils/mock-cookies';
import { it, expect, vi, beforeEach, afterEach } from 'vitest';
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
import { PATCH } from './route';

const mockRequireMarketplaceRole = vi.mocked(requireMarketplaceRole);
const mockVerifyCsrf = vi.mocked(verifyCsrf);

const authedCtx = {
  user: { sub: 'user-1', email: 'maridiath@example.com' },
  marketplaceRole: 'WHOLESALER' as const,
};

function req(body: unknown = { status: 'CANCELLED' }): NextRequest {
  const headers = new Headers({
    'content-type': 'application/json',
    'x-csrf-token': 'csrf-token',
    cookie: 'app-csrf=csrf-token',
  });
  return new NextRequest('http://localhost/api/wholesaler/lives/live-1', {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
}
function ctx(id = 'live-1') {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  mockRequireMarketplaceRole.mockResolvedValue(authedCtx);
  mockVerifyCsrf.mockReturnValue(null);
  prismaMock.wholesalerProfile.findUnique.mockResolvedValue({ id: 'shop-1' } as never);
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-01T12:00:00.000Z'));
});
afterEach(() => vi.useRealTimers());

it('returns 403 on missing CSRF', async () => {
  mockVerifyCsrf.mockReturnValueOnce(NextResponse.json({ error: 'CSRF_INVALID' }, { status: 403 }));
  const res = await PATCH(req(), ctx());
  expect(res.status).toBe(403);
});

it('returns 400 for any status other than CANCELLED', async () => {
  const res = await PATCH(req({ status: 'ENDED' }), ctx());
  expect(res.status).toBe(400);
});

it('returns 404 for a live owned by another wholesaler', async () => {
  prismaMock.liveAnnouncement.findUnique.mockResolvedValue({
    id: 'live-1',
    wholesalerProfileId: 'other-shop',
    status: 'SCHEDULED',
    scheduledStart: new Date('2026-06-02'),
    scheduledEnd: new Date('2026-06-03'),
  } as never);
  const res = await PATCH(req(), ctx());
  expect(res.status).toBe(404);
});

it('returns 409 LIVE_NOT_CANCELLABLE when the window has already ended', async () => {
  prismaMock.liveAnnouncement.findUnique.mockResolvedValue({
    id: 'live-1',
    wholesalerProfileId: 'shop-1',
    status: 'SCHEDULED',
    scheduledStart: new Date('2026-05-01T11:00:00.000Z'),
    scheduledEnd: new Date('2026-05-01T13:00:00.000Z'),
  } as never);
  const res = await PATCH(req(), ctx());
  expect(res.status).toBe(409);
});

it('returns 409 LIVE_NOT_CANCELLABLE when already CANCELLED', async () => {
  prismaMock.liveAnnouncement.findUnique.mockResolvedValue({
    id: 'live-1',
    wholesalerProfileId: 'shop-1',
    status: 'CANCELLED',
    scheduledStart: new Date('2026-06-02T11:00:00.000Z'),
    scheduledEnd: new Date('2026-06-02T13:00:00.000Z'),
  } as never);
  const res = await PATCH(req(), ctx());
  expect(res.status).toBe(409);
});

it('cancels an upcoming (SCHEDULED-derived) announcement', async () => {
  prismaMock.liveAnnouncement.findUnique.mockResolvedValue({
    id: 'live-1',
    wholesalerProfileId: 'shop-1',
    status: 'SCHEDULED',
    scheduledStart: new Date('2026-06-02T11:00:00.000Z'),
    scheduledEnd: new Date('2026-06-02T13:00:00.000Z'),
  } as never);
  prismaMock.liveAnnouncement.update.mockResolvedValue({
    id: 'live-1',
    status: 'CANCELLED',
  } as never);

  const res = await PATCH(req(), ctx());
  expect(res.status).toBe(200);
  expect(prismaMock.liveAnnouncement.update).toHaveBeenCalledWith(
    expect.objectContaining({ data: { status: 'CANCELLED' } }),
  );
});

it('cancels an in-progress (LIVE-derived) announcement', async () => {
  prismaMock.liveAnnouncement.findUnique.mockResolvedValue({
    id: 'live-1',
    wholesalerProfileId: 'shop-1',
    status: 'SCHEDULED',
    scheduledStart: new Date('2026-06-01T11:00:00.000Z'),
    scheduledEnd: new Date('2026-06-01T13:00:00.000Z'),
  } as never);
  prismaMock.liveAnnouncement.update.mockResolvedValue({
    id: 'live-1',
    status: 'CANCELLED',
  } as never);

  const res = await PATCH(req(), ctx());
  expect(res.status).toBe(200);
});
