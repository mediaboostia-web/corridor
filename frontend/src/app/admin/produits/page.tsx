'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

interface PendingProduct {
  id: string;
  name: string;
  category: string;
  description: string;
  priceAmount: number;
  currency: string;
  minQuantity: number;
  createdAt: string;
  wholesalerProfile: { shopName: string; slug: string };
  media: { url: string | null }[];
}

export default function AdminProduitsPage() {
  const [items, setItems] = useState<PendingProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasonDrafts, setReasonDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const res = await api<{ items: PendingProduct[] }>(
        '/api/admin/products?status=PENDING&limit=50',
      );
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function approve(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await api(`/api/admin/products/${id}/approve`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    const reason = (reasonDrafts[id] ?? '').trim();
    if (!reason) {
      setError('Indique un motif de refus avant de rejeter ce produit.');
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      await api(`/api/admin/products/${id}/reject`, { method: 'POST', body: { reason } });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Modération des produits</h1>
      <p className="text-sm text-muted-foreground">Produits en attente de validation.</p>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {items === null ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun produit en attente.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex flex-col gap-3 py-4">
                <div className="flex gap-4">
                  <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                    {p.media[0]?.url ? (
                      <img src={p.media[0].url} alt="" className="size-full object-cover" />
                    ) : (
                      <span className="text-xs text-muted-foreground">Pas de photo</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {p.category} · {p.priceAmount.toLocaleString('fr-FR')} {p.currency} · min{' '}
                      {p.minQuantity}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Boutique : {p.wholesalerProfile.shopName} ({p.wholesalerProfile.slug})
                    </p>
                    <p className="mt-1 text-sm">{p.description}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" disabled={busyId === p.id} onClick={() => void approve(p.id)}>
                    Approuver
                  </Button>
                  <Input
                    placeholder="Motif de refus"
                    className="max-w-xs"
                    value={reasonDrafts[p.id] ?? ''}
                    onChange={(e) => setReasonDrafts({ ...reasonDrafts, [p.id]: e.target.value })}
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={busyId === p.id}
                    onClick={() => void reject(p.id)}
                  >
                    Refuser
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
