// Client-side Ably singleton (Phase 5 — messagerie). The browser never
// holds ABLY_API_KEY: `authCallback` exchanges our own session cookie for a
// capability-scoped TokenRequest via POST /api/realtime/token, per
// CLAUDE.md's recommended real-time pattern. One shared Realtime connection
// for the whole app — components subscribe/unsubscribe to individual
// conversation channels as they mount/unmount.
'use client';

import Ably from 'ably';
import { api } from './api';

let client: Ably.Realtime | null = null;

export function getRealtimeClient(): Ably.Realtime {
  if (!client) {
    client = new Ably.Realtime({
      authCallback: (_params, callback) => {
        api<Ably.TokenRequest>('/api/realtime/token', { method: 'POST' })
          .then((tokenRequest) => callback(null, tokenRequest))
          .catch((err: unknown) =>
            callback(err instanceof Error ? err.message : 'auth failed', null),
          );
      },
    });
  }
  return client;
}

export function conversationChannelName(conversationId: string): string {
  return `conversation:${conversationId}`;
}
