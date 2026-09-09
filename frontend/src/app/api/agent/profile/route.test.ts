// GET/PATCH /api/agent/profile — Phase 3 agent public-profile editable
// fields (displayName/bio/phone only — actionZone is set via verification).
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
  user: { sub: 'user-1', email: 'karim@example.com' },
  marketplaceRole: 'AGENT' as const,
};

const baseProfile = {
  id: 'agent-1',
  displayName: 'Karim',
  bio: null,
  actionZone: null,
  phone: null,
  publicSlug: 'karim',
  verificationStatus: 'UNVERIFIED',
  verificationRejectionReason: null,
  missionCount: 0,
  avgRating: null,
  reviewCount: 0,
  isSuspended: false,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

function req(method: string, body?: unknown): NextRequest {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (method !== 'GET') {
    headers.set('x-csrf-token', 'csrf-token');
    headers.set('cookie', 'app-csrf=csrf-token');
  }
  return new NextRequest('http://localhost/api/agent/profile', {
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

it('GET returns 404 PROFILE_NOT_FOUND when no AgentProfile exists', async () => {
  prismaMock.agentProfile.findUnique.mockResolvedValue(null);
  const res = await GET(req('GET'));
  expect(res.status).toBe(404);
});

it('GET returns the profile', async () => {
  prismaMock.agentProfile.findUnique.mockResolvedValue(baseProfile as never);
  const res = await GET(req('GET'));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.profile.displayName).toBe('Karim');
});

it('PATCH returns 403 on missing CSRF', async () => {
  mockVerifyCsrf.mockReturnValueOnce(NextResponse.json({ error: 'CSRF_INVALID' }, { status: 403 }));
  const res = await PATCH(req('PATCH', { displayName: 'Karim B.' }));
  expect(res.status).toBe(403);
});

it('PATCH returns 400 VALIDATION_FAILED for a too-short displayName', async () => {
  const res = await PATCH(req('PATCH', { displayName: 'K' }));
  expect(res.status).toBe(400);
});

it('PATCH returns 404 PROFILE_NOT_FOUND when no AgentProfile exists', async () => {
  prismaMock.agentProfile.findUnique.mockResolvedValue(null);
  const res = await PATCH(req('PATCH', { displayName: 'Karim B.' }));
  expect(res.status).toBe(404);
});

it('PATCH updates displayName/bio/phone', async () => {
  prismaMock.agentProfile.findUnique.mockResolvedValue({ id: 'agent-1' } as never);
  prismaMock.agentProfile.update.mockResolvedValue({
    ...baseProfile,
    displayName: 'Karim B.',
    bio: 'Agent sourcing à Cotonou.',
    phone: '+22900000000',
  } as never);
  const res = await PATCH(
    req('PATCH', {
      displayName: 'Karim B.',
      bio: 'Agent sourcing à Cotonou.',
      phone: '+22900000000',
    }),
  );
  expect(res.status).toBe(200);
  expect(prismaMock.agentProfile.update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: {
        displayName: 'Karim B.',
        bio: 'Agent sourcing à Cotonou.',
        phone: '+22900000000',
      },
    }),
  );
});
