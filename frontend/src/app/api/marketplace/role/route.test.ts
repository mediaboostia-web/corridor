// POST /api/marketplace/role — Corridor Sourcing role choice.
//
// Covers: happy path per role (BUYER/AGENT/WHOLESALER), profile row creation
// + slug collision retry, CSRF gate, auth gate, already-set 409, invalid
// role Zod rejection, runtime export shape.
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies, __cookieStore } from '@/test-utils/mock-cookies';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

mockNextCookies();

vi.mock('@/lib/server/middleware', () => ({
  requireAuth: vi.fn(),
}));

import { requireAuth } from '@/lib/server/middleware';
import { POST } from './route';

const mockRequireAuth = vi.mocked(requireAuth);

const authedCtx = { user: { sub: 'user-1', email: 'jenni@example.com' } };

function jsonRequest(body: unknown, opts: { csrf?: boolean } = { csrf: true }): NextRequest {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (opts.csrf !== false) {
    headers.set('x-csrf-token', 'csrf-token');
    headers.set('cookie', 'app-csrf=csrf-token');
  }
  return new NextRequest('http://localhost/api/marketplace/role', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  mockRequireAuth.mockResolvedValue(authedCtx);
  prismaMock.$transaction.mockImplementation(async (fn: unknown) => {
    if (typeof fn === 'function') return fn(prismaMock);
    return undefined;
  });
});

describe('POST /api/marketplace/role', () => {
  it('Test 1 — BUYER: sets marketplaceRole and creates an empty BuyerProfile', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'jenni@example.com',
      marketplaceRole: null,
    } as never);
    prismaMock.user.update.mockResolvedValue({} as never);
    prismaMock.buyerProfile.create.mockResolvedValue({ id: 'buyer-1' } as never);

    const res = await POST(jsonRequest({ role: 'BUYER' }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, marketplaceRole: 'BUYER' });
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({ marketplaceRole: 'BUYER' }),
      }),
    );
    expect(prismaMock.buyerProfile.create).toHaveBeenCalledWith({ data: { userId: 'user-1' } });
    expect(prismaMock.agentProfile.create).not.toHaveBeenCalled();
    expect(prismaMock.wholesalerProfile.create).not.toHaveBeenCalled();
  });

  it('Test 2 — AGENT: creates AgentProfile with a slug derived from the email local-part', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-2',
      email: 'karim@example.com',
      marketplaceRole: null,
    } as never);
    prismaMock.user.update.mockResolvedValue({} as never);
    prismaMock.agentProfile.create.mockResolvedValue({ id: 'agent-1' } as never);

    const res = await POST(jsonRequest({ role: 'AGENT' }));

    expect(res.status).toBe(200);
    expect(prismaMock.agentProfile.create).toHaveBeenCalledTimes(1);
    const createArg = prismaMock.agentProfile.create.mock.calls[0]![0];
    expect(createArg).toMatchObject({
      data: expect.objectContaining({ userId: 'user-2', publicSlug: 'karim' }),
    });
  });

  it('Test 3 — WHOLESALER: creates WholesalerProfile with a slug derived from the email local-part', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-3',
      email: 'maridiath@example.com',
      marketplaceRole: null,
    } as never);
    prismaMock.user.update.mockResolvedValue({} as never);
    prismaMock.wholesalerProfile.create.mockResolvedValue({ id: 'shop-1' } as never);

    const res = await POST(jsonRequest({ role: 'WHOLESALER' }));

    expect(res.status).toBe(200);
    expect(prismaMock.wholesalerProfile.create).toHaveBeenCalledTimes(1);
    const createArg = prismaMock.wholesalerProfile.create.mock.calls[0]![0];
    expect(createArg).toMatchObject({
      data: expect.objectContaining({ userId: 'user-3', slug: 'maridiath' }),
    });
  });

  it('Test 4 — slug collision on first attempt retries with a numeric suffix', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-4',
      email: 'karim@example.com',
      marketplaceRole: null,
    } as never);
    prismaMock.user.update.mockResolvedValue({} as never);
    prismaMock.agentProfile.create
      .mockRejectedValueOnce(Object.assign(new Error('Unique constraint'), { code: 'P2002' }))
      .mockResolvedValueOnce({ id: 'agent-2' } as never);

    const res = await POST(jsonRequest({ role: 'AGENT' }));

    expect(res.status).toBe(200);
    expect(prismaMock.agentProfile.create).toHaveBeenCalledTimes(2);
    const secondCallArg = prismaMock.agentProfile.create.mock.calls[1]![0];
    expect(secondCallArg).toMatchObject({
      data: expect.objectContaining({ publicSlug: 'karim-2' }),
    });
  });

  it('Test 5 — missing CSRF header returns 403, no DB write', async () => {
    const res = await POST(jsonRequest({ role: 'BUYER' }, { csrf: false }));

    expect(res.status).toBe(403);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('Test 6 — unauthenticated returns 401 (requireAuth short-circuits)', async () => {
    mockRequireAuth.mockResolvedValueOnce(
      NextResponse.json({ error: 'Missing token' }, { status: 401 }),
    );

    const res = await POST(jsonRequest({ role: 'BUYER' }));

    expect(res.status).toBe(401);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('Test 7 — role already set returns 409 ROLE_ALREADY_SET, no DB write', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'jenni@example.com',
      marketplaceRole: 'BUYER',
    } as never);

    const res = await POST(jsonRequest({ role: 'AGENT' }));

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body).toMatchObject({ error: 'ROLE_ALREADY_SET' });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('Test 8 — invalid role value returns 400 VALIDATION_FAILED', async () => {
    const res = await POST(jsonRequest({ role: 'ADMIN' }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ error: 'VALIDATION_FAILED' });
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("Test 9 — route file exports runtime='nodejs' and POST handler", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, 'route.ts'), 'utf8');
    expect(src).toMatch(/runtime\s*=\s*['"]nodejs['"]/);
    expect(src).toMatch(/export\s+async\s+function\s+POST/);
  });
});
