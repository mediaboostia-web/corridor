// Server-only Ably REST singleton (Corridor Sourcing Phase 5 — messagerie).
// Mirrors the redis.ts / prisma.ts singleton pattern: returns null when
// ABLY_API_KEY is absent so callers decide their fallback, instead of
// throwing at import time (same env-gated-provider convention as
// Cloudinary/Bictorys/Resend — the app boots and works without it).
import 'server-only';
import Ably from 'ably';

let _ably: Ably.Rest | null | undefined;

export function getAbly(): Ably.Rest | null {
  if (_ably !== undefined) return _ably;
  const key = process.env.ABLY_API_KEY;
  if (!key) {
    _ably = null;
    return null;
  }
  _ably = new Ably.Rest({ key });
  return _ably;
}

/** Channel naming scheme shared by the token-mint route, the publish call
 * in the send-message route, and the browser subscriber. */
export function conversationChannelName(conversationId: string): string {
  return `conversation:${conversationId}`;
}
