// GET  /api/conversations/[id]/messages — cursor-paginated history for one
// thread (caller must be a participant). Newest-first, same (createdAt, id)
// cursor convention as every other list route — the client reverses the
// page for chronological display.
// POST /api/conversations/[id]/messages — send a message: persisted to DB
// (source of truth for history/pagination) then published server-side to
// the conversation's Ably channel (CLAUDE.md's recommended real-time
// pattern — the client never publishes directly, only subscribes).
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAnyMarketplaceRole } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { clampLimit, cursorWhere, buildPage, decodeCursor } from '@/lib/server/pagination/paginate';
import { resolveMediaUrls } from '@/lib/server/marketplace/media';
import { resolveParticipants } from '@/lib/server/marketplace/participant';
import { getAbly, conversationChannelName } from '@/lib/server/realtime/ably';
import { createNotification } from '@/lib/server/notifications';
import { newMessage } from '@/lib/server/notifications/templates';
import { MESSAGE_MAX_MEDIA } from '@/lib/marketplace';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const MESSAGE_SELECT = {
  id: true,
  conversationId: true,
  senderId: true,
  body: true,
  readAt: true,
  createdAt: true,
  media: { select: { fileUploadId: true } },
} as const satisfies Prisma.MessageSelect;

async function loadConversationForParticipant(id: string, userId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    select: { id: true, participantAId: true, participantBId: true },
  });
  if (
    !conversation ||
    (conversation.participantAId !== userId && conversation.participantBId !== userId)
  ) {
    return null;
  }
  return conversation;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const reqCtx = makeRequestContext(req.headers);
  return withRequestContext(reqCtx, async () => {
    const auth = await requireAnyMarketplaceRole(['BUYER', 'AGENT', 'WHOLESALER']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await ctx.params;
    const conversation = await loadConversationForParticipant(id, auth.user.sub);
    if (!conversation) {
      return NextResponse.json({ error: 'CONVERSATION_NOT_FOUND' }, { status: 404 });
    }

    const url = req.nextUrl;
    const limit = clampLimit(url.searchParams.get('limit'));
    const cursor = decodeCursor(url.searchParams.get('cursor'));

    const rows = await prisma.message.findMany({
      where: { conversationId: id, ...cursorWhere(cursor) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: MESSAGE_SELECT,
    });
    const page = buildPage(rows, limit);

    const allMediaIds = page.items.flatMap((m) => m.media.map((mm) => mm.fileUploadId));
    const mediaUrls = await resolveMediaUrls(allMediaIds);

    const items = page.items.map((m) => ({
      id: m.id,
      senderId: m.senderId,
      body: m.body,
      readAt: m.readAt,
      createdAt: m.createdAt,
      media: m.media.map((mm) => ({ url: mediaUrls.get(mm.fileUploadId) ?? null })),
    }));

    return NextResponse.json(
      { items, nextCursor: page.nextCursor },
      { headers: { 'x-request-id': reqCtx.requestId } },
    );
  });
}

const PostBody = z
  .object({
    body: z.string().trim().max(2000).optional(),
    mediaFileUploadIds: z.array(z.string()).max(MESSAGE_MAX_MEDIA).default([]),
  })
  .refine((v) => (v.body && v.body.length > 0) || v.mediaFileUploadIds.length > 0, {
    message: 'MESSAGE_EMPTY',
  });

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

    const parsed = PostBody.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'VALIDATION_FAILED' }, { status: 400 });
    }
    const { body, mediaFileUploadIds } = parsed.data;

    const { id } = await ctx.params;
    const conversation = await loadConversationForParticipant(id, auth.user.sub);
    if (!conversation) {
      return NextResponse.json({ error: 'CONVERSATION_NOT_FOUND' }, { status: 404 });
    }

    if (mediaFileUploadIds.length) {
      const owned = await prisma.fileUpload.count({
        where: { id: { in: mediaFileUploadIds }, userId: auth.user.sub },
      });
      if (owned !== mediaFileUploadIds.length) {
        return NextResponse.json({ error: 'UPLOAD_NOT_FOUND' }, { status: 400 });
      }
    }

    const recipientId =
      conversation.participantAId === auth.user.sub
        ? conversation.participantBId
        : conversation.participantAId;

    const message = await prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          conversationId: id,
          senderId: auth.user.sub,
          body: body ?? null,
          media: { create: mediaFileUploadIds.map((fileUploadId) => ({ fileUploadId })) },
        },
        select: MESSAGE_SELECT,
      });
      await tx.conversation.update({ where: { id }, data: { lastMessageAt: new Date() } });
      return created;
    });

    const mediaUrls = message.media.length
      ? await resolveMediaUrls(message.media.map((m) => m.fileUploadId))
      : new Map<string, string>();
    const payload = {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      body: message.body,
      createdAt: message.createdAt,
      media: message.media.map((m) => ({ url: mediaUrls.get(m.fileUploadId) ?? null })),
    };

    try {
      const ably = getAbly();
      if (ably) {
        await ably.channels.get(conversationChannelName(id)).publish('message', payload);
      }
    } catch {
      // Best-effort — the message is already persisted; the recipient
      // still sees it on next fetch even if the live push failed.
    }

    try {
      const [sender] = [...(await resolveParticipants([auth.user.sub])).values()];
      await createNotification(
        prisma,
        newMessage(
          recipientId,
          id,
          message.id,
          sender?.label ?? 'Nouveau message',
          message.body ? message.body.slice(0, 120) : '📷 Photo',
        ),
      );
    } catch {
      // Best-effort — the message is already committed.
    }

    return NextResponse.json(
      { message: payload },
      { status: 201, headers: { 'x-request-id': reqCtx.requestId } },
    );
  });
}
