'use client';

// /admin/dashboard — Phase 8 (PRD 3.21). Read-only KPI snapshot fed by
// GET /api/admin/dashboard.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface DashboardData {
  usersByMarketplaceRole: { BUYER: number; AGENT: number; WHOLESALER: number };
  activeSourcingRequests: number;
  subscriptionRevenueTotal: number;
  missions: { total: number; completed: number; completionRate: number };
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api<DashboardData>('/api/admin/dashboard');
        setData(res);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
      }
    })();
  }, []);

  if (error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {error}
      </p>
    );
  }
  if (!data) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  const totalUsers =
    data.usersByMarketplaceRole.BUYER +
    data.usersByMarketplaceRole.AGENT +
    data.usersByMarketplaceRole.WHOLESALER;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Tableau de bord</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Utilisateurs</CardDescription>
            <CardTitle className="text-3xl">{totalUsers}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {data.usersByMarketplaceRole.BUYER} acheteurs · {data.usersByMarketplaceRole.AGENT}{' '}
            agents · {data.usersByMarketplaceRole.WHOLESALER} grossistes
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Demandes actives</CardDescription>
            <CardTitle className="text-3xl">{data.activeSourcingRequests}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Demandes de sourcing ouvertes ou en cours
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Revenus abonnements</CardDescription>
            <CardTitle className="text-3xl">
              {data.subscriptionRevenueTotal.toLocaleString('fr-FR')} FCFA
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <Link href="/admin/abonnements" className="underline">
              Voir le détail des abonnements
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Taux de complétion commandes</CardDescription>
            <CardTitle className="text-3xl">
              {(data.missions.completionRate * 100).toFixed(0)}%
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {data.missions.completed} livrées sur {data.missions.total} missions
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/admin/utilisateurs" className="underline">
          Voir les listes utilisateurs par rôle
        </Link>
      </div>
    </div>
  );
}
