// GET/PATCH /api/buyer/profile — the authed BUYER's own profile (PRD 3.9
// "Profil acheteur"). Deliberately thin (fullName/phone/deliveryCountry) —
// buyers aren't a public-facing entity like agents/wholesalers. Primary
// purpose: pre-fill deliveryCountry on POST /api/buyer/sourcing-requests.
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireMarketplaceRole } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { stripUndefined } from '@/lib/server/object-utils';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const PROFILE_SELECT = {
  fullName: true,
  phone: true,
  deliveryCountry: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireMarketplaceRole('BUYER');
    if (auth instanceof NextResponse) return auth;

    const profile = await prisma.buyerProfile.findUnique({
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
  fullName: z.string().trim().min(2).max(120).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  deliveryCountry: z.string().trim().min(2).max(80).nullable().optional(),
});

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireMarketplaceRole('BUYER');
    if (auth instanceof NextResponse) return auth;

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'VALIDATION_FAILED' }, { status: 400 });
    }

    const existing = await prisma.buyerProfile.findUnique({
      where: { userId: auth.user.sub },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'PROFILE_NOT_FOUND' }, { status: 404 });
    }

    const updated = await prisma.buyerProfile.update({
      where: { userId: auth.user.sub },
      data: stripUndefined(parsed.data),
      select: PROFILE_SELECT,
    });

    return NextResponse.json({ profile: updated }, { headers: { 'x-request-id': ctx.requestId } });
  });
}
