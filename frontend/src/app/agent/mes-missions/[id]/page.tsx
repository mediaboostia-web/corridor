'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { uploadImage } from '@/lib/upload';
import { openOrCreateConversation } from '@/lib/messaging';
import { MISSION_STATUS_EVENT_MAX_MEDIA } from '@/lib/marketplace';
import {
  nextAgentStatus,
  isTerminalMissionStatus,
  MISSION_STATUS_LABEL,
  MISSION_FULFILLMENT_TYPE_LABEL,
} from '@/lib/mission-status';
import type { MissionStatus, MissionFulfillmentType } from '@/lib/mission-status';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface StatusEvent {
  id: string;
  status: MissionStatus;
  note: string | null;
  createdAt: string;
  media: { url: string | null }[];
}

interface MissionDetail {
  id: string;
  status: MissionStatus;
  fulfillmentType: MissionFulfillmentType;
  agreedCommissionAmount: number;
  currency: string;
  createdAt: string;
  buyerId: string;
  wholesalerProfile: { id: string; shopName: string; slug: string; userId: string } | null;
  sourcingRequest: {
    id: string;
    title: string;
    description: string;
    deliveryCountry: string;
    quantity: number | null;
  };
  statusEvents: StatusEvent[];
}

interface UploadedImage {
  id: string;
  url: string;
}

export default function AgentMissionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [mission, setMission] = useState<MissionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contacting, setContacting] = useState(false);
  const [note, setNote] = useState('');
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [shopSlug, setShopSlug] = useState('');
  const [advancing, setAdvancing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<{ mission: MissionDetail }>(`/api/agent/missions/${params.id}`);
      setMission(res.mission);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onFilesSelected(files: FileList | null) {
    if (!files || !files.length) return;
    const remaining = MISSION_STATUS_EVENT_MAX_MEDIA - images.length;
    const toUpload = Array.from(files).slice(0, remaining);
    setUploading(true);
    setError(null);
    try {
      for (const file of toUpload) {
        const uploaded = await uploadImage(file);
        setImages((prev) => [...prev, { id: uploaded.id, url: uploaded.url }]);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Échec de l'envoi d'une photo.");
    } finally {
      setUploading(false);
    }
  }

  function removeImage(id: string) {
    setImages((prev) => prev.filter((img) => img.id !== id));
  }

  async function onContact(otherUserId: string) {
    if (!mission) return;
    setContacting(true);
    setError(null);
    try {
      const conversationId = await openOrCreateConversation(otherUserId, {
        subjectType: 'MISSION',
        subjectId: mission.id,
      });
      router.push(`/agent/messagerie?conversationId=${conversationId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
      setContacting(false);
    }
  }

  async function onAdvance() {
    setAdvancing(true);
    setError(null);
    try {
      let wholesalerProfileId: string | undefined;
      if (!mission?.wholesalerProfile && shopSlug.trim()) {
        try {
          const shop = await api<{ profile: { id: string } }>(`/api/boutiques/${shopSlug.trim()}`);
          wholesalerProfileId = shop.profile.id;
        } catch {
          setError('Boutique introuvable pour ce lien. Vérifie le slug.');
          setAdvancing(false);
          return;
        }
      }

      await api(`/api/agent/missions/${params.id}/status`, {
        method: 'POST',
        body: {
          note: note.trim() || undefined,
          mediaFileUploadIds: images.map((img) => img.id),
          ...(wholesalerProfileId ? { wholesalerProfileId } : {}),
        },
      });
      setNote('');
      setImages([]);
      setShopSlug('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setAdvancing(false);
    }
  }

  if (error && !mission) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {error}
      </p>
    );
  }
  if (!mission) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  const next = nextAgentStatus(mission.status, mission.fulfillmentType);
  const terminal = isTerminalMissionStatus(mission.status);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{mission.sourcingRequest.title}</h1>
        <Badge>{MISSION_STATUS_LABEL[mission.status]}</Badge>
        <Badge variant="outline">{MISSION_FULFILLMENT_TYPE_LABEL[mission.fulfillmentType]}</Badge>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-2 py-4 text-sm">
          <p>{mission.sourcingRequest.description}</p>
          <p className="text-muted-foreground">
            {mission.agreedCommissionAmount.toLocaleString('fr-FR')} {mission.currency} · Livraison
            : {mission.sourcingRequest.deliveryCountry}
            {mission.sourcingRequest.quantity ? ` · x${mission.sourcingRequest.quantity}` : ''}
          </p>
          {mission.wholesalerProfile && (
            <p className="text-muted-foreground">Boutique : {mission.wholesalerProfile.shopName}</p>
          )}
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              disabled={contacting}
              onClick={() => void onContact(mission.buyerId)}
            >
              Contacter l&apos;acheteur
            </Button>
            {mission.wholesalerProfile && (
              <Button
                size="sm"
                variant="outline"
                disabled={contacting}
                onClick={() => void onContact(mission.wholesalerProfile!.userId)}
              >
                Contacter le grossiste
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historique</CardTitle>
        </CardHeader>
        <CardContent>
          {mission.statusEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun évènement pour l&apos;instant.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {mission.statusEvents.map((e) => (
                <div key={e.id} className="border-l-2 border-border pl-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{MISSION_STATUS_LABEL[e.status]}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(e.createdAt).toLocaleString('fr-FR', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>
                  {e.note && <p className="text-sm">{e.note}</p>}
                  {e.media.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-2">
                      {e.media.map((m, i) =>
                        m.url ? (
                          <img
                            key={i}
                            src={m.url}
                            alt=""
                            className="h-16 w-16 rounded-lg border border-border object-cover"
                          />
                        ) : null,
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {next && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Passer au statut suivant : {MISSION_STATUS_LABEL[next]}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {!mission.wholesalerProfile && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="shopSlug">Lien vers la boutique (optionnel)</Label>
                <Input
                  id="shopSlug"
                  placeholder="slug-de-la-boutique"
                  value={shopSlug}
                  onChange={(e) => setShopSlug(e.target.value)}
                />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="note">Note (optionnel)</Label>
              <Textarea id="note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Preuves photo (jusqu&apos;à {MISSION_STATUS_EVENT_MAX_MEDIA})</Label>
              <div className="flex flex-wrap gap-2">
                {images.map((img) => (
                  <div key={img.id} className="relative">
                    <img
                      src={img.url}
                      alt=""
                      className="h-20 w-20 rounded-lg border border-border object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(img.id)}
                      className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-destructive text-xs text-white"
                      aria-label="Retirer la photo"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              {images.length < MISSION_STATUS_EVENT_MAX_MEDIA && (
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  disabled={uploading}
                  onChange={(e) => void onFilesSelected(e.target.files)}
                />
              )}
            </div>
            <Button
              disabled={advancing || uploading}
              onClick={() => void onAdvance()}
              className="w-fit"
            >
              {advancing ? 'Mise à jour…' : `Passer à « ${MISSION_STATUS_LABEL[next]} »`}
            </Button>
          </CardContent>
        </Card>
      )}

      {!next && !terminal && (
        <Card>
          <CardContent className="py-4 text-sm text-muted-foreground">
            En attente de confirmation de réception par l&apos;acheteur.
          </CardContent>
        </Card>
      )}

      {terminal && (
        <Card>
          <CardContent className="py-4 text-sm text-muted-foreground">
            Mission clôturée — {MISSION_STATUS_LABEL[mission.status]}.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
