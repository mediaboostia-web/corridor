// GET/POST /api/wholesaler/lives — Phase 1 "Lives" (time-boxed off-platform
// signal). Uses fake timers to pin `now()` for derivedStatus assertions.
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies, __cookieStore } from '@/test-utils/mock-cookies';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  user: { sub: 'user-1', email: 'maridiath@example.com' },
  marketplaceRole: 'WHOLESALER' as const,
};

function req(method: string, body?: unknown): NextRequest {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (method !== 'GET') {
    headers.set('x-csrf-token', 'csrf-token');
    headers.set('cookie', 'app-csrf=csrf-token');
  }
  return new NextRequest('http://localhost/api/wholesaler/lives', {
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
  prismaMock.wholesalerProfile.findUnique.mockResolvedValue({ id: 'shop-1' } as never);
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-01T12:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('GET /api/wholesaler/lives', () => {
  it('derives LIVE for an announcement whose window contains now()', async () => {
    prismaMock.liveAnnouncement.findMany.mockResolvedValue([
      {
        id: 'live-1',
        title: null,
        externalLink: 'https://tiktok.com/@shop/live',
        scheduledStart: new Date('2026-06-01T11:00:00.000Z'),
        scheduledEnd: new Date('2026-06-01T13:00:00.000Z'),
        status: 'SCHEDULED',
        createdAt: new Date('2026-05-30'),
      },
    ] as never);

    const res = await GET(req('GET'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items[0].derivedStatus).toBe('LIVE');
  });

  it('derives ENDED for a past window and CANCELLED stays CANCELLED regardless of window', async () => {
    prismaMock.liveAnnouncement.findMany.mockResolvedValue([
      {
        id: 'live-past',
        title: null,
        externalLink: 'https://tiktok.com/@shop/live',
        scheduledStart: new Date('2026-05-01T11:00:00.000Z'),
        scheduledEnd: new Date('2026-05-01T13:00:00.000Z'),
        status: 'SCHEDULED',
        createdAt: new Date('2026-04-30'),
      },
      {
        id: 'live-cancelled',
        title: null,
        externalLink: 'https://tiktok.com/@shop/live',
        scheduledStart: new Date('2026-06-02T11:00:00.000Z'),
        scheduledEnd: new Date('2026-06-02T13:00:00.000Z'),
        status: 'CANCELLED',
        createdAt: new Date('2026-05-31'),
      },
    ] as never);

    const res = await GET(req('GET'));
    const body = await res.json();
    expect(body.items[0].derivedStatus).toBe('ENDED');
    expect(body.items[1].derivedStatus).toBe('CANCELLED');
  });
});

describe('POST /api/wholesaler/lives', () => {
  const validBody = {
    title: 'Déstockage jean',
    externalLink: 'https://www.tiktok.com/@maridiath/live',
    scheduledStart: '2026-06-02T10:00:00.000Z',
    scheduledEnd: '2026-06-02T12:00:00.000Z',
  };

  it('returns 403 on missing CSRF', async () => {
    mockVerifyCsrf.mockReturnValueOnce(
      NextResponse.json({ error: 'CSRF_INVALID' }, { status: 403 }),
    );
    const res = await POST(req('POST', validBody));
    expect(res.status).toBe(403);
  });

  it('returns 400 VALIDATION_FAILED when scheduledEnd is before scheduledStart', async () => {
    const res = await POST(
      req('POST', {
        ...validBody,
        scheduledStart: '2026-06-02T12:00:00.000Z',
        scheduledEnd: '2026-06-02T10:00:00.000Z',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 VALIDATION_FAILED when scheduledEnd is already in the past', async () => {
    const res = await POST(
      req('POST', {
        ...validBody,
        scheduledStart: '2026-01-01T10:00:00.000Z',
        scheduledEnd: '2026-01-01T12:00:00.000Z',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 VALIDATION_FAILED for a non-URL externalLink', async () => {
    const res = await POST(req('POST', { ...validBody, externalLink: 'not-a-url' }));
    expect(res.status).toBe(400);
  });

  it('creates a SCHEDULED announcement scoped to the caller shop', async () => {
    prismaMock.liveAnnouncement.create.mockResolvedValue({
      id: 'live-new',
      title: validBody.title,
      externalLink: validBody.externalLink,
      scheduledStart: new Date(validBody.scheduledStart),
      scheduledEnd: new Date(validBody.scheduledEnd),
      status: 'SCHEDULED',
      createdAt: new Date(),
    } as never);

    const res = await POST(req('POST', validBody));
    expect(res.status).toBe(201);
    expect(prismaMock.liveAnnouncement.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ wholesalerProfileId: 'shop-1' }) }),
    );
    const body = await res.json();
    expect(body.live.derivedStatus).toBe('SCHEDULED');
  });
});
