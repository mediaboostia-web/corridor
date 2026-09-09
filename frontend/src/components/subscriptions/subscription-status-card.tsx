'use client';

// Shared Pro-subscription status + cancel action, mounted by both
// /agent/profil-parametres and /wholesaler/profil-abonnement (Phase 7).
// Mirrors the NotificationsView / MessagingView precedent: one component,
// two role pages, identical API surface (GET/POST /api/subscriptions/*
// is role-agnostic — requireAnyMarketplaceRole(['AGENT','WHOLESALER'])).
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { type SubscriptionPlan } from '@/lib/marketplace';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface SubscriptionInfo {
  plan: SubscriptionPlan;
  status: 'INACTIVE' | 'ACTIVE' | 'GRACE' | 'EXPIRED' | 'CANCELLED';
  currentPeriodEnd: string | null;
  graceEndsAt: string | null;
  isPro: boolean;
}

const PLAN_LABEL: Record<SubscriptionPlan, string> = {
  AGENT_PRO: 'Agent Pro',
  WHOLESALER_PRO: 'Grossiste Pro',
};

const STATUS_LABEL: Record<SubscriptionInfo['status'], string> = {
  INACTIVE: 'Aucun abonnement',
  ACTIVE: 'Actif',
  GRACE: 'Période de grâce',
  EXPIRED: 'Expiré',
  CANCELLED: 'Annulé',
};

export function SubscriptionStatusCard() {
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<{ subscription: SubscriptionInfo }>('/api/subscriptions/me');
      setSub(res.subscription);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCancel() {
    setCancelling(true);
    setError(null);
    try {
      const res = await api<{ subscription: SubscriptionInfo }>('/api/subscriptions/cancel', {
        method: 'POST',
      });
      setSub(res.subscription);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Abonnement Pro</CardTitle>
        <CardDescription>
          Visibilité et outils avancés — jamais un verrou sur l&apos;essentiel.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : (
          sub && (
            <>
              <div className="flex items-center gap-2">
                <Badge variant={sub.isPro ? 'secondary' : 'outline'}>
                  {STATUS_LABEL[sub.status]}
                </Badge>
                <span className="text-sm font-medium">{PLAN_LABEL[sub.plan]}</span>
              </div>
              {sub.status === 'GRACE' && sub.graceEndsAt && (
                <p className="text-sm text-muted-foreground">
                  Non renouvelé — tes avantages Pro sont suspendus le{' '}
                  {new Date(sub.graceEndsAt).toLocaleDateString('fr-FR')}.
                </p>
              )}
              {sub.status === 'ACTIVE' && sub.currentPeriodEnd && (
                <p className="text-sm text-muted-foreground">
                  Renouvellement le {new Date(sub.currentPeriodEnd).toLocaleDateString('fr-FR')}.
                </p>
              )}

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {sub.isPro ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={cancelling}
                    onClick={() => void onCancel()}
                  >
                    {cancelling ? 'Annulation…' : "Annuler l'abonnement"}
                  </Button>
                ) : (
                  <Link href="/abonnement/upgrade" className={buttonVariants({ size: 'sm' })}>
                    Passer Pro
                  </Link>
                )}
              </div>
            </>
          )
        )}
      </CardContent>
    </Card>
  );
}
