// frontend/src/lib/server/subscriptions/grace-sweep.ts — Phase 7.
//
// Two forward-only transitions, both driven by wall-clock comparisons
// against fields already on ProSubscription (no dedicated cron timestamp
// needed, mirrors mission-auto-deliver's use of Mission.updatedAt):
//   ACTIVE, currentPeriodEnd passed  -> GRACE   (still Pro for
//     SUBSCRIPTION_GRACE_DAYS more days; unrenewed because there is no
//     recurring-charge API, only manual re-checkout)
//   GRACE,  graceEndsAt passed       -> EXPIRED (Pro benefits actually lost)
//
// Each row transition uses a status-guarded `updateMany` (WHERE id AND
// status = <expected>) so a user who renews mid-sweep (their status moves
// to ACTIVE/currentPeriodEnd moves forward via the checkout webhook) can't
// race this cron into wrongly downgrading them — the guard clause simply
// matches 0 rows and the sweep skips it.
import 'server-only';
import type { PrismaClient } from '@prisma/client';
import { createNotification } from '@/lib/server/notifications';
import {
  subscriptionGraceStarted,
  subscriptionDowngraded,
} from '@/lib/server/notifications/templates';
import { SUBSCRIPTION_GRACE_DAYS } from '@/lib/marketplace';

const GRACE_MS = SUBSCRIPTION_GRACE_DAYS * 24 * 60 * 60 * 1000;

export interface SweepGracePeriodsOptions {
  prisma: PrismaClient;
  batchSize?: number; // default 100 per transition — matches expirePendingOrders convention
}

export async function sweepGracePeriods(
  opts: SweepGracePeriodsOptions,
): Promise<{ startedGrace: number; expired: number }> {
  const batchSize = opts.batchSize ?? 100;
  const now = new Date();

  // 1) ACTIVE -> GRACE
  const lapsedActive = await opts.prisma.proSubscription.findMany({
    where: { status: 'ACTIVE', currentPeriodEnd: { lt: now } },
    orderBy: { currentPeriodEnd: 'asc' },
    take: batchSize,
    select: { id: true, userId: true, plan: true, currentPeriodEnd: true },
  });

  let startedGrace = 0;
  for (const sub of lapsedActive) {
    if (!sub.currentPeriodEnd) continue;
    const graceEndsAt = new Date(sub.currentPeriodEnd.getTime() + GRACE_MS);
    const updated = await opts.prisma.proSubscription.updateMany({
      where: { id: sub.id, status: 'ACTIVE' },
      data: { status: 'GRACE', graceEndsAt },
    });
    if (updated.count === 0) continue;
    startedGrace++;
    try {
      await createNotification(
        opts.prisma,
        subscriptionGraceStarted(sub.userId, sub.plan, graceEndsAt),
      );
    } catch {
      // Best-effort — the status transition is already committed.
    }
  }

  // 2) GRACE -> EXPIRED
  const lapsedGrace = await opts.prisma.proSubscription.findMany({
    where: { status: 'GRACE', graceEndsAt: { lt: now } },
    orderBy: { graceEndsAt: 'asc' },
    take: batchSize,
    select: { id: true, userId: true, plan: true, graceEndsAt: true },
  });

  let expired = 0;
  for (const sub of lapsedGrace) {
    if (!sub.graceEndsAt) continue;
    const updated = await opts.prisma.proSubscription.updateMany({
      where: { id: sub.id, status: 'GRACE' },
      data: { status: 'EXPIRED' },
    });
    if (updated.count === 0) continue;
    expired++;
    try {
      await createNotification(
        opts.prisma,
        subscriptionDowngraded(sub.userId, sub.plan, sub.graceEndsAt),
      );
    } catch {
      // Best-effort — the status transition is already committed.
    }
  }

  return { startedGrace, expired };
}
