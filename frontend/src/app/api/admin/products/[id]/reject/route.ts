// POST /api/admin/products/[id]/reject — PENDING -> DRAFT with a reason the
// owner can act on (there is no REJECTED status — the schema comment on
// Product.status explains why: rejection sends the product back to DRAFT so
// the owner edits and resubmits, rather than a dead-end terminal state).
// Audit metadata shape: action 'product.reject', metadata { reason }.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAdmin } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { logAdminAction } from '@/lib/server/admin/audit';
import { createNotification } from '@/lib/server/notifications';
import { productRejected } from '@/lib/server/notifications/templates';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const Body = z.object({ reason: z.string().trim().min(1).max(500) });

type Discriminator =
  | { kind: 'NOT_FOUND' }
  | { kind: 'NOT_PENDING' }
  | { kind: 'OK'; product: { id: string; name: string; status: string }; ownerUserId: string };

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const reqCtx = makeRequestContext(req.headers);
  return withRequestContext(reqCtx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAdmin('ADMIN');
    if (auth instanceof NextResponse) return auth;

    const limited = await enforceAdminRateLimit(auth.admin.id);
    if (limited) return limited;

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'VALIDATION_FAILED' }, { status: 400 });
    }

    const { id } = await ctx.params;
    const moderatedAt = new Date();

    const result: Discriminator = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          status: true,
          wholesalerProfile: { select: { userId: true } },
        },
      });
      if (!product) return { kind: 'NOT_FOUND' as const };
      if (product.status !== 'PENDING') return { kind: 'NOT_PENDING' as const };

      const updated = await tx.product.update({
        where: { id },
        data: {
          status: 'DRAFT',
          moderatedByUserId: auth.admin.id,
          moderatedAt,
          rejectionReason: parsed.data.reason,
        },
        select: { id: true, name: true, status: true },
      });

      await logAdminAction(tx, {
        actorId: auth.admin.id,
        action: 'product.reject',
        targetType: 'Product',
        targetId: id,
        metadata: { reason: parsed.data.reason },
      });

      return {
        kind: 'OK' as const,
        product: updated,
        ownerUserId: product.wholesalerProfile.userId,
      };
    });

    if (result.kind === 'NOT_FOUND') {
      return NextResponse.json({ error: 'PRODUCT_NOT_FOUND' }, { status: 404 });
    }
    if (result.kind === 'NOT_PENDING') {
      return NextResponse.json({ error: 'PRODUCT_NOT_PENDING' }, { status: 409 });
    }

    try {
      await createNotification(
        prisma,
        productRejected(
          result.ownerUserId,
          result.product.id,
          result.product.name,
          parsed.data.reason,
          moderatedAt,
        ),
      );
    } catch {
      // Best-effort — the rejection is already committed.
    }

    return NextResponse.json(
      { product: result.product },
      { headers: { 'x-request-id': reqCtx.requestId } },
    );
  });
}
