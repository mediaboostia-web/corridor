import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server/notifications', () => ({
  createNotification: vi.fn().mockResolvedValue({ id: 'notif-1' }),
}));

import { createNotification } from '@/lib/server/notifications';
import { sendRenewalReminders } from './renewal-reminder';

const mockCreateNotification = vi.mocked(createNotification);

describe('sendRenewalReminders (Phase 7, cron subscription-renewal-reminder)', () => {
  let findMany: ReturnType<typeof vi.fn>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateNotification.mockResolvedValue({ id: 'notif-1' } as never);
    findMany = vi.fn();
    prisma = { proSubscription: { findMany } };
  });

  it('returns { reminded: 0 } when no candidates', async () => {
    findMany.mockResolvedValueOnce([]);
    const r = await sendRenewalReminders({ prisma });
    expect(r).toEqual({ reminded: 0 });
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it('queries status=ACTIVE with currentPeriodEnd inside the 3-day lead window', async () => {
    findMany.mockResolvedValueOnce([]);
    await sendRenewalReminders({ prisma });
    const where = findMany.mock.calls[0]![0].where as {
      status: string;
      currentPeriodEnd: { gt: Date; lte: Date };
    };
    expect(where.status).toBe('ACTIVE');
    const windowMs = where.currentPeriodEnd.lte.getTime() - where.currentPeriodEnd.gt.getTime();
    expect(windowMs / (24 * 60 * 60 * 1000)).toBeCloseTo(3, 0);
  });

  it('notifies each candidate and counts successes', async () => {
    findMany.mockResolvedValueOnce([
      { userId: 'user-1', plan: 'AGENT_PRO', currentPeriodEnd: new Date('2026-07-01') },
      { userId: 'user-2', plan: 'WHOLESALER_PRO', currentPeriodEnd: new Date('2026-07-02') },
    ]);
    const r = await sendRenewalReminders({ prisma });
    expect(r).toEqual({ reminded: 2 });
    expect(mockCreateNotification).toHaveBeenCalledTimes(2);
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: 'user-1', type: 'SUBSCRIPTION_RENEWAL_REMINDER' }),
    );
  });

  it('does not count a call that returns null (already-dedup’d by createNotification)', async () => {
    findMany.mockResolvedValueOnce([
      { userId: 'user-1', plan: 'AGENT_PRO', currentPeriodEnd: new Date('2026-07-01') },
    ]);
    mockCreateNotification.mockResolvedValueOnce(null);
    const r = await sendRenewalReminders({ prisma });
    expect(r).toEqual({ reminded: 0 });
  });

  it('honors custom batchSize', async () => {
    findMany.mockResolvedValueOnce([]);
    await sendRenewalReminders({ prisma, batchSize: 25 });
    expect(findMany.mock.calls[0]![0].take).toBe(25);
  });
});
