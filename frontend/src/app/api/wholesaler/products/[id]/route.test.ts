// GET/PATCH/DELETE /api/wholesaler/products/[id] — ownership boundary +
// field-only edits (status never mutated here).
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
import { GET, PATCH, DELETE } from './route';

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
  return new NextRequest('http://localhost/api/wholesaler/products/prod-1', {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

function ctx(id = 'prod-1') {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  mockRequireMarketplaceRole.mockResolvedValue(authedCtx);
  mockVerifyCsrf.mockReturnValue(null);
  prismaMock.wholesalerProfile.findUnique.mockResolvedValue({ id: 'shop-1' } as never);
  prismaMock.$transaction.mockImplementation(async (fn: unknown) => {
    if (typeof fn === 'function') return fn(prismaMock);
    return undefined;
  });
});

const ownProduct = {
  id: 'prod-1',
  wholesalerProfileId: 'shop-1',
  name: 'Sac à main',
  category: 'Textiles',
  description: 'Sac artisanal en cuir véritable.',
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

describe('GET /api/wholesaler/products/[id]', () => {
  it('returns 404 when the product belongs to another wholesaler', async () => {
    prismaMock.product.findUnique.mockResolvedValue({
      ...ownProduct,
      wholesalerProfileId: 'someone-elses-shop',
    } as never);
    const res = await GET(req('GET'), ctx());
    expect(res.status).toBe(404);
  });

  it('returns the product when owned', async () => {
    prismaMock.product.findUnique.mockResolvedValue(ownProduct as never);
    const res = await GET(req('GET'), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.product.id).toBe('prod-1');
  });
});

describe('PATCH /api/wholesaler/products/[id]', () => {
  it('returns 403 on missing CSRF', async () => {
    mockVerifyCsrf.mockReturnValueOnce(
      NextResponse.json({ error: 'CSRF_INVALID' }, { status: 403 }),
    );
    const res = await PATCH(req('PATCH', { name: 'New name' }), ctx());
    expect(res.status).toBe(403);
  });

  it('returns 404 when the product belongs to another wholesaler', async () => {
    prismaMock.product.findUnique.mockResolvedValue({
      ...ownProduct,
      wholesalerProfileId: 'someone-elses-shop',
    } as never);
    const res = await PATCH(req('PATCH', { name: 'New name' }), ctx());
    expect(res.status).toBe(404);
  });

  it('edits fields without touching status, never accepting a status field', async () => {
    prismaMock.product.findUnique.mockResolvedValue(ownProduct as never);
    prismaMock.product.update.mockResolvedValue({ ...ownProduct, name: 'Nouveau nom' } as never);

    const res = await PATCH(req('PATCH', { name: 'Nouveau nom', status: 'PUBLISHED' }), ctx());
    expect(res.status).toBe(200);
    expect(prismaMock.product.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: 'Nouveau nom' } }),
    );
  });

  it('replaces media atomically (delete then recreate in order)', async () => {
    prismaMock.product.findUnique.mockResolvedValue(ownProduct as never);
    prismaMock.fileUpload.count.mockResolvedValue(2);
    prismaMock.product.update.mockResolvedValue(ownProduct as never);

    const res = await PATCH(req('PATCH', { mediaFileUploadIds: ['up-1', 'up-2'] }), ctx());
    expect(res.status).toBe(200);
    expect(prismaMock.productMedia.deleteMany).toHaveBeenCalledWith({
      where: { productId: 'prod-1' },
    });
    expect(prismaMock.productMedia.createMany).toHaveBeenCalledWith({
      data: [
        { productId: 'prod-1', fileUploadId: 'up-1', position: 0 },
        { productId: 'prod-1', fileUploadId: 'up-2', position: 1 },
      ],
    });
  });

  it('returns 400 UPLOAD_NOT_FOUND when a replacement media id is not owned', async () => {
    prismaMock.product.findUnique.mockResolvedValue(ownProduct as never);
    prismaMock.fileUpload.count.mockResolvedValue(0);

    const res = await PATCH(req('PATCH', { mediaFileUploadIds: ['not-mine'] }), ctx());
    expect(res.status).toBe(400);
    expect(prismaMock.productMedia.deleteMany).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/wholesaler/products/[id]', () => {
  it('returns 404 when the product belongs to another wholesaler', async () => {
    prismaMock.product.findUnique.mockResolvedValue({
      ...ownProduct,
      wholesalerProfileId: 'someone-elses-shop',
    } as never);
    const res = await DELETE(req('DELETE'), ctx());
    expect(res.status).toBe(404);
    expect(prismaMock.product.delete).not.toHaveBeenCalled();
  });

  it('deletes an owned product', async () => {
    prismaMock.product.findUnique.mockResolvedValue(ownProduct as never);
    const res = await DELETE(req('DELETE'), ctx());
    expect(res.status).toBe(200);
    expect(prismaMock.product.delete).toHaveBeenCalledWith({ where: { id: 'prod-1' } });
  });
});
