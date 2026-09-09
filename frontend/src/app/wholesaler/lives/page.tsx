'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import type { LiveDerivedStatus } from '@/lib/live-status';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface LiveItem {
  id: string;
  title: string | null;
  externalLink: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: string;
  derivedStatus: LiveDerivedStatus;
}

const STATUS_LABEL: Record<LiveDerivedStatus, string> = {
  SCHEDULED: 'À venir',
  LIVE: 'EN LIVE',
  ENDED: 'Terminé',
  CANCELLED: 'Annulé',
};

const STATUS_VARIANT: Record<
  LiveDerivedStatus,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  SCHEDULED: 'outline',
  LIVE: 'default',
  ENDED: 'secondary',
  CANCELLED: 'destructive',
};

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function LivesPage() {
  const [items, setItems] = useState<LiveItem[] | null>(null);
  const [title, setTitle] = useState('');
  const [externalLink, setExternalLink] = useState('');
  const [scheduledStart, setScheduledStart] = useState('');
  const [scheduledEnd, setScheduledEnd] = useState('');
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<{ items: LiveItem[] }>('/api/wholesaler/lives?limit=50');
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await api('/api/wholesaler/lives', {
        method: 'POST',
        body: {
          title: title || null,
          externalLink,
          scheduledStart: new Date(scheduledStart).toISOString(),
          scheduledEnd: new Date(scheduledEnd).toISOString(),
        },
      });
      setTitle('');
      setExternalLink('');
      setScheduledStart('');
      setScheduledEnd('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setCreating(false);
    }
  }

  async function onCancel(id: string) {
    if (!window.confirm('Annuler cette annonce de live ?')) return;
    setBusyId(id);
    setError(null);
    try {
      await api(`/api/wholesaler/lives/${id}`, { method: 'PATCH', body: { status: 'CANCELLED' } });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Lives</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Annoncer un live</CardTitle>
          <CardDescription>
            Le live se déroule hors plateforme (TikTok, Facebook, Zoom…). Cette annonce te permet de
            signaler la période où tu seras en direct — elle apparaît dans le catalogue acheteur et
            sur ta page boutique pendant cette fenêtre.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title">Titre (optionnel)</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Déstockage de printemps"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="externalLink">Lien du live</Label>
              <Input
                id="externalLink"
                type="url"
                required
                value={externalLink}
                onChange={(e) => setExternalLink(e.target.value)}
                placeholder="https://www.tiktok.com/@..."
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="scheduledStart">Début</Label>
                <Input
                  id="scheduledStart"
                  type="datetime-local"
                  required
                  value={scheduledStart}
                  onChange={(e) => setScheduledStart(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="scheduledEnd">Fin</Label>
                <Input
                  id="scheduledEnd"
                  type="datetime-local"
                  required
                  value={scheduledEnd}
                  onChange={(e) => setScheduledEnd(e.target.value)}
                />
              </div>
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={creating} className="w-fit">
              {creating ? 'Publication…' : "Publier l'annonce"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Historique</h2>
        {items === null ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune annonce de live pour l&apos;instant.
          </p>
        ) : (
          items.map((live) => (
            <Card key={live.id}>
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{live.title ?? 'Live'}</span>
                    <Badge variant={STATUS_VARIANT[live.derivedStatus]}>
                      {STATUS_LABEL[live.derivedStatus]}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {toLocalInputValue(live.scheduledStart).replace('T', ' ')} →{' '}
                    {toLocalInputValue(live.scheduledEnd).replace('T', ' ')}
                  </p>
                  <a
                    href={live.externalLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm underline text-muted-foreground"
                  >
                    {live.externalLink}
                  </a>
                </div>
                {(live.derivedStatus === 'SCHEDULED' || live.derivedStatus === 'LIVE') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busyId === live.id}
                    onClick={() => void onCancel(live.id)}
                  >
                    Annuler
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
