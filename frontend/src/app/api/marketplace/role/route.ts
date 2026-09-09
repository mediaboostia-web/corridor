// POST /api/marketplace/role — Corridor Sourcing role choice.
//
// Called once, right after email verification, from /onboarding/choisir-role.
// Sets User.marketplaceRole (BUYER | AGENT | WHOLESALER) and creates the
// corresponding profile row in the same transaction: an empty BuyerProfile
// for BUYER (filled in later via /buyer/profil, Phase 2), or an
// AGENT/WHOLESALER profile with a placeholder displayName/shopName + unique
// slug derived from the email local-part — editable later (Phase 3
// "Vérification" / Phase 1 "Ma boutique"). Immutable in self-service: a
// second call returns 409 ROLE_ALREADY_SET (role changes go through admin
// tooling, not this route).
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { slugify, ensureUniqueSlug } from '@/lib/server/slug';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { log } from '@/lib/server/observability/log';

const Body = z.object({
  role: z.enum(['BUYER', 'AGENT', 'WHOLESALER']),
});

function jsonError(
  code: string,
  status: number,
  requestId: string,
  message?: string,
): NextResponse {
  const res = NextResponse.json({ error: code, ...(message ? { message } : {}) }, { status });
  res.headers.set('x-request-id', requestId);
  return res;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) {
      csrfFail.headers.set('x-request-id', ctx.requestId);
      return csrfFail;
    }

    const auth = await requireAuth(req.headers.get('authorization'));
    if (auth instanceof NextResponse) {
      auth.headers.set('x-request-id', ctx.requestId);
      return auth;
    }

    const json = await req.json().catch(() => null);
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return jsonError(
        'VALIDATION_FAILED',
        400,
        ctx.requestId,
        'role must be BUYER, AGENT, or WHOLESALER',
      );
    }
    const { role } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: auth.user.sub },
      select: { id: true, email: true, marketplaceRole: true },
    });
    if (!user) {
      return jsonError('USER_NOT_FOUND', 404, ctx.requestId);
    }
    if (user.marketplaceRole) {
      return jsonError(
        'ROLE_ALREADY_SET',
        409,
        ctx.requestId,
        'Marketplace role is already set and cannot be changed here.',
      );
    }

    const baseSlug = slugify(user.email.split('@')[0] ?? 'user');

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { marketplaceRole: role, marketplaceRoleSetAt: new Date() },
      });

      if (role === 'BUYER') {
        await tx.buyerProfile.create({ data: { userId: user.id } });
      } else if (role === 'AGENT') {
        await ensureUniqueSlug(baseSlug, (slug) =>
          tx.agentProfile.create({
            data: {
              userId: user.id,
              displayName: user.email.split('@')[0] ?? 'Agent',
              publicSlug: slug,
            },
          }),
        );
      } else if (role === 'WHOLESALER') {
        await ensureUniqueSlug(baseSlug, (slug) =>
          tx.wholesalerProfile.create({
            data: {
              userId: user.id,
              shopName: user.email.split('@')[0] ?? 'Boutique',
              slug,
            },
          }),
        );
      }
    });

    log.info('marketplace role set', { userId: user.id, role });

    const res = NextResponse.json({ ok: true, marketplaceRole: role }, { status: 200 });
    res.headers.set('x-request-id', ctx.requestId);
    return res;
  });
}
