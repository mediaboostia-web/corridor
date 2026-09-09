'use client';

// /admin/utilisateurs — Phase 8 (PRD 3.23). Filterable user list (q, admin
// role/status, marketplace role), fed by GET /api/admin/users. Links to the
// detail page per row.
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  marketplaceRole: string | null;
  createdAt: string;
}

const MARKETPLACE_ROLE_OPTIONS = ['BUYER', 'AGENT', 'WHOLESALER'];
const STATUS_OPTIONS = ['ACTIVE', 'SUSPENDED'];

export default function AdminUtilisateursPage() {
  const [items, setItems] = useState<UserRow[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [marketplaceRole, setMarketplaceRole] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const buildQuery = useCallback(
    (cursor?: string | null) => {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (marketplaceRole) params.set('marketplaceRole', marketplaceRole);
      if (status) params.set('status', status);
      if (cursor) params.set('cursor', cursor);
      const qs = params.toString();
      return qs ? `?${qs}` : '';
    },
    [q, marketplaceRole, status],
  );

  const load = useCallback(async () => {
    try {
      const res = await api<{ items: UserRow[]; nextCursor: string | null }>(
        `/api/admin/users${buildQuery()}`,
      );
      setItems(res.items);
      setNextCursor(res.nextCursor);
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
      const res = await api<{ items: UserRow[]; nextCursor: string | null }>(
        `/api/admin/users${buildQuery(nextCursor)}`,
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
      <h1 className="text-2xl font-semibold tracking-tight">Utilisateurs</h1>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Rechercher par email ou nom"
          className="max-w-xs"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void load();
          }}
        />
        <Select value={marketplaceRole} onValueChange={(v) => setMarketplaceRole(v ?? '')}>
          <SelectTrigger>
            <SelectValue placeholder="Tous les rôles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Tous les rôles</SelectItem>
            {MARKETPLACE_ROLE_OPTIONS.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        <Button variant="outline" onClick={() => void load()}>
          Rechercher
        </Button>
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
          Aucun utilisateur ne correspond à ces filtres.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((u) => (
            <Link key={u.id} href={`/admin/utilisateurs/${u.id}`}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <p className="font-medium">
                      {u.name ?? u.email} <span className="text-muted-foreground">({u.email})</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Inscrit le {new Date(u.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {u.marketplaceRole && <Badge variant="secondary">{u.marketplaceRole}</Badge>}
                    <Badge variant="outline">{u.role}</Badge>
                    <Badge variant={u.status === 'ACTIVE' ? 'default' : 'destructive'}>
                      {u.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
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
