'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { uploadImage } from '@/lib/upload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface WholesalerProfile {
  shopName: string;
  slug: string;
  description: string | null;
  locationCity: string;
  locationDetail: string | null;
  hours: string | null;
  whatsappLink: string | null;
  logoUploadId: string | null;
  coverUploadId: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
}

export default function BoutiquePage() {
  const [profile, setProfile] = useState<WholesalerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api<{ profile: WholesalerProfile }>('/api/wholesaler/profile');
        setProfile(res.profile);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function onLogoChange(file: File | null) {
    if (!file || !profile) return;
    setUploadingLogo(true);
    try {
      const uploaded = await uploadImage(file);
      setProfile({ ...profile, logoUploadId: uploaded.id, logoUrl: uploaded.url });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Échec de l'envoi de l'image.");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function onCoverChange(file: File | null) {
    if (!file || !profile) return;
    setUploadingCover(true);
    try {
      const uploaded = await uploadImage(file);
      setProfile({ ...profile, coverUploadId: uploaded.id, coverUrl: uploaded.url });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Échec de l'envoi de l'image.");
    } finally {
      setUploadingCover(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await api<{ profile: WholesalerProfile }>('/api/wholesaler/profile', {
        method: 'PATCH',
        body: {
          shopName: profile.shopName,
          description: profile.description,
          locationCity: profile.locationCity,
          locationDetail: profile.locationDetail,
          hours: profile.hours,
          whatsappLink: profile.whatsappLink,
          logoUploadId: profile.logoUploadId,
          coverUploadId: profile.coverUploadId,
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

  if (loading) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }
  if (!profile) {
    return <p className="text-sm text-destructive">{error ?? 'Boutique introuvable.'}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ma boutique</h1>
        <p className="text-sm text-muted-foreground">
          Visible publiquement sur{' '}
          <Link href={`/boutiques/${profile.slug}`} className="underline" target="_blank">
            /boutiques/{profile.slug}
          </Link>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations de la boutique</CardTitle>
          <CardDescription>Ces informations sont visibles par tous les visiteurs.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="shopName">Nom de la boutique</Label>
              <Input
                id="shopName"
                required
                value={profile.shopName}
                onChange={(e) => setProfile({ ...profile, shopName: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={4}
                value={profile.description ?? ''}
                onChange={(e) => setProfile({ ...profile, description: e.target.value || null })}
                placeholder="Ce que tu vends, tes spécialités…"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="locationCity">Ville</Label>
                <Input
                  id="locationCity"
                  required
                  value={profile.locationCity}
                  onChange={(e) => setProfile({ ...profile, locationCity: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="locationDetail">Marché / quartier</Label>
                <Input
                  id="locationDetail"
                  value={profile.locationDetail ?? ''}
                  onChange={(e) =>
                    setProfile({ ...profile, locationDetail: e.target.value || null })
                  }
                  placeholder="Dantokpa, Missèbo…"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="hours">Horaires</Label>
                <Input
                  id="hours"
                  value={profile.hours ?? ''}
                  onChange={(e) => setProfile({ ...profile, hours: e.target.value || null })}
                  placeholder="Lun-Sam 8h-18h"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="whatsappLink">Lien WhatsApp</Label>
                <Input
                  id="whatsappLink"
                  value={profile.whatsappLink ?? ''}
                  onChange={(e) => setProfile({ ...profile, whatsappLink: e.target.value || null })}
                  placeholder="https://wa.me/229..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="logo">Logo</Label>
                {profile.logoUrl && (
                  <img
                    src={profile.logoUrl}
                    alt="Logo"
                    className="h-16 w-16 rounded-lg border border-border object-cover"
                  />
                )}
                <Input
                  id="logo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={uploadingLogo}
                  onChange={(e) => void onLogoChange(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cover">Photo de couverture</Label>
                {profile.coverUrl && (
                  <img
                    src={profile.coverUrl}
                    alt="Couverture"
                    className="h-16 w-full rounded-lg border border-border object-cover"
                  />
                )}
                <Input
                  id="cover"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={uploadingCover}
                  onChange={(e) => void onCoverChange(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            {saved && <p className="text-sm text-primary">Boutique mise à jour.</p>}

            <Button
              type="submit"
              disabled={saving || uploadingLogo || uploadingCover}
              className="w-fit"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
