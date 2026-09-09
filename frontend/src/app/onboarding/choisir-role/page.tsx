'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api, ApiError } from '@/lib/api';
import { roleHomePath, type MarketplaceRole } from '@/lib/marketplace';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

// Le grossiste n'apparaît pas dans le choix de rôle : modèle MVP recentré sur
// le besoin acheteur/agent (repriorisation actée), go-to-market grossiste
// différé. Le rôle WHOLESALER reste dans le schéma et reste joignable via
// l'admin si besoin, juste pas proposé au choix self-service pour l'instant.
const ROLES: Array<{ role: MarketplaceRole; title: string; description: string }> = [
  {
    role: 'BUYER',
    title: 'Acheteur',
    description:
      'Je veux acheter au prix de gros à Cotonou : parcourir le catalogue, poster une demande de sourcing, suivre ma commande.',
  },
  {
    role: 'AGENT',
    title: 'Agent sourcing',
    description:
      'Je suis à Cotonou et je veux acheter, vérifier et expédier pour des acheteurs à distance, contre commission.',
  },
];

export default function ChoisirRolePage() {
  const { user, loading, refresh } = useAuth();
  const router = useRouter();
  const [submittingRole, setSubmittingRole] = useState<MarketplaceRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.marketplaceRole) {
      router.replace(roleHomePath(user.marketplaceRole));
    }
  }, [user, loading, router]);

  async function choose(role: MarketplaceRole) {
    setSubmittingRole(role);
    setError(null);
    try {
      await api('/api/marketplace/role', { method: 'POST', body: { role } });
      await refresh();
      router.push(roleHomePath(role));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
      setSubmittingRole(null);
    }
  }

  if (loading || !user || user.marketplaceRole) return null;

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-4xl flex-col justify-center gap-10 px-4 py-12">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Comment veux-tu utiliser Corridor ?
        </h1>
        <p className="text-muted-foreground">Ce choix est définitif pour ce compte.</p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        {ROLES.map(({ role, title, description }) => (
          <Card key={role} className="flex flex-col gap-8 p-4">
            <CardHeader>
              <CardTitle className="text-2xl">{title}</CardTitle>
              <CardDescription className="text-base">{description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Button
                size="lg"
                className="w-full"
                disabled={submittingRole !== null}
                onClick={() => void choose(role)}
              >
                {submittingRole === role ? 'Confirmation…' : `Je suis ${title.toLowerCase()}`}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-center text-sm text-destructive">
          {error}
        </p>
      )}
    </main>
  );
}
