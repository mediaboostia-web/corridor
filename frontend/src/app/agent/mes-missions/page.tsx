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
}

export default function AgentMesMissionsPage() {
  const [items, setItems] = useState<MissionListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<{ items: MissionListItem[] }>('/api/agent/missions?limit=50');
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
      <h1 className="text-2xl font-semibold tracking-tight">Mes missions</h1>

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
            Aucune mission pour l&apos;instant.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((m) => (
            <Link key={m.id} href={`/agent/mes-missions/${m.id}`}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center justify-between gap-4 py-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{m.sourcingRequest.title}</span>
                      <Badge>{MISSION_STATUS_LABEL[m.status]}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {m.agreedCommissionAmount.toLocaleString('fr-FR')} {m.currency} ·{' '}
                      {m.sourcingRequest.deliveryCountry}
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
