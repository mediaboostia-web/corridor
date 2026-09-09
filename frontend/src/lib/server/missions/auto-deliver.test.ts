import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server/notifications', () => ({
  createNotification: vi.fn().mockResolvedValue(null),
}));

import { createNotification } from '@/lib/server/notifications';
import { autoDeliverMissions } from './auto-deliver';

const mockCreateNotification = vi.mocked(createNotification);

describe('autoDeliverMissions (US9, CRON-mission-auto-deliver)', () => {
  let findMany: ReturnType<typeof vi.fn>;
  let updateMany: ReturnType<typeof vi.fn>;
  let missionStatusEventCreate: ReturnType<typeof vi.fn>;
  let agentProfileUpdate: ReturnType<typeof vi.fn>;
  let $transaction: ReturnType<typeof vi.fn>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;

  beforeEach(() => {
    vi.clearAllMocks();
    findMany = vi.fn();
    updateMany = vi.fn();
    missionStatusEventCreate = vi.fn();
    agentProfileUpdate = vi.fn();
    $transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        mission: { updateMany },
        missionStatusEvent: { create: missionStatusEventCreate },
        agentProfile: { update: agentProfileUpdate },
      }),
    );
    prisma = { mission: { findMany }, $transaction };
  });

  const candidate = {
    id: 'mission-1',
    status: 'EXPEDIE',
    buyerId: 'buyer-1',
    agentProfileId: 'agent-1',
    agentProfile: { userId: 'agent-user-1' },
    sourcingRequest: { title: 'Robes wax' },
  };

  it('returns { autoDelivered: 0 } when no candidates', async () => {
    findMany.mockResolvedValueOnce([]);
    const r = await autoDeliverMissions({ prisma });
    expect(r).toEqual({ autoDelivered: 0 });
    expect($transaction).not.toHaveBeenCalled();
  });

  it('queries (STANDARD, EXPEDIE) OR (INSTANTANE, ACHETE) AND updatedAt < 14-day cutoff', async () => {
    findMany.mockResolvedValueOnce([]);
    await autoDeliverMissions({ prisma });
    const where = findMany.mock.calls[0]![0].where as {
      updatedAt: { lt: Date };
      OR: Array<{ fulfillmentType: string; status: string }>;
    };
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { fulfillmentType: 'STANDARD', status: 'EXPEDIE' },
        { fulfillmentType: 'INSTANTANE', status: 'ACHETE' },
      ]),
    );
    expect(where.updatedAt.lt).toBeInstanceOf(Date);
    const daysAgo = (Date.now() - where.updatedAt.lt.getTime()) / (24 * 60 * 60 * 1000);
    expect(daysAgo).toBeCloseTo(14, 0);
  });

  it('uses default batchSize=100', async () => {
    findMany.mockResolvedValueOnce([]);
    await autoDeliverMissions({ prisma });
    expect(findMany.mock.calls[0]![0]).toMatchObject({ take: 100, orderBy: { updatedAt: 'asc' } });
  });

  it('honors custom batchSize', async () => {
    findMany.mockResolvedValueOnce([]);
    await autoDeliverMissions({ prisma, batchSize: 25 });
    expect(findMany.mock.calls[0]![0].take).toBe(25);
  });

  it('auto-closes a candidate: updates status, creates status event, increments missionCount, notifies both parties', async () => {
    findMany.mockResolvedValueOnce([candidate]);
    updateMany.mockResolvedValueOnce({ count: 1 });

    const r = await autoDeliverMissions({ prisma });
    expect(r).toEqual({ autoDelivered: 1 });

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'mission-1', status: 'EXPEDIE' },
        data: expect.objectContaining({ status: 'AUTO_LIVRE' }),
      }),
    );
    expect(missionStatusEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          missionId: 'mission-1',
          status: 'AUTO_LIVRE',
          createdByUserId: 'buyer-1',
        }),
      }),
    );
    expect(agentProfileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'agent-1' },
        data: { missionCount: { increment: 1 } },
      }),
    );

    expect(mockCreateNotification).toHaveBeenCalledTimes(2);
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: 'buyer-1', type: 'MISSION_STATUS_CHANGED' }),
    );
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: 'agent-user-1', type: 'MISSION_STATUS_CHANGED' }),
    );
    // Different recipients must get distinct dedupeKeys (global-unique constraint).
    const calls = mockCreateNotification.mock.calls.map(
      (c) => (c[1] as { dedupeKey: string }).dedupeKey,
    );
    expect(new Set(calls).size).toBe(2);
  });

  it('auto-closes an INSTANTANE candidate stuck at ACHETE (not EXPEDIE)', async () => {
    const instantCandidate = { ...candidate, id: 'mission-2', status: 'ACHETE' };
    findMany.mockResolvedValueOnce([instantCandidate]);
    updateMany.mockResolvedValueOnce({ count: 1 });

    const r = await autoDeliverMissions({ prisma });
    expect(r).toEqual({ autoDelivered: 1 });
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'mission-2', status: 'ACHETE' },
        data: expect.objectContaining({ status: 'AUTO_LIVRE' }),
      }),
    );
  });

  it('skips a row the WHERE-guard rejects (buyer confirmed in the same moment)', async () => {
    findMany.mockResolvedValueOnce([candidate]);
    updateMany.mockResolvedValueOnce({ count: 0 });

    const r = await autoDeliverMissions({ prisma });
    expect(r).toEqual({ autoDelivered: 0 });
    expect(missionStatusEventCreate).not.toHaveBeenCalled();
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });
});
