'use client';

// /admin/utilisateurs/[id] — Phase 8 (PRD 3.23 "voir l'activité détaillée
// d'un utilisateur"). Combines base identity, the marketplace-specific
// profile summary (buyer/agent/wholesaler — at most one is non-null),
// subscription summary, account suspend/reactivate (existing
// PATCH /api/admin/users/[id]/status), and for AGENT users the Phase 8
// agent-badge suspend/unsuspend actions.
import { use, useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface UserDetail {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  marketplaceRole: string | null;
  emailVerifiedAt: string | null;
  createdAt: string;
  buyerProfile: {
    fullName: string | null;
    phone: string | null;
    deliveryCountry: string | null;
  } | null;
  agentProfile: {
    id: string;
    displayName: string | null;
    verificationStatus: string;
    isSuspended: boolean;
    avgRating: number | null;
    reviewCount: number;
    missionCount: number;
    publicSlug: string | null;
  } | null;
  wholesalerProfile: {
    id: string;
    shopName: string | null;
    slug: string | null;
    status: string;
  } | null;
  proSubscription: { plan: string; status: string; currentPeriodEnd: string | null } | null;
}

export default function AdminUtilisateurDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [user, setUser] = useState<UserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<{ user: UserDetail }>(`/api/admin/users/${id}`);
      setUser(res.user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleAccountStatus() {
    if (!user) return;
    const nextStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/users/${id}/status`, { method: 'PATCH', body: { status: nextStatus } });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleAgentSuspension() {
    if (!user?.agentProfile) return;
    const action = user.agentProfile.isSuspended ? 'unsuspend' : 'suspend';
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/agents/${user.agentProfile.id}/${action}`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setBusy(false);
    }
  }

  if (error && !user) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {error}
      </p>
    );
  }
  if (!user) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{user.name ?? user.email}</h1>
        <div className="flex gap-2">
          {user.marketplaceRole && <Badge variant="secondary">{user.marketplaceRole}</Badge>}
          <Badge variant="outline">{user.role}</Badge>
          <Badge variant={user.status === 'ACTIVE' ? 'default' : 'destructive'}>
            {user.status}
          </Badge>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Identité</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
          <p>Email : {user.email}</p>
          <p>Email vérifié : {user.emailVerifiedAt ? 'oui' : 'non'}</p>
          <p>Inscrit le {new Date(user.createdAt).toLocaleDateString('fr-FR')}</p>
        </CardContent>
      </Card>

      {user.buyerProfile && (
        <Card>
          <CardHeader>
            <CardTitle>Profil acheteur</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
            <p>Nom : {user.buyerProfile.fullName ?? '—'}</p>
            <p>Téléphone : {user.buyerProfile.phone ?? '—'}</p>
            <p>Pays de livraison : {user.buyerProfile.deliveryCountry ?? '—'}</p>
          </CardContent>
        </Card>
      )}

      {user.agentProfile && (
        <Card>
          <CardHeader>
            <CardTitle>Profil agent</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
            <p>Nom affiché : {user.agentProfile.displayName ?? '—'}</p>
            <p>Vérification : {user.agentProfile.verificationStatus}</p>
            <p>
              Note moyenne : {user.agentProfile.avgRating?.toFixed(1) ?? '—'} (
              {user.agentProfile.reviewCount} avis · {user.agentProfile.missionCount} missions)
            </p>
            <div className="flex items-center gap-2">
              <Badge variant={user.agentProfile.isSuspended ? 'destructive' : 'default'}>
                {user.agentProfile.isSuspended ? 'Compte agent suspendu' : 'Compte agent actif'}
              </Badge>
              <Button
                variant={user.agentProfile.isSuspended ? 'default' : 'destructive'}
                size="sm"
                disabled={busy}
                onClick={() => void toggleAgentSuspension()}
              >
                {user.agentProfile.isSuspended ? "Réactiver l'agent" : "Suspendre l'agent"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {user.wholesalerProfile && (
        <Card>
          <CardHeader>
            <CardTitle>Profil grossiste</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
            <p>Boutique : {user.wholesalerProfile.shopName ?? '—'}</p>
            <p>Statut boutique : {user.wholesalerProfile.status}</p>
          </CardContent>
        </Card>
      )}

      {user.proSubscription && (
        <Card>
          <CardHeader>
            <CardTitle>Abonnement</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
            <p>Plan : {user.proSubscription.plan}</p>
            <p>Statut : {user.proSubscription.status}</p>
            <p>
              Échéance :{' '}
              {user.proSubscription.currentPeriodEnd
                ? new Date(user.proSubscription.currentPeriodEnd).toLocaleDateString('fr-FR')
                : '—'}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Compte</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant={user.status === 'ACTIVE' ? 'destructive' : 'default'}
            disabled={busy}
            onClick={() => void toggleAccountStatus()}
          >
            {user.status === 'ACTIVE' ? 'Suspendre le compte' : 'Réactiver le compte'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
