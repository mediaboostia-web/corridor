// GET/POST /api/conversations/[id]/messages — Phase 5 messagerie history +
// send (persist then best-effort Ably publish + notify).
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
vi.mock('@/lib/server/marketplace/media', () => ({
  resolveMediaUrls: vi.fn().mockResolvedValue(new Map()),
}));
vi.mock('@/lib/server/marketplace/participant', () => ({
  resolveParticipants: vi.fn().mockResolvedValue(new Map()),
}));
vi.mock('@/lib/server/notifications', () => ({
  createNotification: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/server/realtime/ably', () => ({
  getAbly: vi.fn(),
  conversationChannelName: (id: string) => `conversation:${id}`,
}));

import { requireAnyMarketplaceRole } from '@/lib/server/middleware';
import { verifyCsrf } from '@/lib/server/auth';
import { createNotification } from '@/lib/server/notifications';
import { getAbly } from '@/lib/server/realtime/ably';
import { resolveParticipants } from '@/lib/server/marketplace/participant';
import { GET, POST } from './route';

const mockRequireAnyMarketplaceRole = vi.mocked(requireAnyMarketplaceRole);
const mockVerifyCsrf = vi.mocked(verifyCsrf);
const mockCreateNotification = vi.mocked(createNotification);
const mockGetAbly = vi.mocked(getAbly);
const mockResolveParticipants = vi.mocked(resolveParticipants);

const buyerCtx = {
  user: { sub: 'buyer-1', email: 'jenni@example.com' },
  marketplaceRole: 'BUYER' as const,
};

function getReq(): NextRequest {
  return new NextRequest('http://localhost/api/conversations/conv-1/messages');
}
function postReq(body: unknown): NextRequest {
  const headers = new Headers({
    'content-type': 'application/json',
    'x-csrf-token': 'csrf-token',
    cookie: 'app-csrf=csrf-token',
  });
  return new NextRequest('http://localhost/api/conversations/conv-1/messages', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}
function ctx(id = 'conv-1') {
  return { params: Promise.resolve({ id }) };
}

const conversation = { id: 'conv-1', participantAId: 'buyer-1', participantBId: 'agent-user-1' };

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  mockRequireAnyMarketplaceRole.mockResolvedValue(buyerCtx);
  mockVerifyCsrf.mockReturnValue(null);
  mockResolveParticipants.mockResolvedValue(new Map());
  prismaMock.conversation.findUnique.mockResolvedValue(conversation as never);
  prismaMock.$transaction.mockImplementation((cb: unknown) => {
    if (typeof cb === 'function') {
      return (cb as (tx: typeof prismaMock) => unknown)(prismaMock) as Promise<unknown>;
    }
    return Promise.resolve(cb);
  });
});

describe('GET /api/conversations/[id]/messages', () => {
  it('returns 404 CONVERSATION_NOT_FOUND when the caller is not a participant', async () => {
    prismaMock.conversation.findUnique.mockResolvedValue({
      id: 'conv-1',
      participantAId: 'someone-else',
      participantBId: 'another-one',
    } as never);
    const res = await GET(getReq(), ctx());
    expect(res.status).toBe(404);
  });

  it('lists messages newest-first with resolved media URLs', async () => {
    prismaMock.message.findMany.mockResolvedValue([
      {
        id: 'msg-2',
        conversationId: 'conv-1',
        senderId: 'agent-user-1',
        body: 'Ça avance bien',
        readAt: null,
        createdAt: new Date('2026-01-02'),
        media: [],
      },
      {
        id: 'msg-1',
        conversationId: 'conv-1',
        senderId: 'buyer-1',
        body: 'Bonjour',
        readAt: new Date('2026-01-01'),
        createdAt: new Date('2026-01-01'),
        media: [],
      },
    ] as never);

    const res = await GET(getReq(), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(2);
    expect(body.items[0].id).toBe('msg-2');
  });
});

describe('POST /api/conversations/[id]/messages', () => {
  it('returns 403 on missing CSRF', async () => {
    mockVerifyCsrf.mockReturnValueOnce(
      NextResponse.json({ error: 'CSRF_INVALID' }, { status: 403 }),
    );
    const res = await POST(postReq({ body: 'Salut' }), ctx());
    expect(res.status).toBe(403);
  });

  it('returns 400 VALIDATION_FAILED (MESSAGE_EMPTY) when body and media are both empty', async () => {
    const res = await POST(postReq({}), ctx());
    expect(res.status).toBe(400);
  });

  it('returns 404 CONVERSATION_NOT_FOUND when the caller is not a participant', async () => {
    prismaMock.conversation.findUnique.mockResolvedValue({
      id: 'conv-1',
      participantAId: 'someone-else',
      participantBId: 'another-one',
    } as never);
    const res = await POST(postReq({ body: 'Salut' }), ctx());
    expect(res.status).toBe(404);
  });

  it('returns 400 UPLOAD_NOT_FOUND when a media id is not owned by the caller', async () => {
    prismaMock.fileUpload.count.mockResolvedValue(0);
    const res = await POST(postReq({ mediaFileUploadIds: ['not-mine'] }), ctx());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('UPLOAD_NOT_FOUND');
  });

  it('persists the message, publishes to Ably, and notifies the recipient', async () => {
    prismaMock.message.create.mockResolvedValue({
      id: 'msg-new',
      conversationId: 'conv-1',
      senderId: 'buyer-1',
      body: 'Salut',
      readAt: null,
      createdAt: new Date('2026-01-03'),
      media: [],
    } as never);
    const publish = vi.fn().mockResolvedValue(undefined);
    mockGetAbly.mockReturnValue({ channels: { get: () => ({ publish }) } } as never);

    const res = await POST(postReq({ body: 'Salut' }), ctx());
    expect(res.status).toBe(201);
    expect(prismaMock.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'conv-1' } }),
    );
    expect(publish).toHaveBeenCalledWith('message', expect.objectContaining({ id: 'msg-new' }));
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: 'agent-user-1', type: 'NEW_MESSAGE' }),
    );
  });

  it('still returns 201 when Ably is not configured (best-effort publish)', async () => {
    prismaMock.message.create.mockResolvedValue({
      id: 'msg-new',
      conversationId: 'conv-1',
      senderId: 'buyer-1',
      body: 'Salut',
      readAt: null,
      createdAt: new Date('2026-01-03'),
      media: [],
    } as never);
    mockGetAbly.mockReturnValue(null);

    const res = await POST(postReq({ body: 'Salut' }), ctx());
    expect(res.status).toBe(201);
  });
});
