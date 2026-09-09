// GET /api/admin/agents/verifications — Phase 3 agent verification queue.
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies, __cookieStore } from '@/test-utils/mock-cookies';
import { it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

mockNextCookies();

vi.mock('@/lib/server/middleware', () => ({
  requireAdmin: vi.fn(),
}));
vi.mock('@/lib/server/middleware/rate-limit-by-userid', () => ({
  enforceAdminRateLimit: vi.fn(),
}));

import { requireAdmin } from '@/lib/server/middleware';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { GET } from './route';

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockRateLimit = vi.mocked(enforceAdminRateLimit);

const adminCtx = {
  user: { sub: 'admin-1', email: 'admin@test.local' },
  admin: { id: 'admin-1', email: 'admin@test.local', role: 'ADMIN' as const },
};

function req(qs = ''): NextRequest {
  return new NextRequest(`http://localhost/api/admin/agents/verifications${qs}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  mockRequireAdmin.mockResolvedValue(adminCtx);
  mockRateLimit.mockResolvedValue(null);
  prismaMock.fileUpload.findMany.mockResolvedValue([]);
});

it('defaults to status=PENDING', async () => {
  prismaMock.agentProfile.findMany.mockResolvedValue([]);
  await GET(req());
  expect(prismaMock.agentProfile.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: expect.objectContaining({ verificationStatus: 'PENDING' }) }),
  );
});

it('lists PENDING submissions with resolved ID-photo URLs', async () => {
  prismaMock.agentProfile.findMany.mockResolvedValue([
    {
      id: 'agent-1',
      displayName: 'Karim',
      actionZone: 'Dantokpa',
      phone: '+22900000000',
      verificationStatus: 'PENDING',
      verificationSubmittedAt: new Date('2026-01-01'),
      idFrontUploadId: 'up-front',
      idBackUploadId: 'up-back',
      selfieUploadId: 'up-selfie',
      createdAt: new Date('2026-01-01'),
      user: { email: 'karim@example.com' },
    },
  ] as never);

  const res = await GET(req());
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.items).toHaveLength(1);
  expect(body.items[0]).toMatchObject({
    id: 'agent-1',
    displayName: 'Karim',
    email: 'karim@example.com',
  });
});
