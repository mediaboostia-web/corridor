'use client';

// Small client helper behind every "Contacter" button (Phase 5 —
// messagerie entry points from mission/commande pages). Finds or creates
// the thread via POST /api/conversations (kind is derived server-side from
// the two users' actual roles — never trusted from here) and returns the
// conversationId to route to `/<role>/messagerie?conversationId=...`.
import { api } from './api';

export async function openOrCreateConversation(
  otherUserId: string,
  opts: {
    subjectType?: 'MISSION' | 'SOURCING_REQUEST' | 'PRODUCT' | 'GENERAL';
    subjectId?: string;
  } = {},
): Promise<string> {
  const res = await api<{ conversationId: string }>('/api/conversations', {
    method: 'POST',
    body: { otherUserId, ...opts },
  });
  return res.conversationId;
}
