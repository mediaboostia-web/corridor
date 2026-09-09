// frontend/src/lib/server/missions/auto-deliver.ts — Phase 4, US9.
//
// Find Mission rows stuck at their last agent-settable status for >= 14
// days (buyer never confirmed) and auto-close them to AUTO_LIVRE in batches
// of `batchSize`. That status is EXPEDIE for a STANDARD mission or ACHETE
// for an INSTANTANE one (lib/mission-status.ts, lastAgentStatus) — the same
// 14-day window applies to both in v1 rather than a shorter one for
// INSTANTANE, to keep the cron simple; revisit if same-day missions turn
// out to need faster fallback closure. Mirrors lib/server/orders/expire.ts:
// a per-row transaction guarded by a `status: m.status` WHERE-clause on the
// update prevents racing a buyer who confirms delivery in the same moment
// the cron processes that row.
//
// `Mission.updatedAt` is used as the "since last agent status" clock rather
// than a dedicated timestamp — nothing else touches a mission's row once it
// reaches its last agent-settable status (the agent has no further forward
// move, and the buyer's confirm-delivery route is the only other writer),
// so it's an accurate proxy without a schema change.
import 'server-only';
import type { PrismaClient } from '@prisma/client';
import { createNotification } from '@/lib/server/notifications';
import { missionStatusChanged } from '@/lib/server/notifications/templates';
import { MISSION_STATUS_LABEL, lastAgentStatus } from '@/lib/mission-status';

const AUTO_DELIVER_AFTER_MS = 14 * 24 * 60 * 60 * 1000; // US9 — 14 days

export interface AutoDeliverMissionsOptions {
  prisma: PrismaClient;
  batchSize?: number; // default 100 — matches expirePendingOrders convention
}

export async function autoDeliverMissions(
  opts: AutoDeliverMissionsOptions,
): Promise<{ autoDelivered: number }> {
  const batchSize = opts.batchSize ?? 100;
  const cutoff = new Date(Date.now() - AUTO_DELIVER_AFTER_MS);

  const candidates = await opts.prisma.mission.findMany({
    where: {
      updatedAt: { lt: cutoff },
      OR: [
        { fulfillmentType: 'STANDARD', status: lastAgentStatus('STANDARD') },
        { fulfillmentType: 'INSTANTANE', status: lastAgentStatus('INSTANTANE') },
      ],
    },
    orderBy: { updatedAt: 'asc' },
    take: batchSize,
    select: {
      id: true,
      status: true,
      buyerId: true,
      agentProfileId: true,
      agentProfile: { select: { userId: true } },
      sourcingRequest: { select: { title: true } },
    },
  });

  if (candidates.length === 0) return { autoDelivered: 0 };

  let autoDelivered = 0;
  for (const m of candidates) {
    const autoClosedAt = new Date();
    const closed = await opts.prisma.$transaction(async (tx) => {
      const updated = await tx.mission.updateMany({
        where: { id: m.id, status: m.status },
        data: { status: 'AUTO_LIVRE', autoClosedAt },
      });
      if (updated.count === 0) return false;

      await tx.missionStatusEvent.create({
        data: {
          missionId: m.id,
          status: 'AUTO_LIVRE',
          note: 'Livraison confirmée automatiquement après 14 jours sans action de l’acheteur.',
          createdByUserId: m.buyerId,
        },
      });
      await tx.agentProfile.update({
        where: { id: m.agentProfileId },
        data: { missionCount: { increment: 1 } },
      });
      return true;
    });

    if (!closed) continue;
    autoDelivered++;

    try {
      await createNotification(
        opts.prisma,
        missionStatusChanged(
          m.buyerId,
          m.id,
          'AUTO_LIVRE',
          MISSION_STATUS_LABEL.AUTO_LIVRE,
          m.sourcingRequest.title,
        ),
      );
      await createNotification(
        opts.prisma,
        missionStatusChanged(
          m.agentProfile.userId,
          m.id,
          'AUTO_LIVRE',
          MISSION_STATUS_LABEL.AUTO_LIVRE,
          m.sourcingRequest.title,
        ),
      );
    } catch {
      // Best-effort — the auto-close is already committed.
    }
  }
  return { autoDelivered };
}
