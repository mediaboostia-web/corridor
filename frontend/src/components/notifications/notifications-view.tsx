'use client';

// Shared notifications UI mounted by /buyer/notifications, /agent/notifications,
// /wholesaler/notifications and /admin/notifications (Phase 6). The API
// (GET/PATCH /api/notifications) is role-agnostic — `requireAuth` only —
// so one component serves all four shells.
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

interface ListResponse {
  items: NotificationItem[];
  nextCursor: string | null;
}

export function NotificationsView() {
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<ListResponse>('/api/notifications?limit=30');
      setItems(res.items);
      setNextCursor(res.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const res = await api<ListResponse>(
        `/api/notifications?limit=30&cursor=${encodeURIComponent(nextCursor)}`,
      );
      setItems((prev) => [...(prev ?? []), ...res.items]);
      setNextCursor(res.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setLoadingMore(false);
    }
  }

  async function markRead(id: string) {
    const now = new Date().toISOString();
    setItems(
      (prev) => prev?.map((n) => (n.id === id ? { ...n, readAt: n.readAt ?? now } : n)) ?? prev,
    );
    try {
      await api('/api/notifications', { method: 'PATCH', body: { ids: [id] } });
    } catch {
      // Best-effort — a stale read-state on one row isn't worth surfacing an error for.
    }
  }

  async function markAllRead() {
    setMarkingAll(true);
    setError(null);
    try {
      await api('/api/notifications', { method: 'PATCH', body: { ids: 'all' } });
      const now = new Date().toISOString();
      setItems((prev) => prev?.map((n) => ({ ...n, readAt: n.readAt ?? now })) ?? prev);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setMarkingAll(false);
    }
  }

  const hasUnread = items?.some((n) => !n.readAt) ?? false;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        {hasUnread && (
          <Button
            size="sm"
            variant="outline"
            disabled={markingAll}
            onClick={() => void markAllRead()}
          >
            {markingAll ? 'Marquage…' : 'Tout marquer comme lu'}
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {items === null ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aucune notification pour l&apos;instant.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => void markRead(n.id)}
              className="text-left"
            >
              <Card className={!n.readAt ? 'border-primary/40 bg-muted/40' : ''}>
                <CardContent className="flex items-start gap-3 py-3">
                  {!n.readAt && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
                  <div className="flex-1">
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-sm text-muted-foreground">{n.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(n.createdAt).toLocaleString('fr-FR', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
          {nextCursor && (
            <Button
              variant="outline"
              disabled={loadingMore}
              onClick={() => void loadMore()}
              className="w-fit"
            >
              {loadingMore ? 'Chargement…' : 'Charger plus'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
