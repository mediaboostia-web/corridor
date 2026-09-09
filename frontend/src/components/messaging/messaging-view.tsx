'use client';

// Shared messaging UI mounted by /buyer/messagerie, /agent/messagerie and
// /wholesaler/messagerie (Phase 5). The API is role-agnostic (a
// Conversation just has two participants), so one component serves all
// three role shells — only the surrounding RoleGuard/layout differs.
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type Ably from 'ably';
import { useAuth } from '@/contexts/AuthContext';
import { api, ApiError } from '@/lib/api';
import { uploadImage } from '@/lib/upload';
import { getRealtimeClient, conversationChannelName } from '@/lib/realtime';
import { MESSAGE_MAX_MEDIA } from '@/lib/marketplace';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface ConversationListItem {
  id: string;
  otherParticipant: { userId: string; label: string; href: string | null };
  lastMessage: { body: string | null; senderId: string; createdAt: string } | null;
  unreadCount: number;
}

interface MessageItem {
  id: string;
  senderId: string;
  body: string | null;
  createdAt: string;
  media: { url: string | null }[];
}

export function MessagingView() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Chargement…</p>}>
      <MessagingViewInner />
    </Suspense>
  );
}

function MessagingViewInner() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [conversations, setConversations] = useState<ConversationListItem[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('conversationId'));
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState('');
  const [image, setImage] = useState<{ id: string; url: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      const res = await api<{ items: ConversationListItem[] }>('/api/conversations');
      setConversations(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  const selectConversation = useCallback(
    (id: string) => {
      setSelectedId(id);
      router.replace(`?conversationId=${id}`, { scroll: false });
    },
    [router],
  );

  // Load history + mark read + subscribe to live updates whenever the
  // selected thread changes.
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;

    setLoadingMessages(true);
    setMessages([]);
    api<{ items: MessageItem[] }>(`/api/conversations/${selectedId}/messages?limit=50`)
      .then((res) => {
        if (cancelled) return;
        setMessages([...res.items].reverse());
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
      })
      .finally(() => {
        if (!cancelled) setLoadingMessages(false);
      });

    api(`/api/conversations/${selectedId}/read`, { method: 'POST' })
      .then(() => {
        if (!cancelled) {
          setConversations((prev) =>
            prev ? prev.map((c) => (c.id === selectedId ? { ...c, unreadCount: 0 } : c)) : prev,
          );
        }
      })
      .catch(() => {
        // Best-effort — an unread badge that lags by one view isn't worth surfacing an error for.
      });

    const client = getRealtimeClient();
    const channel = client.channels.get(conversationChannelName(selectedId));
    const onMessage = (msg: Ably.InboundMessage) => {
      const data = msg.data as MessageItem | undefined;
      if (!data) return;
      setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
    };
    void channel.subscribe('message', onMessage);

    return () => {
      cancelled = true;
      void channel.unsubscribe('message', onMessage);
    };
  }, [selectedId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  async function onFileSelected(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadImage(file);
      setImage({ id: uploaded.id, url: uploaded.url });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Échec de l'envoi de la photo.");
    } finally {
      setUploading(false);
    }
  }

  async function onSend() {
    if (!selectedId || (!draft.trim() && !image)) return;
    setSending(true);
    setError(null);
    try {
      const res = await api<{ message: MessageItem }>(`/api/conversations/${selectedId}/messages`, {
        method: 'POST',
        body: {
          body: draft.trim() || undefined,
          mediaFileUploadIds: image ? [image.id] : [],
        },
      });
      setMessages((prev) =>
        prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message],
      );
      setDraft('');
      setImage(null);
      void loadConversations();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setSending(false);
    }
  }

  const selected = conversations?.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex h-[calc(100vh-10rem)] gap-4">
      <div className="w-72 shrink-0 overflow-y-auto rounded-lg border border-border">
        {conversations === null ? (
          <p className="p-4 text-sm text-muted-foreground">Chargement…</p>
        ) : conversations.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            Aucune conversation pour l&apos;instant.
          </p>
        ) : (
          conversations.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => selectConversation(c.id)}
              className={`flex w-full flex-col gap-0.5 border-b border-border p-3 text-left transition-colors hover:bg-muted/50 ${
                c.id === selectedId ? 'bg-muted' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{c.otherParticipant.label}</span>
                {c.unreadCount > 0 && <Badge>{c.unreadCount}</Badge>}
              </div>
              <span className="truncate text-xs text-muted-foreground">
                {c.lastMessage
                  ? (c.lastMessage.body ?? '📷 Photo')
                  : 'Aucun message pour l’instant'}
              </span>
            </button>
          ))
        )}
      </div>

      <div className="flex flex-1 flex-col rounded-lg border border-border">
        {!selectedId || !selected ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Sélectionne une conversation.
          </div>
        ) : (
          <>
            <div className="border-b border-border p-3">
              {selected.otherParticipant.href ? (
                <a
                  href={selected.otherParticipant.href}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium underline"
                >
                  {selected.otherParticipant.label}
                </a>
              ) : (
                <span className="font-medium">{selected.otherParticipant.label}</span>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
              {loadingMessages ? (
                <p className="text-sm text-muted-foreground">Chargement…</p>
              ) : (
                messages.map((m) => {
                  const mine = m.senderId === user?.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <Card className={mine ? 'bg-primary text-primary-foreground' : ''}>
                        <CardContent className="flex max-w-xs flex-col gap-1 px-3 py-2">
                          {m.body && <p className="text-sm whitespace-pre-wrap">{m.body}</p>}
                          {m.media.map((mm, i) =>
                            mm.url ? (
                              <img
                                key={i}
                                src={mm.url}
                                alt=""
                                className="h-32 w-32 rounded-md object-cover"
                              />
                            ) : null,
                          )}
                          <span className="text-[10px] opacity-70">
                            {new Date(m.createdAt).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {error && (
              <p role="alert" className="px-3 text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="flex flex-col gap-2 border-t border-border p-3">
              {image && (
                <div className="relative w-fit">
                  <img src={image.url} alt="" className="h-16 w-16 rounded-md object-cover" />
                  <button
                    type="button"
                    onClick={() => setImage(null)}
                    className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-destructive text-xs text-white"
                    aria-label="Retirer la photo"
                  >
                    ×
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <Textarea
                  rows={2}
                  placeholder="Écris un message…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void onSend();
                    }
                  }}
                  className="flex-1"
                />
                <label className="cursor-pointer text-xs text-muted-foreground underline">
                  {uploading ? 'Envoi…' : 'Photo'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={uploading || !!image || Boolean(MESSAGE_MAX_MEDIA <= 0)}
                    onChange={(e) => void onFileSelected(e.target.files)}
                  />
                </label>
                <Button
                  disabled={sending || (!draft.trim() && !image)}
                  onClick={() => void onSend()}
                >
                  {sending ? 'Envoi…' : 'Envoyer'}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
