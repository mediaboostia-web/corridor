'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { LiveDerivedStatus } from '@/lib/live-status';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface LiveItem {
  id: string;
  title: string | null;
  externalLink: string;
  scheduledStart: string;
  scheduledEnd: string;
  derivedStatus: LiveDerivedStatus;
  wholesalerProfile: { shopName: string; slug: string };
}

const STATUS_LABEL: Record<LiveDerivedStatus, string> = {
  SCHEDULED: 'À venir',
  LIVE: 'EN LIVE',
  ENDED: 'Terminé',
  CANCELLED: 'Annulé',
};

export default function BuyerLivesPage() {
  const [scope, setScope] = useState<'upcoming' | 'past'>('upcoming');
  const [items, setItems] = useState<LiveItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (s: 'upcoming' | 'past') => {
    setItems(null);
    try {
      const res = await api<{ items: LiveItem[] }>(`/api/buyer/lives?scope=${s}&limit=50`);
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    }
  }, []);

  useEffect(() => {
    void load(scope);
  }, [scope, load]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Lives</h1>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setScope('upcoming')}
          className={cn(
            'rounded-full px-3 py-1.5 text-sm',
            scope === 'upcoming'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground',
          )}
        >
          À venir
        </button>
        <button
          type="button"
          onClick={() => setScope('past')}
          className={cn(
            'rounded-full px-3 py-1.5 text-sm',
            scope === 'past'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground',
          )}
        >
          Historique
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {items === null ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun live pour l&apos;instant.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((live) => (
            <Card key={live.id}>
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{live.title ?? 'Live'}</span>
                    <Badge className={live.derivedStatus === 'LIVE' ? 'animate-pulse' : ''}>
                      {STATUS_LABEL[live.derivedStatus]}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{live.wholesalerProfile.shopName}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(live.scheduledStart).toLocaleString('fr-FR', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
                {(live.derivedStatus === 'LIVE' || live.derivedStatus === 'SCHEDULED') && (
                  <a href={live.externalLink} target="_blank" rel="noreferrer">
                    <Button size="sm">Voir</Button>
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
