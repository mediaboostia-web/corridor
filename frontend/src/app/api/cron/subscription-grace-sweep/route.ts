export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyCronSecret } from '@/lib/server/cron/auth';
import { withLease } from '@/lib/server/leader-lease';
import { sweepGracePeriods } from '@/lib/server/subscriptions/grace-sweep';
import { prisma } from '@/lib/server/prisma';
import { redis } from '@/lib/server/redis';
import { createLogger } from '@/lib/server/logger';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const log = createLogger();
const LEASE_TTL_MS = 60_000; // ~2 × maxDuration

export async function POST(req: NextRequest): Promise<NextResponse> {
  const fail = verifyCronSecret(req);
  if (fail) return fail;

  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    let startedGrace = 0;
    let expired = 0;

    await withLease(redis ?? undefined, 'subscription-grace-sweep', LEASE_TTL_MS, async () => {
      const result = await sweepGracePeriods({ prisma });
      startedGrace = result.startedGrace;
      expired = result.expired;
      log.info('subscription-grace-sweep tick', {
        startedGrace,
        expired,
        requestId: ctx.requestId,
      });
    });

    return NextResponse.json(
      { ok: true, startedGrace, expired },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
