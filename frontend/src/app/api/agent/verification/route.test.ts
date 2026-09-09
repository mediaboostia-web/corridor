// GET/POST /api/agent/verification — Phase 3 identity verification submission.
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
import { GET, POST } from './route';

const mockRequireMarketplaceRole = vi.mocked(requireMarketplaceRole);
const mockVerifyCsrf = vi.mocked(verifyCsrf);

const authedCtx = {
  user: { sub: 'user-1', email: 'karim@example.com' },
  marketplaceRole: 'AGENT' as const,
};

function req(method: string, body?: unknown): NextRequest {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (method !== 'GET') {
    headers.set('x-csrf-token', 'csrf-token');
    headers.set('cookie', 'app-csrf=csrf-token');
  }
  return new NextRequest('http://localhost/api/agent/verification', {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const validBody = {
  actionZone: 'Dantokpa',
  idFrontUploadId: 'up-front',
  idBackUploadId: 'up-back',
  selfieUploadId: 'up-selfie',
};

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  mockRequireMarketplaceRole.mockResolvedValue(authedCtx);
  mockVerifyCsrf.mockReturnValue(null);
  prismaMock.fileUpload.findMany.mockResolvedValue([]);
});

it('GET returns 404 PROFILE_NOT_FOUND when no AgentProfile exists', async () => {
  prismaMock.agentProfile.findUnique.mockResolvedValue(null);
  const res = await GET(req('GET'));
  expect(res.status).toBe(404);
});

it('GET returns the current verification state', async () => {
  prismaMock.agentProfile.findUnique.mockResolvedValue({
    verificationStatus: 'UNVERIFIED',
    actionZone: null,
    idFrontUploadId: null,
    idBackUploadId: null,
    selfieUploadId: null,
    verificationSubmittedAt: null,
    verificationReviewedAt: null,
    verificationRejectionReason: null,
  } as never);
  const res = await GET(req('GET'));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.verification.verificationStatus).toBe('UNVERIFIED');
});

it('POST returns 403 on missing CSRF', async () => {
  mockVerifyCsrf.mockReturnValueOnce(NextResponse.json({ error: 'CSRF_INVALID' }, { status: 403 }));
  const res = await POST(req('POST', validBody));
  expect(res.status).toBe(403);
});

it('POST returns 400 VALIDATION_FAILED for a missing actionZone', async () => {
  const res = await POST(
    req('POST', {
      idFrontUploadId: validBody.idFrontUploadId,
      idBackUploadId: validBody.idBackUploadId,
      selfieUploadId: validBody.selfieUploadId,
    }),
  );
  expect(res.status).toBe(400);
});

it('POST returns 409 VERIFICATION_PENDING when already PENDING', async () => {
  prismaMock.agentProfile.findUnique.mockResolvedValue({
    id: 'agent-1',
    verificationStatus: 'PENDING',
  } as never);
  const res = await POST(req('POST', validBody));
  expect(res.status).toBe(409);
  const body = await res.json();
  expect(body.error).toBe('VERIFICATION_PENDING');
});

it('POST returns 409 ALREADY_VERIFIED when already VERIFIED', async () => {
  prismaMock.agentProfile.findUnique.mockResolvedValue({
    id: 'agent-1',
    verificationStatus: 'VERIFIED',
  } as never);
  const res = await POST(req('POST', validBody));
  expect(res.status).toBe(409);
  const body = await res.json();
  expect(body.error).toBe('ALREADY_VERIFIED');
});

it('POST returns 400 UPLOAD_NOT_FOUND when an upload is not owned by the caller', async () => {
  prismaMock.agentProfile.findUnique.mockResolvedValue({
    id: 'agent-1',
    verificationStatus: 'UNVERIFIED',
  } as never);
  prismaMock.fileUpload.count.mockResolvedValue(2);
  const res = await POST(req('POST', validBody));
  expect(res.status).toBe(400);
  const body = await res.json();
  expect(body.error).toBe('UPLOAD_NOT_FOUND');
});

it('POST submits from UNVERIFIED and sets status to PENDING', async () => {
  prismaMock.agentProfile.findUnique.mockResolvedValue({
    id: 'agent-1',
    verificationStatus: 'UNVERIFIED',
  } as never);
  prismaMock.fileUpload.count.mockResolvedValue(3);
  prismaMock.agentProfile.update.mockResolvedValue({
    verificationStatus: 'PENDING',
    actionZone: 'Dantokpa',
    idFrontUploadId: 'up-front',
    idBackUploadId: 'up-back',
    selfieUploadId: 'up-selfie',
    verificationSubmittedAt: new Date('2026-01-01'),
    verificationReviewedAt: null,
    verificationRejectionReason: null,
  } as never);

  const res = await POST(req('POST', validBody));
  expect(res.status).toBe(200);
  expect(prismaMock.agentProfile.update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ verificationStatus: 'PENDING', actionZone: 'Dantokpa' }),
    }),
  );
});

it('POST allows resubmission from REJECTED', async () => {
  prismaMock.agentProfile.findUnique.mockResolvedValue({
    id: 'agent-1',
    verificationStatus: 'REJECTED',
  } as never);
  prismaMock.fileUpload.count.mockResolvedValue(3);
  prismaMock.agentProfile.update.mockResolvedValue({
    verificationStatus: 'PENDING',
    actionZone: 'Dantokpa',
    idFrontUploadId: 'up-front',
    idBackUploadId: 'up-back',
    selfieUploadId: 'up-selfie',
    verificationSubmittedAt: new Date('2026-01-01'),
    verificationReviewedAt: null,
    verificationRejectionReason: null,
  } as never);

  const res = await POST(req('POST', validBody));
  expect(res.status).toBe(200);
});
