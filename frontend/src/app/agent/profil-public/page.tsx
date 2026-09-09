'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AgentProfile {
  displayName: string;
  bio: string | null;
  actionZone: string | null;
  phone: string | null;
  publicSlug: string;
  verificationStatus: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED' | 'REVOKED';
  missionCount: number;
  avgRating: number | null;
  reviewCount: number;
}

export default function AgentProfilPublicPage() {
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api<{ profile: AgentProfile }>('/api/agent/profile');
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
      const res = await api<{ profile: AgentProfile }>('/api/agent/profile', {
        method: 'PATCH',
        body: { displayName: profile.displayName, bio: profile.bio, phone: profile.phone },
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Mon profil public</h1>
        {profile.verificationStatus === 'VERIFIED' && (
          <Link
            href={`/agents/${profile.publicSlug}`}
            target="_blank"
            className="text-sm underline"
          >
            Voir ma page publique
          </Link>
        )}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 py-4">
          <Badge variant={profile.verificationStatus === 'VERIFIED' ? 'default' : 'secondary'}>
            {profile.verificationStatus === 'VERIFIED' ? 'Vérifié' : 'Non vérifié'}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {profile.missionCount} mission{profile.missionCount > 1 ? 's' : ''} ·{' '}
            {profile.avgRating ? `${profile.avgRating.toFixed(1)}/5` : 'Pas encore noté'} (
            {profile.reviewCount} avis)
          </span>
          {profile.actionZone && (
            <span className="text-sm text-muted-foreground">Zone : {profile.actionZone}</span>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="displayName">Nom affiché</Label>
              <Input
                id="displayName"
                required
                minLength={2}
                value={profile.displayName}
                onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                rows={4}
                value={profile.bio ?? ''}
                onChange={(e) => setProfile({ ...profile, bio: e.target.value || null })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Téléphone</Label>
              <Input
                id="phone"
                value={profile.phone ?? ''}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value || null })}
                placeholder="+229..."
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
