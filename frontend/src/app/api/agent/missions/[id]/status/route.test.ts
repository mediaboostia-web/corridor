// POST /api/agent/missions/[id]/status — Phase 4 forward-only status advance.
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
vi.mock('@/lib/server/notifications', () => ({
  createNotification: vi.fn().mockResolvedValue(null),
}));

import { requireMarketplaceRole } from '@/lib/server/middleware';
import { verifyCsrf } from '@/lib/server/auth';
import { createNotification } from '@/lib/server/notifications';
import { POST } from './route';

const mockRequireMarketplaceRole = vi.mocked(requireMarketplaceRole);
const mockVerifyCsrf = vi.mocked(verifyCsrf);
const mockCreateNotification = vi.mocked(createNotification);

const authedCtx = {
  user: { sub: 'user-1', email: 'karim@example.com' },
  marketplaceRole: 'AGENT' as const,
};

function req(body?: unknown): NextRequest {
  const headers = new Headers({
    'content-type': 'application/json',
    'x-csrf-token': 'csrf-token',
    cookie: 'app-csrf=csrf-token',
  });
  return new NextRequest('http://localhost/api/agent/missions/mission-1/status', {
    method: 'POST',
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
function ctx(id = 'mission-1') {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  mockRequireMarketplaceRole.mockResolvedValue(authedCtx);
  mockVerifyCsrf.mockReturnValue(null);
  prismaMock.$transaction.mockImplementation(async (fn: unknown) => {
    if (typeof fn === 'function') return fn(prismaMock);
    return undefined;
  });
  prismaMock.agentProfile.findUnique.mockResolvedValue({ id: 'agent-1' } as never);
});

it('returns 403 on missing CSRF', async () => {
  mockVerifyCsrf.mockReturnValueOnce(NextResponse.json({ error: 'CSRF_INVALID' }, { status: 403 }));
  const res = await POST(req({}), ctx());
  expect(res.status).toBe(403);
});

it('returns 404 PROFILE_NOT_FOUND when no AgentProfile exists', async () => {
  prismaMock.agentProfile.findUnique.mockResolvedValue(null);
  const res = await POST(req({}), ctx());
  expect(res.status).toBe(404);
});

it('returns 400 UPLOAD_NOT_FOUND when a media id is not owned by the caller', async () => {
  prismaMock.fileUpload.count.mockResolvedValue(0);
  const res = await POST(req({ mediaFileUploadIds: ['not-mine'] }), ctx());
  expect(res.status).toBe(400);
  const body = await res.json();
  expect(body.error).toBe('UPLOAD_NOT_FOUND');
});

it('returns 400 WHOLESALER_NOT_FOUND when the shop is unknown or inactive', async () => {
  prismaMock.wholesalerProfile.findUnique.mockResolvedValue(null);
  const res = await POST(req({ wholesalerProfileId: 'wp-1' }), ctx());
  expect(res.status).toBe(400);
  const body = await res.json();
  expect(body.error).toBe('WHOLESALER_NOT_FOUND');
});

it('returns 404 MISSION_NOT_FOUND for a mission owned by another agent', async () => {
  prismaMock.mission.findUnique.mockResolvedValue({
    id: 'mission-1',
    status: 'RECU',
    buyerId: 'buyer-1',
    wholesalerProfileId: null,
    agentProfile: { userId: 'someone-else' },
    sourcingRequest: { title: 'Robes wax' },
  } as never);
  const res = await POST(req({}), ctx());
  expect(res.status).toBe(404);
});

it('returns 409 MISSION_ALREADY_CLOSED for a terminal-status mission', async () => {
  prismaMock.mission.findUnique.mockResolvedValue({
    id: 'mission-1',
    status: 'LIVRE',
    buyerId: 'buyer-1',
    wholesalerProfileId: null,
    agentProfile: { userId: 'user-1' },
    sourcingRequest: { title: 'Robes wax' },
  } as never);
  const res = await POST(req({}), ctx());
  expect(res.status).toBe(409);
  const body = await res.json();
  expect(body.error).toBe('MISSION_ALREADY_CLOSED');
});

it('returns 409 MISSION_AWAITING_DELIVERY_CONFIRMATION at EXPEDIE', async () => {
  prismaMock.mission.findUnique.mockResolvedValue({
    id: 'mission-1',
    status: 'EXPEDIE',
    buyerId: 'buyer-1',
    wholesalerProfileId: null,
    agentProfile: { userId: 'user-1' },
    sourcingRequest: { title: 'Robes wax' },
  } as never);
  const res = await POST(req({}), ctx());
  expect(res.status).toBe(409);
  const body = await res.json();
  expect(body.error).toBe('MISSION_AWAITING_DELIVERY_CONFIRMATION');
});

it('returns 409 MISSION_AWAITING_DELIVERY_CONFIRMATION at ACHETE for an INSTANTANE mission', async () => {
  prismaMock.mission.findUnique.mockResolvedValue({
    id: 'mission-1',
    status: 'ACHETE',
    fulfillmentType: 'INSTANTANE',
    buyerId: 'buyer-1',
    wholesalerProfileId: null,
    agentProfile: { userId: 'user-1' },
    sourcingRequest: { title: 'Papayes' },
  } as never);
  const res = await POST(req({}), ctx());
  expect(res.status).toBe(409);
  const body = await res.json();
  expect(body.error).toBe('MISSION_AWAITING_DELIVERY_CONFIRMATION');
});

it('advances an INSTANTANE mission EN_ACHAT -> ACHETE directly (no EMBALLE step)', async () => {
  prismaMock.mission.findUnique.mockResolvedValue({
    id: 'mission-1',
    status: 'EN_ACHAT',
    fulfillmentType: 'INSTANTANE',
    buyerId: 'buyer-1',
    wholesalerProfileId: null,
    agentProfile: { userId: 'user-1' },
    sourcingRequest: { title: 'Papayes' },
  } as never);
  prismaMock.mission.update.mockResolvedValue({ id: 'mission-1', status: 'ACHETE' } as never);

  const res = await POST(req({}), ctx());
  expect(res.status).toBe(200);
  expect(prismaMock.mission.update).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ status: 'ACHETE' }) }),
  );
});

it('advances RECU -> EN_ACHAT, creates a status event, and notifies the buyer', async () => {
  prismaMock.mission.findUnique.mockResolvedValue({
    id: 'mission-1',
    status: 'RECU',
    buyerId: 'buyer-1',
    wholesalerProfileId: null,
    agentProfile: { userId: 'user-1' },
    sourcingRequest: { title: 'Robes wax' },
  } as never);
  prismaMock.mission.update.mockResolvedValue({ id: 'mission-1', status: 'EN_ACHAT' } as never);

  const res = await POST(req({ note: 'Trouvé chez le grossiste.' }), ctx());
  expect(res.status).toBe(200);
  expect(prismaMock.mission.update).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ status: 'EN_ACHAT' }) }),
  );
  expect(prismaMock.missionStatusEvent.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        missionId: 'mission-1',
        status: 'EN_ACHAT',
        note: 'Trouvé chez le grossiste.',
        createdByUserId: 'user-1',
      }),
    }),
  );
  expect(mockCreateNotification).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ userId: 'buyer-1', type: 'MISSION_STATUS_CHANGED' }),
  );
});

it('attaches wholesalerProfileId when the mission had none yet', async () => {
  prismaMock.mission.findUnique.mockResolvedValue({
    id: 'mission-1',
    status: 'RECU',
    buyerId: 'buyer-1',
    wholesalerProfileId: null,
    agentProfile: { userId: 'user-1' },
    sourcingRequest: { title: 'Robes wax' },
  } as never);
  prismaMock.wholesalerProfile.findUnique.mockResolvedValue({
    id: 'wp-1',
    status: 'ACTIVE',
  } as never);
  prismaMock.mission.update.mockResolvedValue({ id: 'mission-1', status: 'EN_ACHAT' } as never);

  const res = await POST(req({ wholesalerProfileId: 'wp-1' }), ctx());
  expect(res.status).toBe(200);
  expect(prismaMock.mission.update).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ wholesalerProfileId: 'wp-1' }) }),
  );
});

it('returns 409 WHOLESALER_ALREADY_SET when trying to change an already-attached shop', async () => {
  prismaMock.mission.findUnique.mockResolvedValue({
    id: 'mission-1',
    status: 'RECU',
    buyerId: 'buyer-1',
    wholesalerProfileId: 'wp-existing',
    agentProfile: { userId: 'user-1' },
    sourcingRequest: { title: 'Robes wax' },
  } as never);
  prismaMock.wholesalerProfile.findUnique.mockResolvedValue({
    id: 'wp-1',
    status: 'ACTIVE',
  } as never);

  const res = await POST(req({ wholesalerProfileId: 'wp-1' }), ctx());
  expect(res.status).toBe(409);
  const body = await res.json();
  expect(body.error).toBe('WHOLESALER_ALREADY_SET');
});
