// GET/POST /api/conversations — Phase 5 messagerie: list own threads,
// find-or-create a thread with another user (role-derived kind).
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies, __cookieStore } from '@/test-utils/mock-cookies';
import { it, expect, vi, beforeEach, describe } from 'vitest';
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
import { GET, POST } from './route';

const mockRequireAnyMarketplaceRole = vi.mocked(requireAnyMarketplaceRole);
const mockVerifyCsrf = vi.mocked(verifyCsrf);

const buyerCtx = {
  user: { sub: 'buyer-1', email: 'jenni@example.com' },
  marketplaceRole: 'BUYER' as const,
};

function getReq(): NextRequest {
  return new NextRequest('http://localhost/api/conversations');
}
function postReq(body: unknown): NextRequest {
  const headers = new Headers({
    'content-type': 'application/json',
    'x-csrf-token': 'csrf-token',
    cookie: 'app-csrf=csrf-token',
  });
  return new NextRequest('http://localhost/api/conversations', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  mockRequireAnyMarketplaceRole.mockResolvedValue(buyerCtx);
  mockVerifyCsrf.mockReturnValue(null);
});

describe('GET /api/conversations', () => {
  it('lists conversations with the other participant resolved and an unread count', async () => {
    prismaMock.conversation.findMany.mockResolvedValue([
      {
        id: 'conv-1',
        kind: 'BUYER_AGENT',
        subjectType: 'MISSION',
        subjectId: 'mission-1',
        participantAId: 'buyer-1',
        participantBId: 'agent-user-1',
        lastMessageAt: new Date('2026-01-01'),
        messages: [{ body: 'Salut', senderId: 'agent-user-1', createdAt: new Date('2026-01-01') }],
      },
    ] as never);
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: 'agent-user-1',
        email: 'karim@example.com',
        marketplaceRole: 'AGENT',
        agentProfile: { displayName: 'Karim', publicSlug: 'karim' },
        wholesalerProfile: null,
        buyerProfile: null,
      },
    ] as never);
    // `groupBy`'s conditional/overloaded Prisma type doesn't resolve to a
    // mock-friendly signature — cast the mock accessor, not the value.
    (
      prismaMock.message.groupBy as unknown as { mockResolvedValue: (v: unknown) => void }
    ).mockResolvedValue([{ conversationId: 'conv-1', _count: { _all: 2 } }]);

    const res = await GET(getReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].otherParticipant).toEqual({
      userId: 'agent-user-1',
      marketplaceRole: 'AGENT',
      label: 'Karim',
      href: '/agents/karim',
    });
    expect(body.items[0].unreadCount).toBe(2);
    expect(body.items[0].lastMessage.body).toBe('Salut');
  });

  it('returns an empty list with no query for unread counts when the caller has no conversations', async () => {
    prismaMock.conversation.findMany.mockResolvedValue([]);
    const res = await GET(getReq());
    const body = await res.json();
    expect(body.items).toEqual([]);
    expect(prismaMock.message.groupBy).not.toHaveBeenCalled();
  });
});

describe('POST /api/conversations', () => {
  it('returns 403 on missing CSRF', async () => {
    mockVerifyCsrf.mockReturnValueOnce(
      NextResponse.json({ error: 'CSRF_INVALID' }, { status: 403 }),
    );
    const res = await POST(postReq({ otherUserId: 'agent-user-1' }));
    expect(res.status).toBe(403);
  });

  it('returns 400 CANNOT_MESSAGE_SELF', async () => {
    const res = await POST(postReq({ otherUserId: 'buyer-1' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('CANNOT_MESSAGE_SELF');
  });

  it('returns 404 USER_NOT_FOUND for an unknown otherUserId', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const res = await POST(postReq({ otherUserId: 'ghost' }));
    expect(res.status).toBe(404);
  });

  it('returns 400 INVALID_PARTICIPANT_PAIR for two buyers', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'buyer-2',
      marketplaceRole: 'BUYER',
    } as never);
    const res = await POST(postReq({ otherUserId: 'buyer-2' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('INVALID_PARTICIPANT_PAIR');
  });

  it('returns the existing conversation (created: false) when one already matches', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'agent-user-1',
      marketplaceRole: 'AGENT',
    } as never);
    prismaMock.conversation.findFirst.mockResolvedValue({ id: 'conv-existing' } as never);

    const res = await POST(postReq({ otherUserId: 'agent-user-1' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ conversationId: 'conv-existing', created: false });
    expect(prismaMock.conversation.create).not.toHaveBeenCalled();
  });

  it('creates a BUYER_AGENT conversation when none exists yet', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'agent-user-1',
      marketplaceRole: 'AGENT',
    } as never);
    prismaMock.conversation.findFirst.mockResolvedValue(null);
    prismaMock.conversation.create.mockResolvedValue({ id: 'conv-new' } as never);

    const res = await POST(postReq({ otherUserId: 'agent-user-1' }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ conversationId: 'conv-new', created: true });
    expect(prismaMock.conversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: 'BUYER_AGENT',
          participantAId: 'buyer-1',
          participantBId: 'agent-user-1',
        }),
      }),
    );
  });

  it('returns 404 MISSION_NOT_FOUND when subjectType=MISSION but the caller is not a party to it', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'agent-user-1',
      marketplaceRole: 'AGENT',
    } as never);
    prismaMock.mission.findUnique.mockResolvedValue({
      buyerId: 'someone-else',
      agentProfile: { userId: 'agent-user-1' },
      wholesalerProfile: null,
    } as never);

    const res = await POST(
      postReq({ otherUserId: 'agent-user-1', subjectType: 'MISSION', subjectId: 'mission-1' }),
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('MISSION_NOT_FOUND');
  });

  it('re-fetches on a P2002 race and still returns the winning conversation', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'agent-user-1',
      marketplaceRole: 'AGENT',
    } as never);
    prismaMock.conversation.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'conv-raced' } as never);
    prismaMock.conversation.create.mockRejectedValue({ code: 'P2002' });

    const res = await POST(postReq({ otherUserId: 'agent-user-1' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ conversationId: 'conv-raced', created: false });
  });
});
