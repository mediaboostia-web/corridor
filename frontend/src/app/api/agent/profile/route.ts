// GET/PATCH /api/agent/profile — the authed AGENT's own public-profile
// editable fields (Phase 3 "Mon profil public"). `actionZone` is
// intentionally NOT editable here — it's collected together with the ID
// documents in POST /api/agent/verification since admins review it
// alongside the KYC submission. `publicSlug` is immutable (set once at role
// choice, it's the public URL /agents/[slug]).
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireMarketplaceRole } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { stripUndefined } from '@/lib/server/object-utils';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const PROFILE_SELECT = {
  id: true,
  displayName: true,
  bio: true,
  actionZone: true,
  phone: true,
  publicSlug: true,
  verificationStatus: true,
  verificationRejectionReason: true,
  missionCount: true,
  avgRating: true,
  reviewCount: true,
  isSuspended: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireMarketplaceRole('AGENT');
    if (auth instanceof NextResponse) return auth;

    const profile = await prisma.agentProfile.findUnique({
      where: { userId: auth.user.sub },
      select: PROFILE_SELECT,
    });
    if (!profile) {
      return NextResponse.json({ error: 'PROFILE_NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json({ profile }, { headers: { 'x-request-id': ctx.requestId } });
  });
}

const Body = z.object({
  displayName: z.string().trim().min(2).max(120).optional(),
  bio: z.string().trim().max(2000).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
});

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireMarketplaceRole('AGENT');
    if (auth instanceof NextResponse) return auth;

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'VALIDATION_FAILED' }, { status: 400 });
    }

    const existing = await prisma.agentProfile.findUnique({
      where: { userId: auth.user.sub },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'PROFILE_NOT_FOUND' }, { status: 404 });
    }

    const updated = await prisma.agentProfile.update({
      where: { userId: auth.user.sub },
      data: stripUndefined(parsed.data),
      select: PROFILE_SELECT,
    });

    return NextResponse.json({ profile: updated }, { headers: { 'x-request-id': ctx.requestId } });
  });
}
