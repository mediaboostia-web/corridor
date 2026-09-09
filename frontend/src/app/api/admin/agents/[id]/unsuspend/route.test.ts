// POST /api/admin/agents/[id]/unsuspend — Phase 8.
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies, __cookieStore } from '@/test-utils/mock-cookies';
import { it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

mockNextCookies();

vi.mock('@/lib/server/middleware', () => ({
  requireAdmin: vi.fn(),
}));
vi.mock('@/lib/server/middleware/rate-limit-by-userid', () => ({
  enforceAdminRateLimit: vi.fn(),
}));
vi.mock('@/lib/server/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/server/auth')>('@/lib/server/auth');
  return { ...actual, verifyCsrf: vi.fn() };
});
vi.mock('@/lib/server/admin/audit', () => ({
  logAdminAction: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/server/notifications', () => ({
  createNotification: vi.fn().mockResolvedValue(null),
}));

import { requireAdmin } from '@/lib/server/middleware';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { verifyCsrf } from '@/lib/server/auth';
import { logAdminAction } from '@/lib/server/admin/audit';
import { createNotification } from '@/lib/server/notifications';
import { POST } from './route';

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockRateLimit = vi.mocked(enforceAdminRateLimit);
const mockVerifyCsrf = vi.mocked(verifyCsrf);
const mockLogAdminAction = vi.mocked(logAdminAction);
const mockCreateNotification = vi.mocked(createNotification);

const adminCtx = {
  user: { sub: 'admin-1', email: 'admin@test.local' },
  admin: { id: 'admin-1', email: 'admin@test.local', role: 'ADMIN' as const },
};

function req(): NextRequest {
  return new NextRequest('http://localhost/api/admin/agents/agent-1/unsuspend', {
    method: 'POST',
    headers: { 'x-csrf-token': 'csrf-token', cookie: 'app-csrf=csrf-token' },
  });
}
function ctx(id = 'agent-1') {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  mockRequireAdmin.mockResolvedValue(adminCtx);
  mockRateLimit.mockResolvedValue(null);
  mockVerifyCsrf.mockReturnValue(null);
  prismaMock.$transaction.mockImplementation(async (fn: unknown) => {
    if (typeof fn === 'function') return (fn as (tx: unknown) => unknown)(prismaMock);
    return undefined;
  });
});

it('returns 403 on missing CSRF', async () => {
  mockVerifyCsrf.mockReturnValueOnce(NextResponse.json({ error: 'CSRF_INVALID' }, { status: 403 }));
  const res = await POST(req(), ctx());
  expect(res.status).toBe(403);
});

it('returns 404 AGENT_NOT_FOUND for an unknown agent', async () => {
  prismaMock.agentProfile.findUnique.mockResolvedValue(null);
  const res = await POST(req(), ctx());
  expect(res.status).toBe(404);
});

it('returns 409 AGENT_NOT_SUSPENDED when not currently suspended', async () => {
  prismaMock.agentProfile.findUnique.mockResolvedValue({
    id: 'agent-1',
    userId: 'owner-1',
    isSuspended: false,
  } as never);
  const res = await POST(req(), ctx());
  expect(res.status).toBe(409);
  expect(mockLogAdminAction).not.toHaveBeenCalled();
});

it('unsuspends the agent, audits, and notifies the owner', async () => {
  prismaMock.agentProfile.findUnique.mockResolvedValue({
    id: 'agent-1',
    userId: 'owner-1',
    isSuspended: true,
  } as never);
  prismaMock.agentProfile.update.mockResolvedValue({ id: 'agent-1', isSuspended: false } as never);

  const res = await POST(req(), ctx());
  expect(res.status).toBe(200);
  expect(prismaMock.agentProfile.update).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: 'agent-1' }, data: { isSuspended: false } }),
  );
  expect(mockLogAdminAction).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ action: 'agent.unsuspend', targetId: 'agent-1' }),
  );
  expect(mockCreateNotification).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ userId: 'owner-1', type: 'AGENT_UNSUSPENDED' }),
  );
});
