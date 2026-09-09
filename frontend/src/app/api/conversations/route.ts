// GET  /api/conversations — the caller's own conversations (any of the 3
// marketplace roles), newest activity first, with the other participant's
// display label + an unread count per thread (Phase 5 — messagerie).
// POST /api/conversations — find-or-create a thread with `otherUserId`.
// `kind` is never accepted from the client: it's derived from the two
// users' actual marketplaceRole so a request can't forge e.g. a
// BUYER_WHOLESALER thread between two agents.
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAnyMarketplaceRole } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { resolveParticipants } from '@/lib/server/marketplace/participant';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAnyMarketplaceRole(['BUYER', 'AGENT', 'WHOLESALER']);
    if (auth instanceof NextResponse) return auth;

    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [{ participantAId: auth.user.sub }, { participantBId: auth.user.sub }],
      },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
      take: 100,
      select: {
        id: true,
        kind: true,
        subjectType: true,
        subjectId: true,
        participantAId: true,
        participantBId: true,
        lastMessageAt: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { body: true, senderId: true, createdAt: true },
        },
      },
    });

    const otherIds = conversations.map((c) =>
      c.participantAId === auth.user.sub ? c.participantBId : c.participantAId,
    );
    const participants = await resolveParticipants(otherIds);

    const unreadRows = conversations.length
      ? await prisma.message.groupBy({
          by: ['conversationId'],
          where: {
            conversationId: { in: conversations.map((c) => c.id) },
            senderId: { not: auth.user.sub },
            readAt: null,
          },
          _count: { _all: true },
        })
      : [];
    const unreadByConversation = new Map(unreadRows.map((r) => [r.conversationId, r._count._all]));

    const items = conversations.map((c) => {
      const otherId = c.participantAId === auth.user.sub ? c.participantBId : c.participantAId;
      const lastMessage = c.messages[0] ?? null;
      return {
        id: c.id,
        kind: c.kind,
        subjectType: c.subjectType,
        subjectId: c.subjectId,
        otherParticipant: participants.get(otherId) ?? {
          userId: otherId,
          marketplaceRole: null,
          label: 'Utilisateur',
          href: null,
        },
        lastMessage: lastMessage
          ? {
              body: lastMessage.body,
              senderId: lastMessage.senderId,
              createdAt: lastMessage.createdAt,
            }
          : null,
        unreadCount: unreadByConversation.get(c.id) ?? 0,
      };
    });

    return NextResponse.json({ items }, { headers: { 'x-request-id': ctx.requestId } });
  });
}

const PostBody = z.object({
  otherUserId: z.string(),
  subjectType: z.enum(['MISSION', 'SOURCING_REQUEST', 'PRODUCT', 'GENERAL']).optional(),
  subjectId: z.string().optional(),
});

function deriveConversationKind(roleA: string | null, roleB: string | null): string | null {
  if (!roleA || !roleB || roleA === roleB) return null;
  const pair = [roleA, roleB].sort().join('_'); // AGENT_BUYER | BUYER_WHOLESALER | AGENT_WHOLESALER
  if (pair === 'AGENT_BUYER') return 'BUYER_AGENT';
  if (pair === 'BUYER_WHOLESALER') return 'BUYER_WHOLESALER';
  if (pair === 'AGENT_WHOLESALER') return 'AGENT_WHOLESALER';
  return null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAnyMarketplaceRole(['BUYER', 'AGENT', 'WHOLESALER']);
    if (auth instanceof NextResponse) return auth;

    const parsed = PostBody.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'VALIDATION_FAILED' }, { status: 400 });
    }
    const { otherUserId, subjectType, subjectId } = parsed.data;

    if (otherUserId === auth.user.sub) {
      return NextResponse.json({ error: 'CANNOT_MESSAGE_SELF' }, { status: 400 });
    }

    const otherUser = await prisma.user.findUnique({
      where: { id: otherUserId },
      select: { id: true, marketplaceRole: true },
    });
    if (!otherUser) {
      return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 });
    }

    const kind = deriveConversationKind(auth.marketplaceRole, otherUser.marketplaceRole);
    if (!kind) {
      return NextResponse.json({ error: 'INVALID_PARTICIPANT_PAIR' }, { status: 400 });
    }

    // Defensive: a subject-tagged thread (e.g. "about this Mission") may
    // only be opened by someone actually party to that Mission.
    if (subjectType === 'MISSION' && subjectId) {
      const mission = await prisma.mission.findUnique({
        where: { id: subjectId },
        select: {
          buyerId: true,
          agentProfile: { select: { userId: true } },
          wholesalerProfile: { select: { userId: true } },
        },
      });
      const partyIds = mission
        ? [mission.buyerId, mission.agentProfile.userId, mission.wholesalerProfile?.userId].filter(
            (v): v is string => !!v,
          )
        : [];
      if (!mission || !partyIds.includes(auth.user.sub) || !partyIds.includes(otherUserId)) {
        return NextResponse.json({ error: 'MISSION_NOT_FOUND' }, { status: 404 });
      }
    }

    const whereBoth = {
      kind,
      subjectType: subjectType ?? null,
      subjectId: subjectId ?? null,
      OR: [
        { participantAId: auth.user.sub, participantBId: otherUserId },
        { participantAId: otherUserId, participantBId: auth.user.sub },
      ],
    };

    const existing = await prisma.conversation.findFirst({
      where: whereBoth,
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { conversationId: existing.id, created: false },
        { headers: { 'x-request-id': ctx.requestId } },
      );
    }

    try {
      const created = await prisma.conversation.create({
        data: {
          kind,
          subjectType: subjectType ?? null,
          subjectId: subjectId ?? null,
          participantAId: auth.user.sub,
          participantBId: otherUserId,
        },
        select: { id: true },
      });
      return NextResponse.json(
        { conversationId: created.id, created: true },
        { status: 201, headers: { 'x-request-id': ctx.requestId } },
      );
    } catch (err) {
      // Race: another request created the same (kind, subject, pair)
      // conversation between the find and the create — duck-typed P2002
      // catch mirrors the slug.ts / notifications dedup pattern.
      if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
        const raced = await prisma.conversation.findFirst({
          where: whereBoth,
          select: { id: true },
        });
        if (raced) {
          return NextResponse.json(
            { conversationId: raced.id, created: false },
            { headers: { 'x-request-id': ctx.requestId } },
          );
        }
      }
      throw err;
    }
  });
}
