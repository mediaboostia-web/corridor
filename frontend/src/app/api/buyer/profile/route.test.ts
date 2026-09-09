// GET/PATCH /api/buyer/profile — Phase 2 "Profil acheteur".
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
import { GET, PATCH } from './route';

const mockRequireMarketplaceRole = vi.mocked(requireMarketplaceRole);
const mockVerifyCsrf = vi.mocked(verifyCsrf);

const authedCtx = {
  user: { sub: 'user-1', email: 'jenni@example.com' },
  marketplaceRole: 'BUYER' as const,
};

function req(method: string, body?: unknown): NextRequest {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (method !== 'GET') {
    headers.set('x-csrf-token', 'csrf-token');
    headers.set('cookie', 'app-csrf=csrf-token');
  }
  return new NextRequest('http://localhost/api/buyer/profile', {
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
});

it('GET returns 404 PROFILE_NOT_FOUND when no profile row exists', async () => {
  prismaMock.buyerProfile.findUnique.mockResolvedValue(null);
  const res = await GET(req('GET'));
  expect(res.status).toBe(404);
});

it('GET returns the profile', async () => {
  prismaMock.buyerProfile.findUnique.mockResolvedValue({
    fullName: 'Jenni',
    phone: null,
    deliveryCountry: 'Gabon',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as never);
  const res = await GET(req('GET'));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.profile.deliveryCountry).toBe('Gabon');
});

it('GET passes through requireMarketplaceRole short-circuit', async () => {
  mockRequireMarketplaceRole.mockResolvedValueOnce(
    NextResponse.json({ error: 'MARKETPLACE_ROLE_REQUIRED' }, { status: 403 }),
  );
  const res = await GET(req('GET'));
  expect(res.status).toBe(403);
});

it('PATCH returns 403 on missing CSRF', async () => {
  mockVerifyCsrf.mockReturnValueOnce(NextResponse.json({ error: 'CSRF_INVALID' }, { status: 403 }));
  const res = await PATCH(req('PATCH', { deliveryCountry: 'Gabon' }));
  expect(res.status).toBe(403);
});

it('PATCH returns 400 VALIDATION_FAILED for a too-short deliveryCountry', async () => {
  const res = await PATCH(req('PATCH', { deliveryCountry: 'G' }));
  expect(res.status).toBe(400);
});

it('PATCH returns 404 PROFILE_NOT_FOUND when no profile row exists', async () => {
  prismaMock.buyerProfile.findUnique.mockResolvedValue(null);
  const res = await PATCH(req('PATCH', { deliveryCountry: 'Gabon' }));
  expect(res.status).toBe(404);
});

it('PATCH updates only the supplied fields', async () => {
  prismaMock.buyerProfile.findUnique.mockResolvedValue({ id: 'buyer-1' } as never);
  prismaMock.buyerProfile.update.mockResolvedValue({
    fullName: 'Jenni',
    phone: null,
    deliveryCountry: 'Gabon',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as never);

  const res = await PATCH(req('PATCH', { deliveryCountry: 'Gabon', fullName: 'Jenni' }));
  expect(res.status).toBe(200);
  expect(prismaMock.buyerProfile.update).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { userId: 'user-1' },
      data: { deliveryCountry: 'Gabon', fullName: 'Jenni' },
    }),
  );
});
