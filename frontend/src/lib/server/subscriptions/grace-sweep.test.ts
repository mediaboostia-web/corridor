import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server/notifications', () => ({
  createNotification: vi.fn().mockResolvedValue({ id: 'notif-1' }),
}));

import { createNotification } from '@/lib/server/notifications';
import { sweepGracePeriods } from './grace-sweep';

const mockCreateNotification = vi.mocked(createNotification);

describe('sweepGracePeriods (Phase 7, cron subscription-grace-sweep)', () => {
  let findMany: ReturnType<typeof vi.fn>;
  let updateMany: ReturnType<typeof vi.fn>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateNotification.mockResolvedValue({ id: 'notif-1' } as never);
    findMany = vi.fn();
    updateMany = vi.fn();
    prisma = { proSubscription: { findMany, updateMany } };
  });

  it('returns zeroes when there is nothing to sweep', async () => {
    findMany.mockResolvedValueOnce([]); // lapsed ACTIVE
    findMany.mockResolvedValueOnce([]); // lapsed GRACE
    const r = await sweepGracePeriods({ prisma });
    expect(r).toEqual({ startedGrace: 0, expired: 0 });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('moves a lapsed ACTIVE subscription to GRACE with graceEndsAt = currentPeriodEnd + 7d, notifies once', async () => {
    findMany.mockResolvedValueOnce([
      {
        id: 'sub-1',
        userId: 'user-1',
        plan: 'AGENT_PRO',
        currentPeriodEnd: new Date('2026-06-01T00:00:00.000Z'),
      },
    ]);
    findMany.mockResolvedValueOnce([]);
    updateMany.mockResolvedValueOnce({ count: 1 });

    const r = await sweepGracePeriods({ prisma });
    expect(r).toEqual({ startedGrace: 1, expired: 0 });

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub-1', status: 'ACTIVE' },
        data: expect.objectContaining({ status: 'GRACE' }),
      }),
    );
    const graceEndsAt = updateMany.mock.calls[0]![0].data.graceEndsAt as Date;
    const daysAfter =
      (graceEndsAt.getTime() - new Date('2026-06-01T00:00:00.000Z').getTime()) /
      (24 * 60 * 60 * 1000);
    expect(daysAfter).toBeCloseTo(7, 0);

    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: 'user-1', type: 'SUBSCRIPTION_GRACE_STARTED' }),
    );
  });

  it('skips a lapsed-ACTIVE row the WHERE-guard rejects (renewed mid-sweep)', async () => {
    findMany.mockResolvedValueOnce([
      {
        id: 'sub-1',
        userId: 'user-1',
        plan: 'AGENT_PRO',
        currentPeriodEnd: new Date('2026-06-01'),
      },
    ]);
    findMany.mockResolvedValueOnce([]);
    updateMany.mockResolvedValueOnce({ count: 0 });

    const r = await sweepGracePeriods({ prisma });
    expect(r).toEqual({ startedGrace: 0, expired: 0 });
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it('moves a lapsed GRACE subscription to EXPIRED, notifies once', async () => {
    findMany.mockResolvedValueOnce([]); // lapsed ACTIVE
    findMany.mockResolvedValueOnce([
      {
        id: 'sub-2',
        userId: 'user-2',
        plan: 'WHOLESALER_PRO',
        graceEndsAt: new Date('2026-06-08'),
      },
    ]);
    updateMany.mockResolvedValueOnce({ count: 1 });

    const r = await sweepGracePeriods({ prisma });
    expect(r).toEqual({ startedGrace: 0, expired: 1 });
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub-2', status: 'GRACE' },
        data: { status: 'EXPIRED' },
      }),
    );
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: 'user-2', type: 'SUBSCRIPTION_DOWNGRADED' }),
    );
  });

  it('handles both transitions in the same tick independently', async () => {
    findMany.mockResolvedValueOnce([
      {
        id: 'sub-1',
        userId: 'user-1',
        plan: 'AGENT_PRO',
        currentPeriodEnd: new Date('2026-06-01'),
      },
    ]);
    findMany.mockResolvedValueOnce([
      {
        id: 'sub-2',
        userId: 'user-2',
        plan: 'WHOLESALER_PRO',
        graceEndsAt: new Date('2026-06-08'),
      },
    ]);
    updateMany.mockResolvedValueOnce({ count: 1 });
    updateMany.mockResolvedValueOnce({ count: 1 });

    const r = await sweepGracePeriods({ prisma });
    expect(r).toEqual({ startedGrace: 1, expired: 1 });
  });
});
