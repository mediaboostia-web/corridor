// POST /api/buyer/missions/[id]/review — Phase 6 avis + recalcul note agent.
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
vi.mock('@/lib/server/notifications', () => ({
  createNotification: vi.fn().mockResolvedValue(null),
}));

import { requireMarketplaceRole } from '@/lib/server/middleware';
import { verifyCsrf } from '@/lib/server/auth';
import { createNotification } from '@/lib/server/notifications';
import { POST } from './route';

const mockRequireMarketplaceRole = vi.mocked(requireMarketplaceRole);
const mockVerifyCsrf = vi.mocked(verifyCsrf);
const mockCreateNotification = vi.mocked(createNotification);

const authedCtx = {
  user: { sub: 'buyer-1', email: 'jenni@example.com' },
  marketplaceRole: 'BUYER' as const,
};

function req(body?: unknown): NextRequest {
  const headers = new Headers({
    'content-type': 'application/json',
    'x-csrf-token': 'csrf-token',
    cookie: 'app-csrf=csrf-token',
  });
  return new NextRequest('http://localhost/api/buyer/missions/mission-1/review', {
    method: 'POST',
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
function ctx(id = 'mission-1') {
  return { params: Promise.resolve({ id }) };
}

function mockAggregate(avg: number | null, count: number): void {
  (
    prismaMock.review.aggregate as unknown as { mockResolvedValue: (v: unknown) => void }
  ).mockResolvedValue({ _avg: { rating: avg }, _count: count });
}

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  mockRequireMarketplaceRole.mockResolvedValue(authedCtx);
  mockVerifyCsrf.mockReturnValue(null);
  prismaMock.$transaction.mockImplementation(async (fn: unknown) => {
    if (typeof fn === 'function') return fn(prismaMock);
    return undefined;
  });
});

it('returns 403 on missing CSRF', async () => {
  mockVerifyCsrf.mockReturnValueOnce(NextResponse.json({ error: 'CSRF_INVALID' }, { status: 403 }));
  const res = await POST(req({ rating: 5 }), ctx());
  expect(res.status).toBe(403);
});

it('returns 400 VALIDATION_FAILED for a rating outside 1-5', async () => {
  const res = await POST(req({ rating: 6 }), ctx());
  expect(res.status).toBe(400);
});

it('returns 404 MISSION_NOT_FOUND for a mission owned by another buyer', async () => {
  prismaMock.mission.findUnique.mockResolvedValue({
    id: 'mission-1',
    status: 'LIVRE',
    buyerId: 'someone-else',
    agentProfileId: 'agent-1',
    agentProfile: { displayName: 'Karim' },
  } as never);
  const res = await POST(req({ rating: 5 }), ctx());
  expect(res.status).toBe(404);
});

it('returns 409 MISSION_NOT_CLOSED for a mission not yet LIVRE/AUTO_LIVRE', async () => {
  prismaMock.mission.findUnique.mockResolvedValue({
    id: 'mission-1',
    status: 'EXPEDIE',
    buyerId: 'buyer-1',
    agentProfileId: 'agent-1',
    agentProfile: { displayName: 'Karim' },
  } as never);
  const res = await POST(req({ rating: 5 }), ctx());
  expect(res.status).toBe(409);
  const body = await res.json();
  expect(body.error).toBe('MISSION_NOT_CLOSED');
});

it('returns 409 REVIEW_ALREADY_EXISTS on a P2002 unique violation', async () => {
  prismaMock.mission.findUnique.mockResolvedValue({
    id: 'mission-1',
    status: 'LIVRE',
    buyerId: 'buyer-1',
    agentProfileId: 'agent-1',
    agentProfile: { displayName: 'Karim' },
  } as never);
  prismaMock.review.create.mockRejectedValue({ code: 'P2002' });
  const res = await POST(req({ rating: 5 }), ctx());
  expect(res.status).toBe(409);
  const body = await res.json();
  expect(body.error).toBe('REVIEW_ALREADY_EXISTS');
});

it('creates the review and recomputes avgRating/reviewCount from the aggregate', async () => {
  prismaMock.mission.findUnique.mockResolvedValue({
    id: 'mission-1',
    status: 'AUTO_LIVRE',
    buyerId: 'buyer-1',
    agentProfileId: 'agent-1',
    agentProfile: { displayName: 'Karim' },
  } as never);
  prismaMock.review.create.mockResolvedValue({
    id: 'review-1',
    rating: 4,
    comment: 'Bon travail',
    createdAt: new Date('2026-01-10'),
  } as never);
  mockAggregate(4.2, 5);

  const res = await POST(req({ rating: 4, comment: 'Bon travail' }), ctx());
  expect(res.status).toBe(201);
  expect(prismaMock.agentProfile.update).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: 'agent-1' },
      data: { avgRating: 4.2, reviewCount: 5 },
    }),
  );
  expect(mockCreateNotification).not.toHaveBeenCalled();
});

it('alerts every admin when the recomputed average is below 3.0 across 3+ reviews', async () => {
  prismaMock.mission.findUnique.mockResolvedValue({
    id: 'mission-1',
    status: 'LIVRE',
    buyerId: 'buyer-1',
    agentProfileId: 'agent-1',
    agentProfile: { displayName: 'Karim' },
  } as never);
  prismaMock.review.create.mockResolvedValue({
    id: 'review-1',
    rating: 1,
    comment: null,
    createdAt: new Date('2026-01-10'),
  } as never);
  mockAggregate(2.5, 4);
  prismaMock.user.findMany.mockResolvedValue([{ id: 'admin-1' }, { id: 'admin-2' }] as never);

  const res = await POST(req({ rating: 1 }), ctx());
  expect(res.status).toBe(201);
  expect(prismaMock.user.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { role: { in: ['ADMIN', 'SUPERADMIN'] } } }),
  );
  expect(mockCreateNotification).toHaveBeenCalledTimes(2);
  expect(mockCreateNotification).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ userId: 'admin-1', type: 'AGENT_RATING_ALERT' }),
  );
  expect(mockCreateNotification).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ userId: 'admin-2', type: 'AGENT_RATING_ALERT' }),
  );
  // Distinct recipients on a globally-unique dedupeKey (mirrors the
  // missionStatusChanged lesson) — never omit userId from the key.
  const keys = mockCreateNotification.mock.calls.map(
    (c) => (c[1] as { dedupeKey: string }).dedupeKey,
  );
  expect(new Set(keys).size).toBe(2);
});

it('does not alert admins when reviewCount is below the 3-review floor', async () => {
  prismaMock.mission.findUnique.mockResolvedValue({
    id: 'mission-1',
    status: 'LIVRE',
    buyerId: 'buyer-1',
    agentProfileId: 'agent-1',
    agentProfile: { displayName: 'Karim' },
  } as never);
  prismaMock.review.create.mockResolvedValue({
    id: 'review-1',
    rating: 1,
    comment: null,
    createdAt: new Date('2026-01-10'),
  } as never);
  mockAggregate(1, 1);

  const res = await POST(req({ rating: 1 }), ctx());
  expect(res.status).toBe(201);
  expect(mockCreateNotification).not.toHaveBeenCalled();
});
