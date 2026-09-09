'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import type { MissionStatus } from '@/lib/mission-status';
import { MISSION_STATUS_LABEL } from '@/lib/mission-status';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface MissionListItem {
  id: string;
  status: MissionStatus;
  agreedCommissionAmount: number;
  currency: string;
  createdAt: string;
  sourcingRequest: { id: string; title: string; deliveryCountry: string };
  agentProfile: { id: string; displayName: string; publicSlug: string };
}

export default function BuyerMesCommandesPage() {
  const [items, setItems] = useState<MissionListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<{ items: MissionListItem[] }>('/api/buyer/missions?limit=50');
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Mes commandes</h1>

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
            Aucune commande pour l&apos;instant.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((m) => (
            <Link key={m.id} href={`/buyer/mes-commandes/${m.id}`}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center justify-between gap-4 py-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{m.sourcingRequest.title}</span>
                      <Badge>{MISSION_STATUS_LABEL[m.status]}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Agent : {m.agentProfile.displayName} ·{' '}
                      {m.agreedCommissionAmount.toLocaleString('fr-FR')} {m.currency}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
