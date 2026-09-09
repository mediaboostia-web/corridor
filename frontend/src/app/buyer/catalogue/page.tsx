'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import type { LiveDerivedStatus } from '@/lib/live-status';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface FeedProduct {
  id: string;
  name: string;
  category: string;
  priceAmount: number;
  currency: string;
  availability: 'AVAILABLE' | 'UNAVAILABLE';
  wholesaler: { shopName: string; slug: string };
  media: { url: string | null }[];
}

interface FeedLive {
  id: string;
  title: string | null;
  externalLink: string;
  scheduledStart: string;
  scheduledEnd: string;
  derivedStatus: LiveDerivedStatus;
  wholesalerProfile: { shopName: string; slug: string };
}

// Every Nth product card, a live announcement is interspersed (per the
// "feed" decision — lives are mixed among products, not a separate rail).
const LIVE_EVERY_N_PRODUCTS = 4;

export default function BuyerCataloguePage() {
  const [products, setProducts] = useState<FeedProduct[]>([]);
  const [lives, setLives] = useState<FeedLive[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{
        items: FeedProduct[];
        nextCursor: string | null;
        liveAnnouncements: FeedLive[];
      }>('/api/buyer/catalogue');
      setProducts(res.items);
      setLives(res.liveAnnouncements);
      setCursor(res.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage]);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const res = await api<{ items: FeedProduct[]; nextCursor: string | null }>(
        `/api/buyer/catalogue?cursor=${encodeURIComponent(cursor)}`,
      );
      setProducts((prev) => [...prev, ...res.items]);
      setCursor(res.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setLoadingMore(false);
    }
  }

  const feed: ({ kind: 'product'; item: FeedProduct } | { kind: 'live'; item: FeedLive })[] = [];
  let liveIdx = 0;
  products.forEach((p, i) => {
    feed.push({ kind: 'product', item: p });
    if (lives.length > 0 && (i + 1) % LIVE_EVERY_N_PRODUCTS === 0) {
      feed.push({ kind: 'live', item: lives[liveIdx % lives.length]! });
      liveIdx += 1;
    }
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Catalogue</h1>
        <Link href="/buyer/demander-un-sourcing" className="text-sm text-primary underline">
          Tu ne trouves pas ce que tu cherches ? Fais une demande libre
        </Link>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : products.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aucun produit publié pour l&apos;instant. Reviens bientôt.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {feed.map((entry, i) =>
              entry.kind === 'product' ? (
                <Card key={`p-${entry.item.id}`}>
                  <div className="flex aspect-square items-center justify-center overflow-hidden rounded-t-lg bg-muted">
                    {entry.item.media[0]?.url ? (
                      <img
                        src={entry.item.media[0].url}
                        alt={entry.item.name}
                        className="size-full object-cover"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">Pas de photo</span>
                    )}
                  </div>
                  <CardContent className="flex flex-col gap-1 p-3">
                    <span className="line-clamp-1 text-sm font-medium">{entry.item.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {entry.item.priceAmount.toLocaleString('fr-FR')} {entry.item.currency}
                    </span>
                    <Link
                      href={`/boutiques/${entry.item.wholesaler.slug}`}
                      className="text-xs text-muted-foreground underline"
                    >
                      {entry.item.wholesaler.shopName}
                    </Link>
                    {entry.item.availability === 'UNAVAILABLE' ? (
                      <Badge variant="destructive" className="w-fit">
                        Rupture de stock
                      </Badge>
                    ) : (
                      <Link href={`/buyer/demander-un-sourcing?productId=${entry.item.id}`}>
                        <Button size="sm" className="mt-1 w-full">
                          Demander le sourcing
                        </Button>
                      </Link>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card
                  key={`l-${entry.item.id}-${i}`}
                  className="col-span-2 flex flex-col justify-center gap-1 bg-primary/5 p-4 sm:col-span-1"
                >
                  <div className="flex items-center gap-2">
                    <Badge className={entry.item.derivedStatus === 'LIVE' ? 'animate-pulse' : ''}>
                      {entry.item.derivedStatus === 'LIVE' ? 'EN LIVE' : 'Live à venir'}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium">{entry.item.title ?? 'Live'}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.item.wholesalerProfile.shopName}
                  </p>
                  <a
                    href={entry.item.externalLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs underline"
                  >
                    Voir le live
                  </a>
                </Card>
              ),
            )}
          </div>

          {cursor && (
            <Button
              variant="outline"
              disabled={loadingMore}
              onClick={() => void loadMore()}
              className="w-fit"
            >
              {loadingMore ? 'Chargement…' : 'Voir plus'}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
