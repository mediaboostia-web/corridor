'use client';

// /abonnement/upgrade — Phase 7 (F25/F26, US8). Transversal page reachable
// by both AGENT and WHOLESALER (never BUYER — "Pas de plan Pro en V1" per
// prd.md §6), so it lives outside the role-scoped route groups rather than
// being duplicated under /agent and /wholesaler. Guard logic is inlined
// (not RoleGuard, which only takes a single role) since this is the one
// page in the app that's valid for two roles at once.
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckIcon } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import {
  roleHomePath,
  SUBSCRIPTION_CURRENCY,
  SUBSCRIPTION_PLAN_PRICE,
  type SubscriptionPlan,
} from '@/lib/marketplace';
import { Button } from '@/components/ui/button';
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

const PRO_BENEFITS: Record<SubscriptionPlan, string[]> = {
  AGENT_PRO: [
    'Badge vérifié mis en avant',
    'Priorité d’affichage dans les candidatures',
    'Accès aux statistiques de tes missions',
    'Apparition dans le classement des meilleurs agents',
  ],
  WHOLESALER_PRO: [
    'Produits illimités (au lieu de 20)',
    'Mise en avant dans le catalogue',
    'Statistiques détaillées (vues, demandes, conversion)',
    'Inclusion automatique dans les campagnes saisonnières',
    'Badge "Grossiste partenaire"',
  ],
};

function UpgradeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectStatus = searchParams.get('status'); // 'success' | 'failed' | null

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.marketplaceRole !== 'AGENT' && user.marketplaceRole !== 'WHOLESALER') {
      router.replace(
        user.marketplaceRole ? roleHomePath(user.marketplaceRole) : '/onboarding/choisir-role',
      );
    }
  }, [user, authLoading, router]);

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
    if (user?.marketplaceRole === 'AGENT' || user?.marketplaceRole === 'WHOLESALER') {
      void load();
    }
  }, [user, load]);

  async function onCheckout() {
    setCheckingOut(true);
    setError(null);
    try {
      const res = await api<{ paymentUrl: string | null }>('/api/subscriptions/checkout', {
        method: 'POST',
        headers: { 'idempotency-key': crypto.randomUUID() },
      });
      if (res.paymentUrl) {
        window.location.href = res.paymentUrl;
      } else {
        setError('Le fournisseur de paiement n’a pas renvoyé de lien de paiement.');
        setCheckingOut(false);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
      setCheckingOut(false);
    }
  }

  if (
    authLoading ||
    !user ||
    (user.marketplaceRole !== 'AGENT' && user.marketplaceRole !== 'WHOLESALER')
  ) {
    return null;
  }

  const plan: SubscriptionPlan = user.marketplaceRole === 'AGENT' ? 'AGENT_PRO' : 'WHOLESALER_PRO';
  const price = SUBSCRIPTION_PLAN_PRICE[plan];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Passer {PLAN_LABEL[plan]}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Compare le plan gratuit et le plan Pro, et souscris en un clic.
        </p>
      </div>

      {redirectStatus === 'success' && (
        <p className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          Paiement reçu. L&apos;activation de ton abonnement Pro peut prendre quelques instants —
          actualise cette page si le statut ci-dessous ne bouge pas tout de suite.
        </p>
      )}
      {redirectStatus === 'failed' && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          Le paiement n&apos;a pas abouti. Tu peux réessayer ci-dessous.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : sub?.isPro ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tu es déjà {PLAN_LABEL[plan]}</CardTitle>
            <CardDescription>
              {sub.status === 'GRACE' && sub.graceEndsAt
                ? `Période de grâce jusqu'au ${new Date(sub.graceEndsAt).toLocaleDateString('fr-FR')} — renouvelle pour garder tes avantages.`
                : sub.currentPeriodEnd
                  ? `Renouvellement le ${new Date(sub.currentPeriodEnd).toLocaleDateString('fr-FR')}.`
                  : null}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Gratuit</CardTitle>
              <CardDescription>Ton plan actuel</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {plan === 'AGENT_PRO' ? (
                <p>Profil basique, badge vérifié gratuit, tu peux candidater normalement.</p>
              ) : (
                <p>Jusqu&apos;à 20 produits listés, page boutique basique.</p>
              )}
            </CardContent>
          </Card>
          <Card className="border-primary">
            <CardHeader>
              <CardTitle className="text-base">{PLAN_LABEL[plan]}</CardTitle>
              <CardDescription>
                {price.toLocaleString('fr-FR')} {SUBSCRIPTION_CURRENCY}/mois
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <ul className="flex flex-col gap-1.5 text-sm">
                {PRO_BENEFITS[plan].map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                disabled={checkingOut}
                onClick={() => void onCheckout()}
                className="mt-2 w-full"
              >
                {checkingOut
                  ? 'Redirection…'
                  : `Souscrire — ${price.toLocaleString('fr-FR')} ${SUBSCRIPTION_CURRENCY}/mois`}
              </Button>
              <p className="text-xs text-muted-foreground">
                Paiement via mobile money ou carte, renouvelable chaque mois.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function AbonnementUpgradePage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-muted-foreground">Chargement…</p>}>
      <UpgradeContent />
    </Suspense>
  );
}
