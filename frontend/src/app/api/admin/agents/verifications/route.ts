// GET /api/admin/agents/verifications — agent identity-verification queue
// (Phase 3 "/admin/verifications-agents"). Defaults to `status=PENDING`
// (the actionable queue); pass `?status=` to see other lifecycle states.
// Mirrors the admin/products moderation listing pattern.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { requireAdmin } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { resolveMediaUrls } from '@/lib/server/marketplace/media';
import { clampLimit, cursorWhere, buildPage, decodeCursor } from '@/lib/server/pagination/paginate';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const AGENT_SELECT = {
  id: true,
  displayName: true,
  actionZone: true,
  phone: true,
  verificationStatus: true,
  verificationSubmittedAt: true,
  idFrontUploadId: true,
  idBackUploadId: true,
  selfieUploadId: true,
  createdAt: true,
  user: { select: { email: true } },
} as const satisfies Prisma.AgentProfileSelect;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAdmin('ADMIN');
    if (auth instanceof NextResponse) return auth;

    const limited = await enforceAdminRateLimit(auth.admin.id);
    if (limited) return limited;

    const url = req.nextUrl;
    const limit = clampLimit(url.searchParams.get('limit'));
    const status = url.searchParams.get('status') ?? 'PENDING';
    const cursor = decodeCursor(url.searchParams.get('cursor'));

    const where: Prisma.AgentProfileWhereInput = {
      verificationStatus: status,
      ...cursorWhere(cursor),
    };

    const rows = await prisma.agentProfile.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: AGENT_SELECT,
    });

    const page = buildPage(rows, limit);
    const allUploadIds = page.items.flatMap((a) =>
      [a.idFrontUploadId, a.idBackUploadId, a.selfieUploadId].filter(
        (v): v is string => v !== null,
      ),
    );
    const urls = await resolveMediaUrls(allUploadIds);

    const items = page.items.map((a) => ({
      id: a.id,
      displayName: a.displayName,
      actionZone: a.actionZone,
      phone: a.phone,
      email: a.user.email,
      verificationStatus: a.verificationStatus,
      submittedAt: a.verificationSubmittedAt,
      idFrontUrl: a.idFrontUploadId ? (urls.get(a.idFrontUploadId) ?? null) : null,
      idBackUrl: a.idBackUploadId ? (urls.get(a.idBackUploadId) ?? null) : null,
      selfieUrl: a.selfieUploadId ? (urls.get(a.selfieUploadId) ?? null) : null,
    }));

    return NextResponse.json(
      { items, nextCursor: page.nextCursor },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
