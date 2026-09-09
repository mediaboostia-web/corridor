'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

interface PendingAgent {
  id: string;
  displayName: string;
  actionZone: string | null;
  phone: string | null;
  email: string;
  submittedAt: string | null;
  idFrontUrl: string | null;
  idBackUrl: string | null;
  selfieUrl: string | null;
}

export default function AdminVerificationsAgentsPage() {
  const [items, setItems] = useState<PendingAgent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasonDrafts, setReasonDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const res = await api<{ items: PendingAgent[] }>(
        '/api/admin/agents/verifications?status=PENDING&limit=50',
      );
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function approve(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await api(`/api/admin/agents/${id}/approve`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    const reason = (reasonDrafts[id] ?? '').trim();
    if (!reason) {
      setError('Indique un motif de refus avant de rejeter cette vérification.');
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      await api(`/api/admin/agents/${id}/reject`, { method: 'POST', body: { reason } });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Vérification des agents</h1>
      <p className="text-sm text-muted-foreground">Demandes de vérification en attente.</p>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {items === null ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune vérification en attente.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex flex-col gap-3 py-4">
                <div>
                  <p className="font-medium">
                    {a.displayName} <span className="text-muted-foreground">({a.email})</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Zone : {a.actionZone ?? '—'} · Téléphone : {a.phone ?? '—'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  {[
                    { label: 'Recto', url: a.idFrontUrl },
                    { label: 'Verso', url: a.idBackUrl },
                    { label: 'Selfie', url: a.selfieUrl },
                  ].map(({ label, url }) => (
                    <div key={label} className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <div className="flex size-24 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                        {url ? (
                          <img src={url} alt="" className="size-full object-cover" />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" disabled={busyId === a.id} onClick={() => void approve(a.id)}>
                    Approuver
                  </Button>
                  <Input
                    placeholder="Motif de refus"
                    className="max-w-xs"
                    value={reasonDrafts[a.id] ?? ''}
                    onChange={(e) => setReasonDrafts({ ...reasonDrafts, [a.id]: e.target.value })}
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={busyId === a.id}
                    onClick={() => void reject(a.id)}
                  >
                    Refuser
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
