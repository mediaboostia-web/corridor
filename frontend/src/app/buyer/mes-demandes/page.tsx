'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface RequestListItem {
  id: string;
  title: string;
  budgetAmount: number | null;
  currency: string;
  quantity: number | null;
  deliveryCountry: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
}

const STATUS_LABEL: Record<RequestListItem['status'], string> = {
  OPEN: 'Ouverte',
  IN_PROGRESS: 'En cours',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
};

const STATUS_VARIANT: Record<
  RequestListItem['status'],
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  OPEN: 'default',
  IN_PROGRESS: 'outline',
  COMPLETED: 'secondary',
  CANCELLED: 'destructive',
};

export default function MesDemandesPage() {
  const [items, setItems] = useState<RequestListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<{ items: RequestListItem[] }>('/api/buyer/sourcing-requests?limit=50');
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeCount =
    items?.filter((i) => i.status === 'OPEN' || i.status === 'IN_PROGRESS').length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mes demandes</h1>
          <p className="text-sm text-muted-foreground">{activeCount}/3 demandes actives</p>
        </div>
        <Link href="/buyer/demander-un-sourcing">
          <Button>Nouvelle demande</Button>
        </Link>
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
            Aucune demande pour l&apos;instant.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <Link key={item.id} href={`/buyer/mes-demandes/${item.id}`}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center justify-between gap-4 py-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.title}</span>
                      <Badge variant={STATUS_VARIANT[item.status]}>
                        {STATUS_LABEL[item.status]}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {item.budgetAmount
                        ? `${item.budgetAmount.toLocaleString('fr-FR')} ${item.currency} · `
                        : ''}
                      {item.quantity ? `x${item.quantity} · ` : ''}
                      {item.deliveryCountry}
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
