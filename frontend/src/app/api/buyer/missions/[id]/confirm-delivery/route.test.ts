// POST /api/buyer/missions/[id]/confirm-delivery — Phase 4 F19/US9.
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
  user: { sub: 'user-1', email: 'jenni@example.com' },
  marketplaceRole: 'BUYER' as const,
};

function req(): NextRequest {
  return new NextRequest('http://localhost/api/buyer/missions/mission-1/confirm-delivery', {
    method: 'POST',
    headers: { 'x-csrf-token': 'csrf-token', cookie: 'app-csrf=csrf-token' },
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
});

it('returns 403 on missing CSRF', async () => {
  mockVerifyCsrf.mockReturnValueOnce(NextResponse.json({ error: 'CSRF_INVALID' }, { status: 403 }));
  const res = await POST(req(), ctx());
  expect(res.status).toBe(403);
});

it('returns 404 MISSION_NOT_FOUND for a mission owned by another buyer', async () => {
  prismaMock.mission.findUnique.mockResolvedValue({
    id: 'mission-1',
    status: 'EXPEDIE',
    buyerId: 'someone-else',
    agentProfileId: 'agent-1',
    agentProfile: { userId: 'agent-user-1' },
    sourcingRequest: { title: 'Robes wax' },
  } as never);
  const res = await POST(req(), ctx());
  expect(res.status).toBe(404);
});

it('returns 409 MISSION_NOT_READY_FOR_CONFIRMATION when not yet shipped', async () => {
  prismaMock.mission.findUnique.mockResolvedValue({
    id: 'mission-1',
    status: 'EN_ACHAT',
    buyerId: 'user-1',
    agentProfileId: 'agent-1',
    agentProfile: { userId: 'agent-user-1' },
    sourcingRequest: { title: 'Robes wax' },
  } as never);
  const res = await POST(req(), ctx());
  expect(res.status).toBe(409);
  const body = await res.json();
  expect(body.error).toBe('MISSION_NOT_READY_FOR_CONFIRMATION');
});

it('returns 409 MISSION_NOT_READY_FOR_CONFIRMATION for an INSTANTANE mission still at EN_ACHAT', async () => {
  prismaMock.mission.findUnique.mockResolvedValue({
    id: 'mission-1',
    status: 'EN_ACHAT',
    fulfillmentType: 'INSTANTANE',
    buyerId: 'user-1',
    agentProfileId: 'agent-1',
    agentProfile: { userId: 'agent-user-1' },
    sourcingRequest: { title: 'Papayes' },
  } as never);
  const res = await POST(req(), ctx());
  expect(res.status).toBe(409);
  const body = await res.json();
  expect(body.error).toBe('MISSION_NOT_READY_FOR_CONFIRMATION');
});

it('confirms an INSTANTANE mission at ACHETE (no EMBALLE/EXPEDIE required)', async () => {
  prismaMock.mission.findUnique.mockResolvedValue({
    id: 'mission-1',
    status: 'ACHETE',
    fulfillmentType: 'INSTANTANE',
    buyerId: 'user-1',
    agentProfileId: 'agent-1',
    agentProfile: { userId: 'agent-user-1' },
    sourcingRequest: { title: 'Papayes' },
  } as never);
  prismaMock.mission.update.mockResolvedValue({ id: 'mission-1', status: 'LIVRE' } as never);

  const res = await POST(req(), ctx());
  expect(res.status).toBe(200);
  expect(prismaMock.mission.update).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ status: 'LIVRE' }) }),
  );
});

it('confirms delivery: sets LIVRE, logs a status event, increments missionCount, and notifies the agent', async () => {
  prismaMock.mission.findUnique.mockResolvedValue({
    id: 'mission-1',
    status: 'EXPEDIE',
    buyerId: 'user-1',
    agentProfileId: 'agent-1',
    agentProfile: { userId: 'agent-user-1' },
    sourcingRequest: { title: 'Robes wax' },
  } as never);
  prismaMock.mission.update.mockResolvedValue({ id: 'mission-1', status: 'LIVRE' } as never);

  const res = await POST(req(), ctx());
  expect(res.status).toBe(200);
  expect(prismaMock.mission.update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ status: 'LIVRE' }),
    }),
  );
  expect(prismaMock.missionStatusEvent.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        missionId: 'mission-1',
        status: 'LIVRE',
        createdByUserId: 'user-1',
      }),
    }),
  );
  expect(prismaMock.agentProfile.update).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: 'agent-1' },
      data: { missionCount: { increment: 1 } },
    }),
  );
  expect(mockCreateNotification).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ userId: 'agent-user-1', type: 'MISSION_STATUS_CHANGED' }),
  );
});
