'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface ProductListItem {
  id: string;
  name: string;
  category: string;
  priceAmount: number;
  currency: string;
  availability: 'AVAILABLE' | 'UNAVAILABLE';
  status: 'DRAFT' | 'PENDING' | 'PUBLISHED';
  rejectionReason: string | null;
  media: { url: string | null }[];
}

const STATUS_LABEL: Record<ProductListItem['status'], string> = {
  DRAFT: 'Brouillon',
  PENDING: 'En attente de validation',
  PUBLISHED: 'Publié',
};

const STATUS_VARIANT: Record<ProductListItem['status'], 'secondary' | 'outline' | 'default'> = {
  DRAFT: 'secondary',
  PENDING: 'outline',
  PUBLISHED: 'default',
};

export default function CataloguePage() {
  const [items, setItems] = useState<ProductListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<{ items: ProductListItem[] }>('/api/wholesaler/products?limit=50');
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitForReview(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await api(`/api/wholesaler/products/${id}/submit`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setBusyId(null);
    }
  }

  async function toggleAvailability(item: ProductListItem) {
    setBusyId(item.id);
    setError(null);
    try {
      await api(`/api/wholesaler/products/${item.id}`, {
        method: 'PATCH',
        body: { availability: item.availability === 'AVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE' },
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setBusyId(null);
    }
  }

  async function deleteProduct(id: string) {
    if (!window.confirm('Supprimer ce produit définitivement ?')) return;
    setBusyId(id);
    setError(null);
    try {
      await api(`/api/wholesaler/products/${id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Catalogue</h1>
        <Link href="/wholesaler/catalogue/nouveau">
          <Button>Ajouter un produit</Button>
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
            Aucun produit pour l&apos;instant. Ajoute ton premier produit pour apparaître dans le
            catalogue des acheteurs.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                  {item.media[0]?.url ? (
                    <img src={item.media[0].url} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="text-xs text-muted-foreground">Pas de photo</span>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{item.name}</span>
                    <Badge variant={STATUS_VARIANT[item.status]}>{STATUS_LABEL[item.status]}</Badge>
                    {item.availability === 'UNAVAILABLE' && (
                      <Badge variant="destructive">Rupture de stock</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {item.category} · {item.priceAmount.toLocaleString('fr-FR')} {item.currency}
                  </p>
                  {item.status === 'DRAFT' && item.rejectionReason && (
                    <p className="mt-1 text-sm text-destructive">Refusé : {item.rejectionReason}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/wholesaler/catalogue/${item.id}`}>
                    <Button variant="outline" size="sm">
                      Modifier
                    </Button>
                  </Link>
                  {item.status === 'DRAFT' && (
                    <Button
                      size="sm"
                      disabled={busyId === item.id}
                      onClick={() => void submitForReview(item.id)}
                    >
                      Soumettre
                    </Button>
                  )}
                  {item.status === 'PUBLISHED' && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyId === item.id}
                      onClick={() => void toggleAvailability(item)}
                    >
                      {item.availability === 'AVAILABLE'
                        ? 'Marquer en rupture'
                        : 'Marquer disponible'}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busyId === item.id}
                    onClick={() => void deleteProduct(item.id)}
                  >
                    Supprimer
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
