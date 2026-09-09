'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import {
  MISSION_FULFILLMENT_TYPES,
  MISSION_FULFILLMENT_TYPE_LABEL,
  MISSION_FULFILLMENT_TYPE_DESCRIPTION,
  type MissionFulfillmentType,
} from '@/lib/mission-status';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface RequestSummary {
  id: string;
  title: string;
  deliveryCountry: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
}

export default function AgentCandidaterPage() {
  const params = useParams<{ requestId: string }>();
  const router = useRouter();
  const [request, setRequest] = useState<RequestSummary | null>(null);
  const [proposedCommissionAmount, setProposedCommissionAmount] = useState('');
  const [message, setMessage] = useState('');
  const [fulfillmentType, setFulfillmentType] = useState<MissionFulfillmentType>('STANDARD');
  const [error, setError] = useState<string | null>(null);
  const [notVerified, setNotVerified] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<{ request: RequestSummary }>(
        `/api/agent/demandes-ouvertes/${params.requestId}`,
      );
      setRequest(res.request);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    }
  }, [params.requestId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotVerified(false);
    try {
      await api('/api/agent/candidatures', {
        method: 'POST',
        body: {
          sourcingRequestId: params.requestId,
          message,
          fulfillmentType,
          ...(proposedCommissionAmount
            ? { proposedCommissionAmount: Math.round(Number(proposedCommissionAmount)) }
            : {}),
        },
      });
      router.push(`/agent/demandes-ouvertes/${params.requestId}`);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'AGENT_NOT_VERIFIED') {
        setNotVerified(true);
      } else {
        setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!request) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  if (notVerified) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-3 py-6">
          <p className="text-sm">
            Ton identité doit être vérifiée avant de pouvoir candidater à une demande de sourcing.
          </p>
          <Link href="/agent/verification">
            <Button>Vérifier mon identité</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Candidater : {request.title}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ta proposition</CardTitle>
          <CardDescription>
            Décris comment tu comptes trouver ce produit à {request.deliveryCountry}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Comment comptes-tu t&apos;en occuper ?</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {MISSION_FULFILLMENT_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFulfillmentType(type)}
                    className={cn(
                      'flex flex-col gap-1 rounded-lg border p-3 text-left text-sm transition-colors',
                      fulfillmentType === type
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50',
                    )}
                  >
                    <span className="font-medium">{MISSION_FULFILLMENT_TYPE_LABEL[type]}</span>
                    <span className="text-xs text-muted-foreground">
                      {MISSION_FULFILLMENT_TYPE_DESCRIPTION[type]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="proposedCommissionAmount">
                Commission proposée (FCFA, optionnel)
              </Label>
              <Input
                id="proposedCommissionAmount"
                type="number"
                min={1}
                value={proposedCommissionAmount}
                onChange={(e) => setProposedCommissionAmount(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                required
                minLength={10}
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" disabled={submitting || message.length < 10} className="w-fit">
              {submitting ? 'Envoi…' : 'Envoyer ma candidature'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
