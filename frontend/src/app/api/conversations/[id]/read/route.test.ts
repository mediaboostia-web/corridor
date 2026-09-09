// POST /api/conversations/[id]/read — Phase 5 messagerie unread badge.
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

import { requireAnyMarketplaceRole } from '@/lib/server/middleware';
import { verifyCsrf } from '@/lib/server/auth';
import { POST } from './route';

const mockRequireAnyMarketplaceRole = vi.mocked(requireAnyMarketplaceRole);
const mockVerifyCsrf = vi.mocked(verifyCsrf);

const buyerCtx = {
  user: { sub: 'buyer-1', email: 'jenni@example.com' },
  marketplaceRole: 'BUYER' as const,
};

function req(): NextRequest {
  const headers = new Headers({
    'content-type': 'application/json',
    'x-csrf-token': 'csrf-token',
    cookie: 'app-csrf=csrf-token',
  });
  return new NextRequest('http://localhost/api/conversations/conv-1/read', {
    method: 'POST',
    headers,
  });
}
function ctx(id = 'conv-1') {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  mockRequireAnyMarketplaceRole.mockResolvedValue(buyerCtx);
  mockVerifyCsrf.mockReturnValue(null);
});

it('returns 403 on missing CSRF', async () => {
  mockVerifyCsrf.mockReturnValueOnce(NextResponse.json({ error: 'CSRF_INVALID' }, { status: 403 }));
  const res = await POST(req(), ctx());
  expect(res.status).toBe(403);
});

it('returns 404 CONVERSATION_NOT_FOUND when the caller is not a participant', async () => {
  prismaMock.conversation.findUnique.mockResolvedValue({
    participantAId: 'someone-else',
    participantBId: 'another-one',
  } as never);
  const res = await POST(req(), ctx());
  expect(res.status).toBe(404);
});

it("marks the other participant's unread messages as read", async () => {
  prismaMock.conversation.findUnique.mockResolvedValue({
    participantAId: 'buyer-1',
    participantBId: 'agent-user-1',
  } as never);
  prismaMock.message.updateMany.mockResolvedValue({ count: 3 });

  const res = await POST(req(), ctx());
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body).toEqual({ markedRead: 3 });
  expect(prismaMock.message.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { conversationId: 'conv-1', senderId: { not: 'buyer-1' }, readAt: null },
    }),
  );
});
