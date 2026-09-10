'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface RequestDetail {
  id: string;
  title: string;
  description: string;
  tiktokLink: string | null;
  facebookLink: string | null;
  budgetAmount: number | null;
  currency: string;
  quantity: number | null;
  deliveryCountry: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  product: {
    id: string;
    name: string;
    wholesalerShopName: string | null;
    wholesalerSlug: string | null;
  } | null;
  media: { url: string | null }[];
  myCandidatureId: string | null;
  myCandidatureStatus: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN' | null;
}

export default function AgentDemandeOuverteDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<{ request: RequestDetail }>(
        `/api/agent/demandes-ouvertes/${params.id}`,
      );
      setRequest(res.request);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onWithdraw() {
    if (!request?.myCandidatureId) return;
    if (!window.confirm('Retirer ta candidature sur cette demande ?')) return;
    setWithdrawing(true);
    try {
      await api(`/api/agent/candidatures/${request.myCandidatureId}`, {
        method: 'PATCH',
        body: { status: 'WITHDRAWN' },
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setWithdrawing(false);
    }
  }

  if (error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {error}
      </p>
    );
  }
  if (!request) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{request.title}</h1>
        <p className="text-sm text-muted-foreground">
          {request.deliveryCountry} · publiée le{' '}
          {new Date(request.createdAt).toLocaleDateString('fr-FR')}
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 py-4">
          <p className="whitespace-pre-line text-sm">{request.description}</p>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {request.budgetAmount && (
              <span>
                Budget : {request.budgetAmount.toLocaleString('fr-FR')} {request.currency}
              </span>
            )}
            {request.quantity && <span>Quantité : {request.quantity}</span>}
          </div>
          {request.product && (
            <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <p>
                Produit lié : <span className="font-medium">{request.product.name}</span>
                {request.product.wholesalerShopName && <> — {request.product.wholesalerShopName}</>}
              </p>
              {request.product.wholesalerSlug && (
                <Link
                  href={`/boutiques/${request.product.wholesalerSlug}`}
                  target="_blank"
                  className="w-fit underline"
                >
                  Voir la boutique (localisation, horaires, contact WhatsApp, stock à jour)
                </Link>
              )}
            </div>
          )}
          {(request.tiktokLink || request.facebookLink) && (
            <div className="flex flex-col gap-1 text-sm">
              {request.tiktokLink && (
                <a href={request.tiktokLink} target="_blank" rel="noreferrer" className="underline">
                  Lien TikTok
                </a>
              )}
              {request.facebookLink && (
                <a
                  href={request.facebookLink}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Lien Facebook
                </a>
              )}
            </div>
          )}
          {request.media.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {request.media.map((m, i) =>
                m.url ? (
                  <img
                    key={i}
                    src={m.url}
                    alt=""
                    className="h-20 w-20 rounded-lg border border-border object-cover"
                  />
                ) : null,
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {request.myCandidatureStatus ? (
        <Card>
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <Badge variant="outline">Statut : {request.myCandidatureStatus}</Badge>
            {request.myCandidatureStatus === 'PENDING' && (
              <Button
                variant="destructive"
                size="sm"
                disabled={withdrawing}
                onClick={() => void onWithdraw()}
              >
                {withdrawing ? 'Retrait…' : 'Retirer ma candidature'}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : request.status === 'OPEN' ? (
        <Button onClick={() => router.push(`/agent/candidater/${request.id}`)} className="w-fit">
          Candidater
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">Cette demande n&apos;est plus ouverte.</p>
      )}
    </div>
  );
}
