// POST /api/realtime/token — Phase 5 Ably capability-token mint.
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies, __cookieStore } from '@/test-utils/mock-cookies';
import { it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

mockNextCookies();

vi.mock('@/lib/server/middleware', () => ({
  requireAnyMarketplaceRole: vi.fn(),
}));
vi.mock('@/lib/server/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/server/auth')>('@/lib/server/auth');
  return { ...actual, verifyCsrf: vi.fn() };
});
vi.mock('@/lib/server/realtime/ably', () => ({
  getAbly: vi.fn(),
  conversationChannelName: (id: string) => `conversation:${id}`,
}));

import { requireAnyMarketplaceRole } from '@/lib/server/middleware';
import { verifyCsrf } from '@/lib/server/auth';
import { getAbly } from '@/lib/server/realtime/ably';
import { POST } from './route';

const mockRequireAnyMarketplaceRole = vi.mocked(requireAnyMarketplaceRole);
const mockVerifyCsrf = vi.mocked(verifyCsrf);
const mockGetAbly = vi.mocked(getAbly);

const authedCtx = {
  user: { sub: 'user-1', email: 'jenni@example.com' },
  marketplaceRole: 'BUYER' as const,
};

function req(): NextRequest {
  const headers = new Headers({
    'content-type': 'application/json',
    'x-csrf-token': 'csrf-token',
    cookie: 'app-csrf=csrf-token',
  });
  return new NextRequest('http://localhost/api/realtime/token', { method: 'POST', headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  mockRequireAnyMarketplaceRole.mockResolvedValue(authedCtx);
  mockVerifyCsrf.mockReturnValue(null);
});

it('returns 403 on missing CSRF', async () => {
  mockVerifyCsrf.mockReturnValueOnce(NextResponse.json({ error: 'CSRF_INVALID' }, { status: 403 }));
  const res = await POST(req());
  expect(res.status).toBe(403);
});

it('returns 503 REALTIME_NOT_CONFIGURED when ABLY_API_KEY is absent', async () => {
  mockGetAbly.mockReturnValue(null);
  const res = await POST(req());
  expect(res.status).toBe(503);
  const body = await res.json();
  expect(body.error).toBe('REALTIME_NOT_CONFIGURED');
});

it("mints a token request scoped to the caller's own conversation channels only", async () => {
  prismaMock.conversation.findMany.mockResolvedValue([{ id: 'conv-1' }, { id: 'conv-2' }] as never);
  const createTokenRequest = vi.fn().mockResolvedValue({ keyName: 'app.key', mac: 'x' });
  mockGetAbly.mockReturnValue({ auth: { createTokenRequest } } as never);

  const res = await POST(req());
  expect(res.status).toBe(200);
  expect(prismaMock.conversation.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { OR: [{ participantAId: 'user-1' }, { participantBId: 'user-1' }] },
    }),
  );
  expect(createTokenRequest).toHaveBeenCalledWith(
    expect.objectContaining({
      clientId: 'user-1',
      capability: {
        'conversation:conv-1': ['subscribe', 'presence'],
        'conversation:conv-2': ['subscribe', 'presence'],
      },
    }),
  );
});
