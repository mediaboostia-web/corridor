// frontend/src/lib/server/subscriptions/renewal-reminder.ts — Phase 7, F27/US8.
//
// Find ACTIVE ProSubscription rows whose currentPeriodEnd falls within the
// J-3 reminder window and notify the owner. Mirrors
// lib/server/missions/auto-deliver.ts: a plain read + best-effort
// createNotification loop (no transaction needed — this only reads
// ProSubscription and writes Notification, no domain-state mutation).
import 'server-only';
import type { PrismaClient } from '@prisma/client';
import { createNotification } from '@/lib/server/notifications';
import { subscriptionRenewalReminder } from '@/lib/server/notifications/templates';
import { SUBSCRIPTION_RENEWAL_REMINDER_LEAD_DAYS } from '@/lib/marketplace';

const LEAD_MS = SUBSCRIPTION_RENEWAL_REMINDER_LEAD_DAYS * 24 * 60 * 60 * 1000;

export interface SendRenewalRemindersOptions {
  prisma: PrismaClient;
  batchSize?: number; // default 100 — matches expirePendingOrders convention
}

export async function sendRenewalReminders(
  opts: SendRenewalRemindersOptions,
): Promise<{ reminded: number }> {
  const batchSize = opts.batchSize ?? 100;
  const now = new Date();
  const windowEnd = new Date(now.getTime() + LEAD_MS);

  const candidates = await opts.prisma.proSubscription.findMany({
    where: { status: 'ACTIVE', currentPeriodEnd: { gt: now, lte: windowEnd } },
    orderBy: { currentPeriodEnd: 'asc' },
    take: batchSize,
    select: { userId: true, plan: true, currentPeriodEnd: true },
  });

  let reminded = 0;
  for (const sub of candidates) {
    if (!sub.currentPeriodEnd) continue;
    try {
      const sent = await createNotification(
        opts.prisma,
        subscriptionRenewalReminder(sub.userId, sub.plan, sub.currentPeriodEnd),
      );
      if (sent) reminded++;
    } catch {
      // Best-effort — skip to the next candidate, next tick retries.
    }
  }
  return { reminded };
}
