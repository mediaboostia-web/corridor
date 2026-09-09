'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { uploadImage } from '@/lib/upload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

type VerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED' | 'REVOKED';

interface Verification {
  verificationStatus: VerificationStatus;
  actionZone: string | null;
  idFrontUrl: string | null;
  idBackUrl: string | null;
  selfieUrl: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
}

const STATUS_LABEL: Record<VerificationStatus, string> = {
  UNVERIFIED: 'Non vérifié',
  PENDING: 'En attente de revue',
  VERIFIED: 'Vérifié',
  REJECTED: 'Refusé',
  REVOKED: 'Révoqué',
};

interface UploadSlot {
  id: string | null;
  url: string | null;
  uploading: boolean;
}

function EMPTY_SLOT(): UploadSlot {
  return { id: null, url: null, uploading: false };
}

export default function AgentVerificationPage() {
  const [verification, setVerification] = useState<Verification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionZone, setActionZone] = useState('');
  const [idFront, setIdFront] = useState<UploadSlot>(EMPTY_SLOT());
  const [idBack, setIdBack] = useState<UploadSlot>(EMPTY_SLOT());
  const [selfie, setSelfie] = useState<UploadSlot>(EMPTY_SLOT());
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<{ verification: Verification }>('/api/agent/verification');
      setVerification(res.verification);
      setActionZone(res.verification.actionZone ?? '');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onPick(
    file: File | undefined,
    setSlot: (slot: UploadSlot) => void,
  ): Promise<void> {
    if (!file) return;
    setSlot({ id: null, url: null, uploading: true });
    setError(null);
    try {
      const uploaded = await uploadImage(file);
      setSlot({ id: uploaded.id, url: uploaded.url, uploading: false });
    } catch (err) {
      setSlot(EMPTY_SLOT());
      setError(err instanceof ApiError ? err.message : "Échec de l'envoi de la photo.");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!idFront.id || !idBack.id || !selfie.id) {
      setError('Ajoute les 3 photos (pièce recto, verso, selfie) avant de soumettre.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await api<{ verification: Verification }>('/api/agent/verification', {
        method: 'POST',
        body: {
          actionZone,
          idFrontUploadId: idFront.id,
          idBackUploadId: idBack.id,
          selfieUploadId: selfie.id,
        },
      });
      setVerification(res.verification);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (!verification)
    return <p className="text-sm text-destructive">{error ?? 'Profil introuvable.'}</p>;

  const canSubmit =
    verification.verificationStatus === 'UNVERIFIED' ||
    verification.verificationStatus === 'REJECTED';
  const busy = submitting || idFront.uploading || idBack.uploading || selfie.uploading;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Vérification d&apos;identité</h1>
        <Badge variant={verification.verificationStatus === 'VERIFIED' ? 'default' : 'secondary'}>
          {STATUS_LABEL[verification.verificationStatus]}
        </Badge>
      </div>

      {verification.verificationStatus === 'REJECTED' && verification.rejectionReason && (
        <Card>
          <CardContent className="py-4 text-sm text-destructive">
            Motif du refus : {verification.rejectionReason}
          </CardContent>
        </Card>
      )}

      {verification.verificationStatus === 'PENDING' && (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Ta demande de vérification est en cours de revue par l&apos;équipe Corridor. Tu seras
            notifié dès qu&apos;une décision est prise.
          </CardContent>
        </Card>
      )}

      {verification.verificationStatus === 'VERIFIED' && (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Ton identité est vérifiée. Tu peux candidater aux demandes de sourcing ouvertes.
          </CardContent>
        </Card>
      )}

      {canSubmit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Soumettre ma vérification</CardTitle>
            <CardDescription>
              Zone d&apos;action + une pièce d&apos;identité (recto/verso) et un selfie.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="actionZone">Zone d&apos;action</Label>
                <Input
                  id="actionZone"
                  required
                  value={actionZone}
                  onChange={(e) => setActionZone(e.target.value)}
                  placeholder="Dantokpa, Missèbo…"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <UploadField
                  label="Pièce d'identité (recto)"
                  slot={idFront}
                  onChange={(f) => void onPick(f, setIdFront)}
                />
                <UploadField
                  label="Pièce d'identité (verso)"
                  slot={idBack}
                  onChange={(f) => void onPick(f, setIdBack)}
                />
                <UploadField
                  label="Selfie"
                  slot={selfie}
                  onChange={(f) => void onPick(f, setSelfie)}
                />
              </div>

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button type="submit" disabled={busy} className="w-fit">
                {submitting ? 'Envoi…' : 'Soumettre pour vérification'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function UploadField({
  label,
  slot,
  onChange,
}: {
  label: string;
  slot: UploadSlot;
  onChange: (file: File | undefined) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {slot.url ? (
        <img
          src={slot.url}
          alt=""
          className="h-24 w-full rounded-lg border border-border object-cover"
        />
      ) : (
        <Input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={slot.uploading}
          onChange={(e) => onChange(e.target.files?.[0])}
        />
      )}
    </div>
  );
}
