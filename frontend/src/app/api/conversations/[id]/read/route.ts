// POST /api/conversations/[id]/read — marks every message the OTHER
// participant sent as read (Phase 5 — messagerie unread badge). Called by
// the client when a thread is opened. Idempotent (updateMany on
// readAt: null — a second call is a no-op).
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAnyMarketplaceRole } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const reqCtx = makeRequestContext(req.headers);
  return withRequestContext(reqCtx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAnyMarketplaceRole(['BUYER', 'AGENT', 'WHOLESALER']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await ctx.params;
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: { participantAId: true, participantBId: true },
    });
    if (
      !conversation ||
      (conversation.participantAId !== auth.user.sub &&
        conversation.participantBId !== auth.user.sub)
    ) {
      return NextResponse.json({ error: 'CONVERSATION_NOT_FOUND' }, { status: 404 });
    }

    const result = await prisma.message.updateMany({
      where: { conversationId: id, senderId: { not: auth.user.sub }, readAt: null },
      data: { readAt: new Date() },
    });

    return NextResponse.json(
      { markedRead: result.count },
      { headers: { 'x-request-id': reqCtx.requestId } },
    );
  });
}
