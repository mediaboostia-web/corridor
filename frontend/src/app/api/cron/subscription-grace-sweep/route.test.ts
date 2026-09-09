import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/server/cron/auth', () => ({ verifyCronSecret: vi.fn(() => null) }));
vi.mock('@/lib/server/leader-lease', () => ({
  withLease: vi.fn(async (_r: unknown, _n: string, _t: number, fn: () => Promise<void>) => fn()),
}));
vi.mock('@/lib/server/redis', () => ({ redis: null }));

const sweepGracePeriodsMock = vi.fn();
vi.mock('@/lib/server/subscriptions/grace-sweep', () => ({
  sweepGracePeriods: sweepGracePeriodsMock,
}));

vi.mock('@/lib/server/prisma', () => ({ prisma: {} }));

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', 'test-secret');
  sweepGracePeriodsMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

function makeReq(): NextRequest {
  return new NextRequest('http://localhost/api/cron/subscription-grace-sweep', {
    method: 'POST',
    headers: { authorization: 'Bearer test-secret' },
  });
}

describe('POST /api/cron/subscription-grace-sweep', () => {
  it('returns 401 when verifyCronSecret fails', async () => {
    const { verifyCronSecret } = await import('@/lib/server/cron/auth');
    (verifyCronSecret as Mock).mockReturnValueOnce(
      NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 }),
    );
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
  });

  it('calls sweepGracePeriods with prisma', async () => {
    sweepGracePeriodsMock.mockResolvedValueOnce({ startedGrace: 0, expired: 0 });
    const { POST } = await import('./route');
    await POST(makeReq());
    expect(sweepGracePeriodsMock).toHaveBeenCalled();
    const arg = sweepGracePeriodsMock.mock.calls[0]![0] as { prisma: unknown };
    expect(arg.prisma).toBeDefined();
  });

  it('returns startedGrace/expired counts from the helper', async () => {
    sweepGracePeriodsMock.mockResolvedValueOnce({ startedGrace: 2, expired: 1 });
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, startedGrace: 2, expired: 1 });
  });
});
