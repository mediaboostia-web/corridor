// POST /api/realtime/token — mints a short-lived Ably TokenRequest scoped
// to exactly the conversation channels the caller participates in (Phase 5,
// per CLAUDE.md's recommended Ably pattern). The raw ABLY_API_KEY never
// leaves the server; the browser only ever holds this capability-limited
// token. Read-only capability (subscribe + presence) — publishing a
// message always goes through POST /api/conversations/[id]/messages so the
// server can persist to DB + validate participants before fanning out.
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAnyMarketplaceRole } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { getAbly, conversationChannelName } from '@/lib/server/realtime/ably';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const TOKEN_TTL_MS = 60 * 60 * 1000;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAnyMarketplaceRole(['BUYER', 'AGENT', 'WHOLESALER']);
    if (auth instanceof NextResponse) return auth;

    const ably = getAbly();
    if (!ably) {
      return NextResponse.json({ error: 'REALTIME_NOT_CONFIGURED' }, { status: 503 });
    }

    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [{ participantAId: auth.user.sub }, { participantBId: auth.user.sub }],
      },
      select: { id: true },
    });

    const capability: Record<string, ['subscribe', 'presence']> = {};
    for (const c of conversations) {
      capability[conversationChannelName(c.id)] = ['subscribe', 'presence'];
    }

    const tokenRequest = await ably.auth.createTokenRequest({
      clientId: auth.user.sub,
      capability,
      ttl: TOKEN_TTL_MS,
    });

    return NextResponse.json(tokenRequest, { headers: { 'x-request-id': ctx.requestId } });
  });
}
