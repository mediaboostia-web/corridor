import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/server/cron/auth', () => ({ verifyCronSecret: vi.fn(() => null) }));
vi.mock('@/lib/server/leader-lease', () => ({
  withLease: vi.fn(async (_r: unknown, _n: string, _t: number, fn: () => Promise<void>) => fn()),
}));
vi.mock('@/lib/server/redis', () => ({ redis: null }));

const autoDeliverMissionsMock = vi.fn();
vi.mock('@/lib/server/missions/auto-deliver', () => ({
  autoDeliverMissions: autoDeliverMissionsMock,
}));

vi.mock('@/lib/server/prisma', () => ({ prisma: {} }));

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', 'test-secret');
  autoDeliverMissionsMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

function makeReq(): NextRequest {
  return new NextRequest('http://localhost/api/cron/mission-auto-deliver', {
    method: 'POST',
    headers: { authorization: 'Bearer test-secret' },
  });
}

describe('POST /api/cron/mission-auto-deliver (US9)', () => {
  it('returns 401 when verifyCronSecret fails', async () => {
    const { verifyCronSecret } = await import('@/lib/server/cron/auth');
    (verifyCronSecret as Mock).mockReturnValueOnce(
      NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 }),
    );
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
  });

  it('calls autoDeliverMissions helper with prisma', async () => {
    autoDeliverMissionsMock.mockResolvedValueOnce({ autoDelivered: 0 });
    const { POST } = await import('./route');
    await POST(makeReq());
    expect(autoDeliverMissionsMock).toHaveBeenCalled();
    const arg = autoDeliverMissionsMock.mock.calls[0]![0] as { prisma: unknown };
    expect(arg.prisma).toBeDefined();
  });

  it('returns processed count from helper', async () => {
    autoDeliverMissionsMock.mockResolvedValueOnce({ autoDelivered: 3 });
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, processed: 3 });
  });
});
