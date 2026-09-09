'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { StarIcon } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { openOrCreateConversation } from '@/lib/messaging';
import {
  MISSION_STATUS_LABEL,
  MISSION_FULFILLMENT_TYPE_LABEL,
  isAwaitingBuyerConfirmation,
} from '@/lib/mission-status';
import type { MissionStatus, MissionFulfillmentType } from '@/lib/mission-status';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatusEvent {
  id: string;
  status: MissionStatus;
  note: string | null;
  createdAt: string;
  media: { url: string | null }[];
}

interface MissionDetail {
  id: string;
  status: MissionStatus;
  fulfillmentType: MissionFulfillmentType;
  agreedCommissionAmount: number;
  currency: string;
  createdAt: string;
  agentProfile: {
    id: string;
    userId: string;
    displayName: string;
    publicSlug: string;
    avgRating: number | null;
    reviewCount: number;
  };
  wholesalerProfile: { id: string; shopName: string; slug: string; userId: string } | null;
  sourcingRequest: {
    id: string;
    title: string;
    description: string;
    deliveryCountry: string;
    quantity: number | null;
  };
  statusEvents: StatusEvent[];
  review: { id: string; rating: number; comment: string | null; createdAt: string } | null;
}

export default function BuyerMissionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [mission, setMission] = useState<MissionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [contacting, setContacting] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<{ mission: MissionDetail }>(`/api/buyer/missions/${params.id}`);
      setMission(res.mission);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onContact(otherUserId: string) {
    if (!mission) return;
    setContacting(true);
    setError(null);
    try {
      const conversationId = await openOrCreateConversation(otherUserId, {
        subjectType: 'MISSION',
        subjectId: mission.id,
      });
      router.push(`/buyer/messagerie?conversationId=${conversationId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
      setContacting(false);
    }
  }

  async function onConfirm() {
    if (!window.confirm('Confirmer que tu as bien reçu ce colis ?')) return;
    setConfirming(true);
    setError(null);
    try {
      await api(`/api/buyer/missions/${params.id}/confirm-delivery`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setConfirming(false);
    }
  }

  async function onSubmitReview() {
    if (rating < 1) return;
    setSubmittingReview(true);
    setError(null);
    try {
      await api(`/api/buyer/missions/${params.id}/review`, {
        method: 'POST',
        body: { rating, comment: comment.trim() || undefined },
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setSubmittingReview(false);
    }
  }

  if (error && !mission) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {error}
      </p>
    );
  }
  if (!mission) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{mission.sourcingRequest.title}</h1>
        <Badge>{MISSION_STATUS_LABEL[mission.status]}</Badge>
        <Badge variant="outline">{MISSION_FULFILLMENT_TYPE_LABEL[mission.fulfillmentType]}</Badge>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-2 py-4 text-sm">
          <p>{mission.sourcingRequest.description}</p>
          <p className="text-muted-foreground">
            {mission.agreedCommissionAmount.toLocaleString('fr-FR')} {mission.currency} · Livraison
            : {mission.sourcingRequest.deliveryCountry}
          </p>
          <p>
            Agent :{' '}
            <Link
              href={`/agents/${mission.agentProfile.publicSlug}`}
              target="_blank"
              className="underline"
            >
              {mission.agentProfile.displayName}
            </Link>{' '}
            {mission.agentProfile.avgRating
              ? `· ${mission.agentProfile.avgRating.toFixed(1)}/5 (${mission.agentProfile.reviewCount} avis)`
              : ''}
          </p>
          {mission.wholesalerProfile && (
            <p className="text-muted-foreground">Boutique : {mission.wholesalerProfile.shopName}</p>
          )}
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              disabled={contacting}
              onClick={() => void onContact(mission.agentProfile.userId)}
            >
              Contacter l&apos;agent
            </Button>
            {mission.wholesalerProfile && (
              <Button
                size="sm"
                variant="outline"
                disabled={contacting}
                onClick={() => void onContact(mission.wholesalerProfile!.userId)}
              >
                Contacter le grossiste
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Suivi</CardTitle>
        </CardHeader>
        <CardContent>
          {mission.statusEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun évènement pour l&apos;instant.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {mission.statusEvents.map((e) => (
                <div key={e.id} className="border-l-2 border-border pl-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{MISSION_STATUS_LABEL[e.status]}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(e.createdAt).toLocaleString('fr-FR', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>
                  {e.note && <p className="text-sm">{e.note}</p>}
                  {e.media.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-2">
                      {e.media.map((m, i) =>
                        m.url ? (
                          <img
                            key={i}
                            src={m.url}
                            alt=""
                            className="h-16 w-16 rounded-lg border border-border object-cover"
                          />
                        ) : null,
                      )}
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

      {isAwaitingBuyerConfirmation(mission.status, mission.fulfillmentType) && (
        <Button disabled={confirming} onClick={() => void onConfirm()} className="w-fit">
          {confirming
            ? 'Confirmation…'
            : mission.fulfillmentType === 'INSTANTANE'
              ? "J'ai bien reçu"
              : "J'ai bien reçu mon colis"}
        </Button>
      )}

      {(mission.status === 'LIVRE' || mission.status === 'AUTO_LIVRE') &&
        (mission.review ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ton avis</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 py-2">
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <StarIcon
                    key={n}
                    className={cn(
                      'size-4',
                      n <= mission.review!.rating
                        ? 'fill-primary text-primary'
                        : 'text-muted-foreground',
                    )}
                  />
                ))}
              </div>
              {mission.review.comment && <p className="text-sm">{mission.review.comment}</p>}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Laisser un avis sur l&apos;agent</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
                  >
                    <StarIcon
                      className={cn(
                        'size-6',
                        n <= rating ? 'fill-primary text-primary' : 'text-muted-foreground',
                      )}
                    />
                  </button>
                ))}
              </div>
              <Textarea
                rows={3}
                placeholder="Commentaire (optionnel)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <Button
                disabled={rating < 1 || submittingReview}
                onClick={() => void onSubmitReview()}
                className="w-fit"
              >
                {submittingReview ? 'Envoi…' : "Envoyer l'avis"}
              </Button>
            </CardContent>
          </Card>
        ))}
    </div>
  );
}
