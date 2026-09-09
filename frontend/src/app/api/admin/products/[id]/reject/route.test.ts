// POST /api/admin/products/[id]/reject — PENDING -> DRAFT with a reason.
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

function req(
  body: unknown = { reason: 'Photos floues, merci de refaire les prises de vue.' },
): NextRequest {
  return new NextRequest('http://localhost/api/admin/products/prod-1/reject', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': 'csrf-token',
      cookie: 'app-csrf=csrf-token',
    },
    body: JSON.stringify(body),
  });
}
function ctx(id = 'prod-1') {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  mockRequireAdmin.mockResolvedValue(adminCtx);
  mockRateLimit.mockResolvedValue(null);
  mockVerifyCsrf.mockReturnValue(null);
  prismaMock.$transaction.mockImplementation(async (fn: unknown) => {
    if (typeof fn === 'function') return fn(prismaMock);
    return undefined;
  });
});

it('returns 403 on missing CSRF', async () => {
  mockVerifyCsrf.mockReturnValueOnce(NextResponse.json({ error: 'CSRF_INVALID' }, { status: 403 }));
  const res = await POST(req(), ctx());
  expect(res.status).toBe(403);
});

it('returns 400 VALIDATION_FAILED when reason is empty', async () => {
  const res = await POST(req({ reason: '' }), ctx());
  expect(res.status).toBe(400);
});

it('returns 404 PRODUCT_NOT_FOUND for an unknown product', async () => {
  prismaMock.product.findUnique.mockResolvedValue(null);
  const res = await POST(req(), ctx());
  expect(res.status).toBe(404);
});

it('returns 409 PRODUCT_NOT_PENDING when the product is not PENDING', async () => {
  prismaMock.product.findUnique.mockResolvedValue({
    id: 'prod-1',
    name: 'Sac',
    status: 'PUBLISHED',
    wholesalerProfile: { userId: 'owner-1' },
  } as never);
  const res = await POST(req(), ctx());
  expect(res.status).toBe(409);
});

it('rejects a PENDING product back to DRAFT with the reason, audits, and notifies', async () => {
  prismaMock.product.findUnique.mockResolvedValue({
    id: 'prod-1',
    name: 'Sac à main',
    status: 'PENDING',
    wholesalerProfile: { userId: 'owner-1' },
  } as never);
  prismaMock.product.update.mockResolvedValue({
    id: 'prod-1',
    name: 'Sac à main',
    status: 'DRAFT',
  } as never);

  const res = await POST(req(), ctx());
  expect(res.status).toBe(200);
  expect(prismaMock.product.update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        status: 'DRAFT',
        rejectionReason: 'Photos floues, merci de refaire les prises de vue.',
      }),
    }),
  );
  expect(mockLogAdminAction).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ action: 'product.reject', targetId: 'prod-1' }),
  );
  expect(mockCreateNotification).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ userId: 'owner-1', type: 'PRODUCT_REJECTED' }),
  );
});
