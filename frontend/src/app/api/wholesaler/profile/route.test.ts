// GET/PATCH /api/wholesaler/profile — Phase 1 "Ma boutique".
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies, __cookieStore } from '@/test-utils/mock-cookies';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  user: { sub: 'user-1', email: 'maridiath@example.com' },
  marketplaceRole: 'WHOLESALER' as const,
};

function req(method: string, body?: unknown): NextRequest {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (method !== 'GET') {
    headers.set('x-csrf-token', 'csrf-token');
    headers.set('cookie', 'app-csrf=csrf-token');
  }
  return new NextRequest('http://localhost/api/wholesaler/profile', {
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

const baseProfile = {
  id: 'shop-1',
  shopName: 'Maridiath Shop',
  slug: 'maridiath',
  logoUploadId: null,
  coverUploadId: null,
  description: null,
  locationCity: 'Cotonou',
  locationDetail: null,
  hours: null,
  whatsappLink: null,
  status: 'ACTIVE',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('GET /api/wholesaler/profile', () => {
  it('returns 404 PROFILE_NOT_FOUND when no profile row exists', async () => {
    prismaMock.wholesalerProfile.findUnique.mockResolvedValue(null);
    const res = await GET(req('GET'));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toMatchObject({ error: 'PROFILE_NOT_FOUND' });
  });

  it('returns the profile with logoUrl/coverUrl resolved from FileUpload', async () => {
    prismaMock.wholesalerProfile.findUnique.mockResolvedValue({
      ...baseProfile,
      logoUploadId: 'up-1',
    } as never);
    prismaMock.fileUpload.findMany.mockResolvedValue([
      { id: 'up-1', key: 'user-1/logo-key' },
    ] as never);

    const res = await GET(req('GET'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile.shopName).toBe('Maridiath Shop');
    expect(body.profile.logoUrl).toContain('user-1/logo-key');
    expect(body.profile.coverUrl).toBeNull();
  });

  it('passes through requireMarketplaceRole short-circuit (wrong role)', async () => {
    mockRequireMarketplaceRole.mockResolvedValueOnce(
      NextResponse.json({ error: 'MARKETPLACE_ROLE_REQUIRED' }, { status: 403 }),
    );
    const res = await GET(req('GET'));
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/wholesaler/profile', () => {
  it('returns 403 on missing CSRF', async () => {
    mockVerifyCsrf.mockReturnValueOnce(
      NextResponse.json({ error: 'CSRF_INVALID' }, { status: 403 }),
    );
    const res = await PATCH(req('PATCH', { shopName: 'New name' }));
    expect(res.status).toBe(403);
    expect(prismaMock.wholesalerProfile.update).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION_FAILED for an out-of-range shopName', async () => {
    const res = await PATCH(req('PATCH', { shopName: 'a' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 PROFILE_NOT_FOUND when no profile row exists', async () => {
    prismaMock.wholesalerProfile.findUnique.mockResolvedValue(null);
    const res = await PATCH(req('PATCH', { shopName: 'New name' }));
    expect(res.status).toBe(404);
  });

  it('returns 400 UPLOAD_NOT_FOUND when logoUploadId is not owned by the caller', async () => {
    prismaMock.wholesalerProfile.findUnique.mockResolvedValue({ id: 'shop-1' } as never);
    prismaMock.fileUpload.count.mockResolvedValue(0);

    const res = await PATCH(req('PATCH', { logoUploadId: 'not-mine' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ error: 'UPLOAD_NOT_FOUND' });
    expect(prismaMock.wholesalerProfile.update).not.toHaveBeenCalled();
  });

  it('updates only the supplied fields (undefined keys stripped, not nulled)', async () => {
    prismaMock.wholesalerProfile.findUnique.mockResolvedValue({ id: 'shop-1' } as never);
    prismaMock.wholesalerProfile.update.mockResolvedValue(baseProfile as never);

    const res = await PATCH(req('PATCH', { shopName: 'Renamed shop', hours: null }));
    expect(res.status).toBe(200);
    expect(prismaMock.wholesalerProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        data: { shopName: 'Renamed shop', hours: null },
      }),
    );
  });
});
