// PATCH /api/agent/candidatures/[id] — Phase 3 withdraw a PENDING candidature.
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

import { requireMarketplaceRole } from '@/lib/server/middleware';
import { verifyCsrf } from '@/lib/server/auth';
import { PATCH } from './route';

const mockRequireMarketplaceRole = vi.mocked(requireMarketplaceRole);
const mockVerifyCsrf = vi.mocked(verifyCsrf);

const authedCtx = {
  user: { sub: 'user-1', email: 'karim@example.com' },
  marketplaceRole: 'AGENT' as const,
};

function req(body?: unknown): NextRequest {
  const headers = new Headers({
    'content-type': 'application/json',
    'x-csrf-token': 'csrf-token',
    cookie: 'app-csrf=csrf-token',
  });
  return new NextRequest('http://localhost/api/agent/candidatures/cand-1', {
    method: 'PATCH',
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
function ctx(id = 'cand-1') {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  mockRequireMarketplaceRole.mockResolvedValue(authedCtx);
  mockVerifyCsrf.mockReturnValue(null);
});

it('returns 403 on missing CSRF', async () => {
  mockVerifyCsrf.mockReturnValueOnce(NextResponse.json({ error: 'CSRF_INVALID' }, { status: 403 }));
  const res = await PATCH(req({ status: 'WITHDRAWN' }), ctx());
  expect(res.status).toBe(403);
});

it('returns 404 CANDIDATURE_NOT_FOUND when owned by another agent', async () => {
  prismaMock.agentProfile.findUnique.mockResolvedValue({ id: 'agent-1' } as never);
  prismaMock.candidature.findUnique.mockResolvedValue({
    id: 'cand-1',
    agentProfileId: 'agent-2',
    status: 'PENDING',
  } as never);
  const res = await PATCH(req({ status: 'WITHDRAWN' }), ctx());
  expect(res.status).toBe(404);
});

it('returns 409 CANDIDATURE_NOT_WITHDRAWABLE when not PENDING', async () => {
  prismaMock.agentProfile.findUnique.mockResolvedValue({ id: 'agent-1' } as never);
  prismaMock.candidature.findUnique.mockResolvedValue({
    id: 'cand-1',
    agentProfileId: 'agent-1',
    status: 'ACCEPTED',
  } as never);
  const res = await PATCH(req({ status: 'WITHDRAWN' }), ctx());
  expect(res.status).toBe(409);
});

it('withdraws a PENDING candidature owned by the caller', async () => {
  prismaMock.agentProfile.findUnique.mockResolvedValue({ id: 'agent-1' } as never);
  prismaMock.candidature.findUnique.mockResolvedValue({
    id: 'cand-1',
    agentProfileId: 'agent-1',
    status: 'PENDING',
  } as never);
  prismaMock.candidature.update.mockResolvedValue({ id: 'cand-1', status: 'WITHDRAWN' } as never);

  const res = await PATCH(req({ status: 'WITHDRAWN' }), ctx());
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.candidature.status).toBe('WITHDRAWN');
});
