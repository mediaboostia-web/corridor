// ADMIN-01 — GET /api/admin/users/[id] (detail).
//
// Sequence: makeRequestContext → withRequestContext → requireAdmin('ADMIN')
// → enforceAdminRateLimit → prisma.user.findUnique with the same PII-safe
// USER_SELECT shape as the list endpoint. 404 on miss with stable code
// USER_NOT_FOUND.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { requireAdmin } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

// Phase 8 (PRD 3.23 "voir l'activité détaillée d'un utilisateur") — the
// marketplace-specific profile relations are all optional 1:1s, so
// selecting all three costs nothing extra for a user who only has one of
// them (Prisma returns null for the ones that don't apply).
const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  role: true,
  status: true,
  marketplaceRole: true,
  emailVerifiedAt: true,
  createdAt: true,
  buyerProfile: { select: { fullName: true, phone: true, deliveryCountry: true } },
  agentProfile: {
    select: {
      id: true,
      displayName: true,
      verificationStatus: true,
      isSuspended: true,
      avgRating: true,
      reviewCount: true,
      missionCount: true,
      publicSlug: true,
    },
  },
  wholesalerProfile: { select: { id: true, shopName: true, slug: true, status: true } },
  proSubscription: { select: { plan: true, status: true, currentPeriodEnd: true } },
} as const satisfies Prisma.UserSelect;

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const reqCtx = makeRequestContext(req.headers);
  return withRequestContext(reqCtx, async () => {
    const auth = await requireAdmin('ADMIN');
    if (auth instanceof NextResponse) return auth;

    const limited = await enforceAdminRateLimit(auth.admin.id);
    if (limited) return limited;

    const { id } = await ctx.params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
    if (!user) {
      return NextResponse.json(
        { error: 'USER_NOT_FOUND', message: 'User not found' },
        { status: 404, headers: { 'x-request-id': reqCtx.requestId } },
      );
    }
    return NextResponse.json({ user }, { headers: { 'x-request-id': reqCtx.requestId } });
  });
}
