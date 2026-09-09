// POST /api/admin/products/[id]/approve — PENDING -> PUBLISHED.
// Audit metadata shape: action 'product.approve', metadata { previousStatus }.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAdmin } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { logAdminAction } from '@/lib/server/admin/audit';
import { createNotification } from '@/lib/server/notifications';
import { productApproved } from '@/lib/server/notifications/templates';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

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
          status: 'PUBLISHED',
          moderatedByUserId: auth.admin.id,
          moderatedAt,
          rejectionReason: null,
        },
        select: { id: true, name: true, status: true },
      });

      await logAdminAction(tx, {
        actorId: auth.admin.id,
        action: 'product.approve',
        targetType: 'Product',
        targetId: id,
        metadata: { previousStatus: product.status },
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
        productApproved(result.ownerUserId, result.product.id, result.product.name, moderatedAt),
      );
    } catch {
      // Best-effort — the approval is already committed.
    }

    return NextResponse.json(
      { product: result.product },
      { headers: { 'x-request-id': reqCtx.requestId } },
    );
  });
}
