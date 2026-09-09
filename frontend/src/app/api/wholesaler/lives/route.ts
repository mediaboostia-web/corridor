// GET/POST /api/wholesaler/lives — Phase 1 "Lives". A LiveAnnouncement is a
// time-boxed signal, not a hosted stream (the live itself happens off-
// platform — TikTok/Facebook/Zoom, per the external link). `status` in the
// response is DERIVED from now() vs. [scheduledStart, scheduledEnd] via
// deriveLiveStatus — see lib/live-status.ts. The persisted `status` column
// only ever holds SCHEDULED or CANCELLED (ENDED is never written — it's
// pure derivation from a past window).
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireMarketplaceRole } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { stripUndefined } from '@/lib/server/object-utils';
import { deriveLiveStatus } from '@/lib/live-status';
import { clampLimit, cursorWhere, buildPage, decodeCursor } from '@/lib/server/pagination/paginate';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const LIVE_SELECT = {
  id: true,
  title: true,
  externalLink: true,
  scheduledStart: true,
  scheduledEnd: true,
  status: true,
  createdAt: true,
} as const;

function serializeLive<T extends { status: string; scheduledStart: Date; scheduledEnd: Date }>(
  live: T,
) {
  return { ...live, derivedStatus: deriveLiveStatus(live) };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireMarketplaceRole('WHOLESALER');
    if (auth instanceof NextResponse) return auth;

    const profile = await prisma.wholesalerProfile.findUnique({
      where: { userId: auth.user.sub },
      select: { id: true },
    });
    if (!profile) return NextResponse.json({ error: 'PROFILE_NOT_FOUND' }, { status: 404 });

    const url = req.nextUrl;
    const limit = clampLimit(url.searchParams.get('limit'));
    const cursor = decodeCursor(url.searchParams.get('cursor'));

    const rows = await prisma.liveAnnouncement.findMany({
      where: { wholesalerProfileId: profile.id, ...cursorWhere(cursor) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: LIVE_SELECT,
    });

    const page = buildPage(rows, limit);
    return NextResponse.json(
      { items: page.items.map(serializeLive), nextCursor: page.nextCursor },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}

const CreateBody = z
  .object({
    title: z.string().trim().max(150).nullable().optional(),
    externalLink: z.string().trim().url().max(500),
    scheduledStart: z.coerce.date(),
    scheduledEnd: z.coerce.date(),
  })
  .refine((v) => v.scheduledEnd > v.scheduledStart, {
    message: 'scheduledEnd must be after scheduledStart',
    path: ['scheduledEnd'],
  })
  .refine((v) => v.scheduledEnd > new Date(), {
    message: 'scheduledEnd must be in the future',
    path: ['scheduledEnd'],
  });

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireMarketplaceRole('WHOLESALER');
    if (auth instanceof NextResponse) return auth;

    const profile = await prisma.wholesalerProfile.findUnique({
      where: { userId: auth.user.sub },
      select: { id: true },
    });
    if (!profile) return NextResponse.json({ error: 'PROFILE_NOT_FOUND' }, { status: 404 });

    const parsed = CreateBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'VALIDATION_FAILED' }, { status: 400 });
    }

    const created = await prisma.liveAnnouncement.create({
      data: { ...stripUndefined(parsed.data), wholesalerProfileId: profile.id },
      select: LIVE_SELECT,
    });

    return NextResponse.json(
      { live: serializeLive(created) },
      { status: 201, headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
