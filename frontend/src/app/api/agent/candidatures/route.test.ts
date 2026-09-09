// POST /api/agent/candidatures — Phase 3 candidater on an OPEN sourcing request.
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies, __cookieStore } from '@/test-utils/mock-cookies';
import { it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

mockNextCookies();

vi.mock('@/lib/server/middleware', () => ({
  requireVerifiedAgent: vi.fn(),
}));
vi.mock('@/lib/server/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/server/auth')>('@/lib/server/auth');
  return { ...actual, verifyCsrf: vi.fn() };
});
vi.mock('@/lib/server/notifications', () => ({
  createNotification: vi.fn().mockResolvedValue(null),
}));

import { requireVerifiedAgent } from '@/lib/server/middleware';
import { verifyCsrf } from '@/lib/server/auth';
import { createNotification } from '@/lib/server/notifications';
import { POST } from './route';

const mockRequireVerifiedAgent = vi.mocked(requireVerifiedAgent);
const mockVerifyCsrf = vi.mocked(verifyCsrf);
const mockCreateNotification = vi.mocked(createNotification);

const authedCtx = {
  user: { sub: 'user-1', email: 'karim@example.com' },
  marketplaceRole: 'AGENT' as const,
  agentProfileId: 'agent-1',
};

function req(body?: unknown): NextRequest {
  const headers = new Headers({
    'content-type': 'application/json',
    'x-csrf-token': 'csrf-token',
    cookie: 'app-csrf=csrf-token',
  });
  return new NextRequest('http://localhost/api/agent/candidatures', {
    method: 'POST',
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const validBody = {
  sourcingRequestId: 'req-1',
  proposedCommissionAmount: 5000,
  message: 'Je peux trouver ce produit rapidement à Cotonou.',
};

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  mockRequireVerifiedAgent.mockResolvedValue(authedCtx);
  mockVerifyCsrf.mockReturnValue(null);
});

it('returns 403 on missing CSRF', async () => {
  mockVerifyCsrf.mockReturnValueOnce(NextResponse.json({ error: 'CSRF_INVALID' }, { status: 403 }));
  const res = await POST(req(validBody));
  expect(res.status).toBe(403);
});

it('returns 403 AGENT_NOT_VERIFIED when the middleware rejects', async () => {
  mockRequireVerifiedAgent.mockResolvedValueOnce(
    NextResponse.json({ error: 'AGENT_NOT_VERIFIED' }, { status: 403 }),
  );
  const res = await POST(req(validBody));
  expect(res.status).toBe(403);
});

it('returns 400 VALIDATION_FAILED for a too-short message', async () => {
  const res = await POST(req({ ...validBody, message: 'short' }));
  expect(res.status).toBe(400);
});

it('returns 403 AGENT_SUSPENDED when the admin has suspended this agent (Phase 8)', async () => {
  prismaMock.agentProfile.findUnique.mockResolvedValueOnce({ isSuspended: true } as never);
  const res = await POST(req(validBody));
  expect(res.status).toBe(403);
  const body = await res.json();
  expect(body.error).toBe('AGENT_SUSPENDED');
  expect(prismaMock.candidature.create).not.toHaveBeenCalled();
});

it('returns 404 REQUEST_NOT_FOUND for an unknown request', async () => {
  prismaMock.sourcingRequest.findUnique.mockResolvedValue(null);
  const res = await POST(req(validBody));
  expect(res.status).toBe(404);
});

it('returns 409 REQUEST_NOT_OPEN when the request is not OPEN', async () => {
  prismaMock.sourcingRequest.findUnique.mockResolvedValue({
    id: 'req-1',
    title: 'Robes wax',
    buyerId: 'buyer-1',
    status: 'IN_PROGRESS',
  } as never);
  const res = await POST(req(validBody));
  expect(res.status).toBe(409);
  const body = await res.json();
  expect(body.error).toBe('REQUEST_NOT_OPEN');
});

it('returns 409 ALREADY_CANDIDATED on a unique-constraint violation', async () => {
  prismaMock.sourcingRequest.findUnique.mockResolvedValue({
    id: 'req-1',
    title: 'Robes wax',
    buyerId: 'buyer-1',
    status: 'OPEN',
  } as never);
  prismaMock.candidature.create.mockRejectedValue(
    new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: '5.0.0',
    }),
  );
  const res = await POST(req(validBody));
  expect(res.status).toBe(409);
  const body = await res.json();
  expect(body.error).toBe('ALREADY_CANDIDATED');
});

it('creates a PENDING candidature defaulting to STANDARD fulfillment, and notifies the buyer', async () => {
  prismaMock.sourcingRequest.findUnique.mockResolvedValue({
    id: 'req-1',
    title: 'Robes wax',
    buyerId: 'buyer-1',
    status: 'OPEN',
  } as never);
  prismaMock.candidature.create.mockResolvedValue({
    id: 'cand-1',
    sourcingRequestId: 'req-1',
    agentProfileId: 'agent-1',
    proposedCommissionAmount: 5000,
    currency: 'XOF',
    message: validBody.message,
    status: 'PENDING',
    fulfillmentType: 'STANDARD',
    createdAt: new Date('2026-01-01'),
  } as never);

  const res = await POST(req(validBody));
  expect(res.status).toBe(201);
  expect(prismaMock.candidature.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        sourcingRequestId: 'req-1',
        agentProfileId: 'agent-1',
        fulfillmentType: 'STANDARD',
      }),
    }),
  );
  expect(mockCreateNotification).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ userId: 'buyer-1', type: 'NEW_CANDIDATURE' }),
  );
});

it('creates a candidature with an explicit INSTANTANE fulfillmentType', async () => {
  prismaMock.sourcingRequest.findUnique.mockResolvedValue({
    id: 'req-1',
    title: 'Papayes',
    buyerId: 'buyer-1',
    status: 'OPEN',
  } as never);
  prismaMock.candidature.create.mockResolvedValue({
    id: 'cand-1',
    sourcingRequestId: 'req-1',
    agentProfileId: 'agent-1',
    proposedCommissionAmount: 5000,
    currency: 'XOF',
    message: validBody.message,
    status: 'PENDING',
    fulfillmentType: 'INSTANTANE',
    createdAt: new Date('2026-01-01'),
  } as never);

  const res = await POST(req({ ...validBody, fulfillmentType: 'INSTANTANE' }));
  expect(res.status).toBe(201);
  expect(prismaMock.candidature.create).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ fulfillmentType: 'INSTANTANE' }) }),
  );
});

it('returns 400 VALIDATION_FAILED for an invalid fulfillmentType', async () => {
  const res = await POST(req({ ...validBody, fulfillmentType: 'AUTRE' }));
  expect(res.status).toBe(400);
});
