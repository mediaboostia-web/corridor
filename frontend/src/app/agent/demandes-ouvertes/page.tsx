'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type CandidatureStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN' | null;

interface OpenRequest {
  id: string;
  title: string;
  description: string;
  budgetAmount: number | null;
  currency: string;
  quantity: number | null;
  deliveryCountry: string;
  createdAt: string;
  thumbnailUrl: string | null;
  myCandidatureId: string | null;
  myCandidatureStatus: CandidatureStatus;
}

const STATUS_LABEL: Record<Exclude<CandidatureStatus, null>, string> = {
  PENDING: 'Candidature envoyée',
  ACCEPTED: 'Candidature acceptée',
  REJECTED: 'Non retenue',
  WITHDRAWN: 'Candidature retirée',
};

export default function AgentDemandesOuvertesPage() {
  const [items, setItems] = useState<OpenRequest[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<{ items: OpenRequest[]; nextCursor: string | null }>(
        '/api/agent/demandes-ouvertes?limit=20',
      );
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
      const res = await api<{ items: OpenRequest[]; nextCursor: string | null }>(
        `/api/agent/demandes-ouvertes?limit=20&cursor=${encodeURIComponent(nextCursor)}`,
      );
      setItems((prev) => [...(prev ?? []), ...res.items]);
      setNextCursor(res.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Demandes ouvertes</h1>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {items === null ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune demande ouverte pour l&apos;instant.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((r) => (
            <Link key={r.id} href={`/agent/demandes-ouvertes/${r.id}`}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                    {r.thumbnailUrl ? (
                      <img src={r.thumbnailUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <span className="text-xs text-muted-foreground">Sans photo</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{r.title}</span>
                      {r.myCandidatureStatus && (
                        <Badge variant="outline">{STATUS_LABEL[r.myCandidatureStatus]}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {r.budgetAmount
                        ? `${r.budgetAmount.toLocaleString('fr-FR')} ${r.currency} · `
                        : ''}
                      {r.quantity ? `x${r.quantity} · ` : ''}
                      {r.deliveryCountry}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {nextCursor && (
        <Button
          variant="outline"
          disabled={loadingMore}
          onClick={() => void loadMore()}
          className="w-fit"
        >
          {loadingMore ? 'Chargement…' : 'Voir plus'}
        </Button>
      )}
    </div>
  );
}
