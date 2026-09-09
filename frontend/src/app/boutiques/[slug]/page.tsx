'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import type { LiveDerivedStatus } from '@/lib/live-status';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface ShopData {
  profile: {
    shopName: string;
    slug: string;
    description: string | null;
    locationCity: string;
    locationDetail: string | null;
    hours: string | null;
    whatsappLink: string | null;
    logoUrl: string | null;
    coverUrl: string | null;
    isPro: boolean;
  };
  products: {
    id: string;
    name: string;
    category: string;
    description: string;
    priceAmount: number;
    currency: string;
    minQuantity: number;
    availability: 'AVAILABLE' | 'UNAVAILABLE';
    media: { url: string | null }[];
  }[];
  live: {
    id: string;
    title: string | null;
    externalLink: string;
    scheduledStart: string;
    scheduledEnd: string;
    derivedStatus: LiveDerivedStatus;
  } | null;
}

// Live status is derived from now() — a short poll keeps the "EN LIVE" badge
// fresh for a visitor who leaves the tab open across the window's edges.
const LIVE_REFRESH_MS = 30_000;

export default function BoutiquePubliquePage() {
  const params = useParams<{ slug: string }>();
  const [data, setData] = useState<ShopData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<ShopData>(`/api/boutiques/${params.slug}`);
      setData(res);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setNotFound(true);
      } else {
        setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
      }
    }
  }, [params.slug]);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), LIVE_REFRESH_MS);
    return () => clearInterval(interval);
  }, [load]);

  if (notFound) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-2xl flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-xl font-semibold">Boutique introuvable</h1>
        <Link href="/" className="text-sm underline">
          Retour à l&apos;accueil
        </Link>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center text-sm text-muted-foreground">
        {error ?? 'Chargement…'}
      </main>
    );
  }

  const { profile, products, live } = data;
  const isLive = live?.derivedStatus === 'LIVE';

  return (
    <main className="min-h-[100dvh] bg-background">
      <div className="h-40 w-full bg-muted sm:h-56">
        {profile.coverUrl && (
          <img src={profile.coverUrl} alt="" className="size-full object-cover" />
        )}
      </div>

      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="-mt-10 flex items-end gap-4">
          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-background bg-muted">
            {profile.logoUrl ? (
              <img src={profile.logoUrl} alt="" className="size-full object-cover" />
            ) : (
              <span className="text-lg font-semibold">{profile.shopName[0]}</span>
            )}
          </div>
          <div className="pb-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{profile.shopName}</h1>
              {profile.isPro && <Badge variant="secondary">Grossiste partenaire</Badge>}
              {isLive && live && (
                <a href={live.externalLink} target="_blank" rel="noreferrer">
                  <Badge className="animate-pulse">EN LIVE</Badge>
                </a>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {profile.locationDetail ? `${profile.locationDetail}, ` : ''}
              {profile.locationCity}
            </p>
          </div>
        </div>

        {live && live.derivedStatus === 'SCHEDULED' && (
          <p className="mt-4 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
            {live.title ?? 'Live à venir'} —{' '}
            {new Date(live.scheduledStart).toLocaleString('fr-FR', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </p>
        )}

        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="sm:col-span-2">
            {profile.description && <p className="text-sm">{profile.description}</p>}
          </div>
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            {profile.hours && <p>Horaires : {profile.hours}</p>}
            {profile.whatsappLink && (
              <a href={profile.whatsappLink} target="_blank" rel="noreferrer" className="underline">
                Contacter sur WhatsApp
              </a>
            )}
          </div>
        </div>

        <h2 className="mt-8 mb-3 text-lg font-medium">Produits ({products.length})</h2>
        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun produit publié pour l&apos;instant.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 pb-10 sm:grid-cols-3">
            {products.map((p) => (
              <Card key={p.id}>
                <div className="flex aspect-square items-center justify-center overflow-hidden rounded-t-lg bg-muted">
                  {p.media[0]?.url ? (
                    <img src={p.media[0].url} alt={p.name} className="size-full object-cover" />
                  ) : (
                    <span className="text-xs text-muted-foreground">Pas de photo</span>
                  )}
                </div>
                <CardContent className="flex flex-col gap-1 p-3">
                  <span className="line-clamp-1 text-sm font-medium">{p.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {p.priceAmount.toLocaleString('fr-FR')} {p.currency}
                  </span>
                  {p.availability === 'UNAVAILABLE' && (
                    <Badge variant="destructive" className="w-fit">
                      Rupture de stock
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
