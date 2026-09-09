'use client';

// /admin/abonnements — Phase 8 (PRD 3.24). Read-only list of ProSubscription
// rows + MRR, fed by GET /api/admin/subscriptions.
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SubscriptionRow {
  id: string;
  userId: string;
  user: { email: string; marketplaceRole: string | null };
  profileType: string;
  plan: string;
  status: string;
  currentPeriodEnd: string | null;
  graceEndsAt: string | null;
  createdAt: string;
}

const STATUS_OPTIONS = ['ACTIVE', 'GRACE', 'EXPIRED', 'CANCELLED', 'INACTIVE'];
const PLAN_OPTIONS = ['AGENT_PRO', 'WHOLESALER_PRO'];

const STATUS_BADGE: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  ACTIVE: 'default',
  GRACE: 'secondary',
  EXPIRED: 'destructive',
  CANCELLED: 'destructive',
  INACTIVE: 'outline',
};

export default function AdminAbonnementsPage() {
  const [items, setItems] = useState<SubscriptionRow[] | null>(null);
  const [mrr, setMrr] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [plan, setPlan] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const buildQuery = useCallback(
    (cursor?: string | null) => {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (plan) params.set('plan', plan);
      if (cursor) params.set('cursor', cursor);
      const qs = params.toString();
      return qs ? `?${qs}` : '';
    },
    [status, plan],
  );

  const load = useCallback(async () => {
    try {
      const res = await api<{ items: SubscriptionRow[]; nextCursor: string | null; mrr: number }>(
        `/api/admin/subscriptions${buildQuery()}`,
      );
      setItems(res.items);
      setNextCursor(res.nextCursor);
      setMrr(res.mrr);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    }
  }, [buildQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const res = await api<{ items: SubscriptionRow[]; nextCursor: string | null; mrr: number }>(
        `/api/admin/subscriptions${buildQuery(nextCursor)}`,
      );
      setItems((prev) => [...(prev ?? []), ...res.items]);
      setNextCursor(res.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Abonnements</h1>

      <Card className="max-w-sm">
        <CardHeader>
          <CardDescription>Revenu mensuel récurrent (MRR)</CardDescription>
          <CardTitle className="text-3xl">{mrr.toLocaleString('fr-FR')} FCFA</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Abonnements actifs ou en grâce
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Select value={status} onValueChange={(v) => setStatus(v ?? '')}>
          <SelectTrigger>
            <SelectValue placeholder="Tous les statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Tous les statuts</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={plan} onValueChange={(v) => setPlan(v ?? '')}>
          <SelectTrigger>
            <SelectValue placeholder="Tous les plans" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Tous les plans</SelectItem>
            {PLAN_OPTIONS.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {items === null ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun abonnement ne correspond à ces filtres.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((sub) => (
            <Card key={sub.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-medium">
                    {sub.user.email}{' '}
                    <span className="text-muted-foreground">
                      ({sub.user.marketplaceRole ?? '—'})
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {sub.plan} · échéance{' '}
                    {sub.currentPeriodEnd
                      ? new Date(sub.currentPeriodEnd).toLocaleDateString('fr-FR')
                      : '—'}
                    {sub.graceEndsAt &&
                      ` · grâce jusqu'au ${new Date(sub.graceEndsAt).toLocaleDateString('fr-FR')}`}
                  </p>
                </div>
                <Badge variant={STATUS_BADGE[sub.status] ?? 'outline'}>{sub.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {nextCursor && (
        <Button variant="outline" disabled={loadingMore} onClick={() => void loadMore()}>
          Charger plus
        </Button>
      )}
    </div>
  );
}
