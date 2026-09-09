'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RequestDetail {
  id: string;
  title: string;
  description: string;
  productId: string | null;
  tiktokLink: string | null;
  facebookLink: string | null;
  budgetAmount: number | null;
  currency: string;
  quantity: number | null;
  deliveryCountry: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  media: { url: string | null }[];
}

interface Candidature {
  id: string;
  proposedCommissionAmount: number | null;
  currency: string;
  message: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';
  createdAt: string;
  agentProfile: {
    id: string;
    displayName: string;
    publicSlug: string;
    actionZone: string | null;
    missionCount: number;
    avgRating: number | null;
    reviewCount: number;
  };
}

const STATUS_LABEL: Record<RequestDetail['status'], string> = {
  OPEN: 'Ouverte',
  IN_PROGRESS: 'En cours',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
};

const CANDIDATURE_STATUS_LABEL: Record<Candidature['status'], string> = {
  PENDING: 'En attente',
  ACCEPTED: 'Acceptée',
  REJECTED: 'Non retenue',
  WITHDRAWN: 'Retirée',
};

export default function DemandeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [candidatures, setCandidatures] = useState<Candidature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [commissionDrafts, setCommissionDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const res = await api<{ request: RequestDetail; candidatures: Candidature[] }>(
        `/api/buyer/sourcing-requests/${params.id}`,
      );
      setRequest(res.request);
      setCandidatures(res.candidatures);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCancel() {
    if (!window.confirm('Annuler cette demande de sourcing ?')) return;
    setCancelling(true);
    setError(null);
    try {
      const res = await api<{ request: RequestDetail }>(
        `/api/buyer/sourcing-requests/${params.id}`,
        {
          method: 'PATCH',
          body: { status: 'CANCELLED' },
        },
      );
      setRequest(res.request);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setCancelling(false);
    }
  }

  async function onAccept(candidatureId: string, proposed: number | null) {
    const draft = commissionDrafts[candidatureId];
    const amount = draft ? Math.round(Number(draft)) : proposed;
    if (!amount) {
      setError('Indique le montant de la commission avant d’accepter cette candidature.');
      return;
    }
    if (!window.confirm('Accepter cette candidature ? Une mission sera créée.')) return;
    setAccepting(candidatureId);
    setError(null);
    try {
      await api(`/api/buyer/sourcing-requests/${params.id}/candidatures/${candidatureId}/accept`, {
        method: 'POST',
        body: { agreedCommissionAmount: amount },
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setAccepting(null);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (!request)
    return <p className="text-sm text-destructive">{error ?? 'Demande introuvable.'}</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push('/buyer/mes-demandes')}
          className="text-sm text-muted-foreground underline"
        >
          ← Mes demandes
        </button>
      </div>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{request.title}</h1>
        <Badge>{STATUS_LABEL[request.status]}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détails</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm">{request.description}</p>

          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            {request.budgetAmount && (
              <div>
                <p className="text-muted-foreground">Budget</p>
                <p>
                  {request.budgetAmount.toLocaleString('fr-FR')} {request.currency}
                </p>
              </div>
            )}
            {request.quantity && (
              <div>
                <p className="text-muted-foreground">Quantité</p>
                <p>{request.quantity}</p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground">Livraison</p>
              <p>{request.deliveryCountry}</p>
            </div>
          </div>

          {(request.tiktokLink || request.facebookLink) && (
            <div className="flex gap-4 text-sm">
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Candidatures {candidatures.length > 0 ? `(${candidatures.length})` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {candidatures.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune candidature pour l&apos;instant.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {candidatures.map((c) => (
                <div key={c.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/agents/${c.agentProfile.publicSlug}`}
                      target="_blank"
                      className="font-medium underline"
                    >
                      {c.agentProfile.displayName}
                    </Link>
                    <Badge variant={c.status === 'ACCEPTED' ? 'default' : 'outline'}>
                      {CANDIDATURE_STATUS_LABEL[c.status]}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {c.agentProfile.actionZone ?? 'Zone non précisée'} ·{' '}
                    {c.agentProfile.avgRating
                      ? `${c.agentProfile.avgRating.toFixed(1)}/5`
                      : 'Pas encore noté'}{' '}
                    ({c.agentProfile.reviewCount} avis) · {c.agentProfile.missionCount} mission
                    {c.agentProfile.missionCount > 1 ? 's' : ''}
                  </p>
                  <p className="text-sm">{c.message}</p>
                  {c.proposedCommissionAmount && (
                    <p className="text-sm text-muted-foreground">
                      Commission proposée : {c.proposedCommissionAmount.toLocaleString('fr-FR')}{' '}
                      {c.currency}
                    </p>
                  )}

                  {request.status === 'OPEN' && c.status === 'PENDING' && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Input
                        type="number"
                        min={1}
                        placeholder="Commission convenue (FCFA)"
                        className="max-w-[220px]"
                        value={commissionDrafts[c.id] ?? c.proposedCommissionAmount ?? ''}
                        onChange={(e) =>
                          setCommissionDrafts({ ...commissionDrafts, [c.id]: e.target.value })
                        }
                      />
                      <Button
                        size="sm"
                        disabled={accepting === c.id}
                        onClick={() => void onAccept(c.id, c.proposedCommissionAmount)}
                      >
                        {accepting === c.id ? 'Acceptation…' : 'Accepter'}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {request.status === 'OPEN' && (
        <Button
          variant="destructive"
          disabled={cancelling}
          onClick={() => void onCancel()}
          className="w-fit"
        >
          {cancelling ? 'Annulation…' : 'Annuler la demande'}
        </Button>
      )}
    </div>
  );
}
