'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { openOrCreateConversation } from '@/lib/messaging';
import type { MissionStatus } from '@/lib/mission-status';
import { MISSION_STATUS_LABEL } from '@/lib/mission-status';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface MissionListItem {
  id: string;
  status: MissionStatus;
  agreedCommissionAmount: number;
  currency: string;
  createdAt: string;
  sourcingRequest: { id: string; title: string; deliveryCountry: string };
  agentProfile: { id: string; userId: string; displayName: string };
}

export default function WholesalerCommandesPage() {
  const router = useRouter();
  const [items, setItems] = useState<MissionListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contactingId, setContactingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<{ items: MissionListItem[] }>('/api/wholesaler/missions?limit=50');
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onContact(m: MissionListItem) {
    setContactingId(m.id);
    setError(null);
    try {
      const conversationId = await openOrCreateConversation(m.agentProfile.userId, {
        subjectType: 'MISSION',
        subjectId: m.id,
      });
      router.push(`/wholesaler/messagerie?conversationId=${conversationId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
      setContactingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Commandes</h1>
        <p className="text-sm text-muted-foreground">
          Missions d&apos;agents sourcées depuis ta boutique.
        </p>
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
            Aucune commande pour l&apos;instant.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((m) => (
            <Card key={m.id}>
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{m.sourcingRequest.title}</span>
                    <Badge>{MISSION_STATUS_LABEL[m.status]}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Agent : {m.agentProfile.displayName} ·{' '}
                    {m.agreedCommissionAmount.toLocaleString('fr-FR')} {m.currency} ·{' '}
                    {m.sourcingRequest.deliveryCountry}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={contactingId === m.id}
                  onClick={() => void onContact(m)}
                >
                  Contacter l&apos;agent
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
