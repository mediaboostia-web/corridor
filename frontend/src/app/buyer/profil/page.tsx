'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface BuyerProfile {
  fullName: string | null;
  phone: string | null;
  deliveryCountry: string | null;
}

export default function BuyerProfilPage() {
  const [profile, setProfile] = useState<BuyerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api<{ profile: BuyerProfile }>('/api/buyer/profile');
        setProfile(res.profile);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await api<{ profile: BuyerProfile }>('/api/buyer/profile', {
        method: 'PATCH',
        body: {
          fullName: profile.fullName,
          phone: profile.phone,
          deliveryCountry: profile.deliveryCountry,
        },
      });
      setProfile(res.profile);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (!profile) return <p className="text-sm text-destructive">{error ?? 'Profil introuvable.'}</p>;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Mon profil</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations</CardTitle>
          <CardDescription>
            Ton pays de livraison est pré-rempli automatiquement dans tes prochaines demandes de
            sourcing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fullName">Nom complet</Label>
              <Input
                id="fullName"
                value={profile.fullName ?? ''}
                onChange={(e) => setProfile({ ...profile, fullName: e.target.value || null })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Téléphone</Label>
              <Input
                id="phone"
                value={profile.phone ?? ''}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value || null })}
                placeholder="+241..."
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="deliveryCountry">Pays de livraison</Label>
              <Input
                id="deliveryCountry"
                value={profile.deliveryCountry ?? ''}
                onChange={(e) =>
                  setProfile({ ...profile, deliveryCountry: e.target.value || null })
                }
                placeholder="Gabon"
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            {saved && <p className="text-sm text-primary">Profil mis à jour.</p>}

            <Button type="submit" disabled={saving} className="w-fit">
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
