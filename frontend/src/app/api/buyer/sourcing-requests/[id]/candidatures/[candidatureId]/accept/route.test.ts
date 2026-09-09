// POST /api/buyer/sourcing-requests/[id]/candidatures/[candidatureId]/accept
// — Phase 3 buyer accepts a candidature, creating a Mission + Conversation.
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
  return new NextRequest(
    'http://localhost/api/buyer/sourcing-requests/req-1/candidatures/cand-1/accept',
    { method: 'POST', headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) },
  );
}
function ctx(id = 'req-1', candidatureId = 'cand-1') {
  return { params: Promise.resolve({ id, candidatureId }) };
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
  const res = await POST(req({}), ctx());
  expect(res.status).toBe(403);
});

it('returns 404 REQUEST_NOT_FOUND for a request owned by another buyer', async () => {
  prismaMock.sourcingRequest.findUnique.mockResolvedValue({
    id: 'req-1',
    title: 'Robes wax',
    buyerId: 'someone-else',
    status: 'OPEN',
    product: null,
  } as never);
  const res = await POST(req({}), ctx());
  expect(res.status).toBe(404);
});

it('returns 409 REQUEST_NOT_OPEN when the request is not OPEN', async () => {
  prismaMock.sourcingRequest.findUnique.mockResolvedValue({
    id: 'req-1',
    title: 'Robes wax',
    buyerId: 'buyer-1',
    status: 'IN_PROGRESS',
    product: null,
  } as never);
  const res = await POST(req({}), ctx());
  expect(res.status).toBe(409);
});

it('returns 404 CANDIDATURE_NOT_FOUND for an unknown candidature', async () => {
  prismaMock.sourcingRequest.findUnique.mockResolvedValue({
    id: 'req-1',
    title: 'Robes wax',
    buyerId: 'buyer-1',
    status: 'OPEN',
    product: null,
  } as never);
  prismaMock.candidature.findUnique.mockResolvedValue(null);
  const res = await POST(req({}), ctx());
  expect(res.status).toBe(404);
});

it('returns 409 CANDIDATURE_NOT_PENDING when already ACCEPTED', async () => {
  prismaMock.sourcingRequest.findUnique.mockResolvedValue({
    id: 'req-1',
    title: 'Robes wax',
    buyerId: 'buyer-1',
    status: 'OPEN',
    product: null,
  } as never);
  prismaMock.candidature.findUnique.mockResolvedValue({
    id: 'cand-1',
    sourcingRequestId: 'req-1',
    agentProfileId: 'agent-1',
    proposedCommissionAmount: 5000,
    currency: 'XOF',
    status: 'ACCEPTED',
    agentProfile: { userId: 'agent-user-1' },
  } as never);
  const res = await POST(req({}), ctx());
  expect(res.status).toBe(409);
});

it('returns 400 COMMISSION_REQUIRED when neither the candidature nor the body has an amount', async () => {
  prismaMock.sourcingRequest.findUnique.mockResolvedValue({
    id: 'req-1',
    title: 'Robes wax',
    buyerId: 'buyer-1',
    status: 'OPEN',
    product: null,
  } as never);
  prismaMock.candidature.findUnique.mockResolvedValue({
    id: 'cand-1',
    sourcingRequestId: 'req-1',
    agentProfileId: 'agent-1',
    proposedCommissionAmount: null,
    currency: 'XOF',
    status: 'PENDING',
    agentProfile: { userId: 'agent-user-1' },
  } as never);
  const res = await POST(req({}), ctx());
  expect(res.status).toBe(400);
});

it('accepts the candidature, rejects the others, creates a Mission + Conversation, and notifies', async () => {
  prismaMock.sourcingRequest.findUnique.mockResolvedValue({
    id: 'req-1',
    title: 'Robes wax',
    buyerId: 'buyer-1',
    status: 'OPEN',
    product: { wholesalerProfileId: 'wp-1' },
  } as never);
  prismaMock.candidature.findUnique.mockResolvedValue({
    id: 'cand-1',
    sourcingRequestId: 'req-1',
    agentProfileId: 'agent-1',
    proposedCommissionAmount: 5000,
    currency: 'XOF',
    status: 'PENDING',
    fulfillmentType: 'INSTANTANE',
    agentProfile: { userId: 'agent-user-1' },
  } as never);
  prismaMock.candidature.findMany.mockResolvedValue([
    { id: 'cand-2', agentProfile: { userId: 'agent-user-2' } },
  ] as never);
  prismaMock.mission.create.mockResolvedValue({ id: 'mission-1', status: 'RECU' } as never);
  prismaMock.conversation.create.mockResolvedValue({ id: 'conv-1' } as never);

  const res = await POST(req({}), ctx());
  expect(res.status).toBe(200);

  expect(prismaMock.sourcingRequest.update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: { status: 'IN_PROGRESS', selectedCandidatureId: 'cand-1' },
    }),
  );
  expect(prismaMock.candidature.update).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: 'cand-1' }, data: { status: 'ACCEPTED' } }),
  );
  expect(prismaMock.candidature.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: { in: ['cand-2'] } },
      data: { status: 'REJECTED' },
    }),
  );
  expect(prismaMock.mission.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        sourcingRequestId: 'req-1',
        buyerId: 'buyer-1',
        agentProfileId: 'agent-1',
        wholesalerProfileId: 'wp-1',
        agreedCommissionAmount: 5000,
        currency: 'XOF',
        fulfillmentType: 'INSTANTANE',
      }),
    }),
  );
  expect(prismaMock.missionStatusEvent.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ missionId: 'mission-1', status: 'RECU' }),
    }),
  );
  expect(prismaMock.conversation.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        kind: 'BUYER_AGENT',
        participantAId: 'buyer-1',
        participantBId: 'agent-user-1',
      }),
    }),
  );

  expect(mockCreateNotification).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ userId: 'agent-user-1', type: 'CANDIDATURE_ACCEPTED' }),
  );
  expect(mockCreateNotification).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ userId: 'agent-user-2', type: 'CANDIDATURE_REJECTED' }),
  );

  const body = await res.json();
  expect(body).toMatchObject({ mission: { id: 'mission-1' }, conversationId: 'conv-1' });
});

it('accepts using a body-provided agreedCommissionAmount override', async () => {
  prismaMock.sourcingRequest.findUnique.mockResolvedValue({
    id: 'req-1',
    title: 'Robes wax',
    buyerId: 'buyer-1',
    status: 'OPEN',
    product: null,
  } as never);
  prismaMock.candidature.findUnique.mockResolvedValue({
    id: 'cand-1',
    sourcingRequestId: 'req-1',
    agentProfileId: 'agent-1',
    proposedCommissionAmount: null,
    currency: 'XOF',
    status: 'PENDING',
    agentProfile: { userId: 'agent-user-1' },
  } as never);
  prismaMock.candidature.findMany.mockResolvedValue([]);
  prismaMock.mission.create.mockResolvedValue({ id: 'mission-1', status: 'RECU' } as never);
  prismaMock.conversation.create.mockResolvedValue({ id: 'conv-1' } as never);

  const res = await POST(req({ agreedCommissionAmount: 8000 }), ctx());
  expect(res.status).toBe(200);
  expect(prismaMock.mission.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ agreedCommissionAmount: 8000, fulfillmentType: 'STANDARD' }),
    }),
  );
});
