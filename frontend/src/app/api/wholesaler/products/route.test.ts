// GET/POST /api/wholesaler/products — Phase 1 "Catalogue" + "Ajouter un produit".
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
import { GET, POST } from './route';

const mockRequireMarketplaceRole = vi.mocked(requireMarketplaceRole);
const mockVerifyCsrf = vi.mocked(verifyCsrf);

const authedCtx = {
  user: { sub: 'user-1', email: 'maridiath@example.com' },
  marketplaceRole: 'WHOLESALER' as const,
};

function req(method: string, path: string, body?: unknown): NextRequest {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (method !== 'GET') {
    headers.set('x-csrf-token', 'csrf-token');
    headers.set('cookie', 'app-csrf=csrf-token');
  }
  return new NextRequest(`http://localhost/api/wholesaler/products${path}`, {
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
  prismaMock.wholesalerProfile.findUnique.mockResolvedValue({ id: 'shop-1' } as never);
});

const baseProduct = {
  id: 'prod-1',
  wholesalerProfileId: 'shop-1',
  name: 'Sac à main',
  category: 'Textiles',
  description: 'Sac artisanal en cuir véritable, plusieurs coloris.',
  priceAmount: 15000,
  currency: 'XOF',
  minQuantity: 1,
  availability: 'AVAILABLE',
  status: 'DRAFT',
  rejectionReason: null,
  viewCount: 0,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  media: [],
};

describe('GET /api/wholesaler/products', () => {
  it('returns 404 PROFILE_NOT_FOUND when caller has no shop yet', async () => {
    prismaMock.wholesalerProfile.findUnique.mockResolvedValue(null);
    const res = await GET(req('GET', ''));
    expect(res.status).toBe(404);
  });

  it('lists own products scoped by wholesalerProfileId, with media URLs resolved', async () => {
    prismaMock.product.findMany.mockResolvedValue([
      { ...baseProduct, media: [{ id: 'm1', fileUploadId: 'up-1', position: 0 }] },
    ] as never);
    prismaMock.fileUpload.findMany.mockResolvedValue([
      { id: 'up-1', key: 'shop-1/photo' },
    ] as never);

    const res = await GET(req('GET', ''));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].media[0].url).toContain('shop-1/photo');
    expect(prismaMock.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ wholesalerProfileId: 'shop-1' }),
      }),
    );
  });

  it('filters by ?status=', async () => {
    prismaMock.product.findMany.mockResolvedValue([]);
    await GET(req('GET', '?status=PUBLISHED'));
    expect(prismaMock.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'PUBLISHED' }) }),
    );
  });
});

describe('POST /api/wholesaler/products', () => {
  const validBody = {
    name: 'Sac à main',
    category: 'Textiles',
    description: 'Sac artisanal en cuir véritable, plusieurs coloris.',
    priceAmount: 15000,
    minQuantity: 2,
    mediaFileUploadIds: ['up-1'],
  };

  it('returns 403 on missing CSRF', async () => {
    mockVerifyCsrf.mockReturnValueOnce(
      NextResponse.json({ error: 'CSRF_INVALID' }, { status: 403 }),
    );
    const res = await POST(req('POST', '', validBody));
    expect(res.status).toBe(403);
    expect(prismaMock.product.create).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION_FAILED for a too-short description', async () => {
    const res = await POST(req('POST', '', { ...validBody, description: 'short' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 UPLOAD_NOT_FOUND when a media id is not owned by the caller', async () => {
    prismaMock.fileUpload.count.mockResolvedValue(0);
    const res = await POST(req('POST', '', validBody));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ error: 'UPLOAD_NOT_FOUND' });
    expect(prismaMock.product.create).not.toHaveBeenCalled();
  });

  it('returns 403 PRODUCT_LIMIT_REACHED at 20 products on the free plan (Phase 7, F13)', async () => {
    prismaMock.proSubscription.findUnique.mockResolvedValue(null);
    prismaMock.product.count.mockResolvedValue(20);
    const res = await POST(req('POST', '', validBody));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('PRODUCT_LIMIT_REACHED');
    expect(prismaMock.product.create).not.toHaveBeenCalled();
  });

  it('allows a 21st product when the wholesaler has an ACTIVE ProSubscription', async () => {
    prismaMock.proSubscription.findUnique.mockResolvedValue({ status: 'ACTIVE' } as never);
    prismaMock.fileUpload.count.mockResolvedValue(1);
    prismaMock.product.create.mockResolvedValue({
      ...baseProduct,
      media: [{ id: 'm1', fileUploadId: 'up-1', position: 0 }],
    } as never);
    prismaMock.fileUpload.findMany.mockResolvedValue([
      { id: 'up-1', key: 'shop-1/photo' },
    ] as never);

    const res = await POST(req('POST', '', validBody));
    expect(res.status).toBe(201);
    expect(prismaMock.product.count).not.toHaveBeenCalled(); // Pro skips the count check entirely
  });

  it('creates a DRAFT product with ordered media', async () => {
    prismaMock.proSubscription.findUnique.mockResolvedValue(null);
    prismaMock.product.count.mockResolvedValue(5);
    prismaMock.fileUpload.count.mockResolvedValue(1);
    prismaMock.product.create.mockResolvedValue({
      ...baseProduct,
      media: [{ id: 'm1', fileUploadId: 'up-1', position: 0 }],
    } as never);
    prismaMock.fileUpload.findMany.mockResolvedValue([
      { id: 'up-1', key: 'shop-1/photo' },
    ] as never);

    const res = await POST(req('POST', '', validBody));
    expect(res.status).toBe(201);
    expect(prismaMock.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          wholesalerProfileId: 'shop-1',
          name: 'Sac à main',
          media: { create: [{ fileUploadId: 'up-1', position: 0 }] },
        }),
      }),
    );
    const body = await res.json();
    expect(body.product.status).toBe('DRAFT');
  });
});
