'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { uploadImage } from '@/lib/upload';
import { SOURCING_REQUEST_MAX_MEDIA } from '@/lib/marketplace';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface UploadedImage {
  id: string;
  url: string;
}

interface LinkedProduct {
  id: string;
  name: string;
  wholesaler: { shopName: string };
  media: { url: string | null }[];
}

function DemanderUnSourcingForm() {
  const router = useRouter();
  const params = useSearchParams();
  const productId = params.get('productId');

  const [linkedProduct, setLinkedProduct] = useState<LinkedProduct | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tiktokLink, setTiktokLink] = useState('');
  const [facebookLink, setFacebookLink] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [quantity, setQuantity] = useState('');
  const [deliveryCountry, setDeliveryCountry] = useState('');
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tooMany, setTooMany] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api<{ profile: { deliveryCountry: string | null } }>(
          '/api/buyer/profile',
        );
        if (res.profile.deliveryCountry) setDeliveryCountry(res.profile.deliveryCountry);
      } catch {
        // Non-blocking — the field is still editable if the profile fetch fails.
      }
    })();
  }, []);

  useEffect(() => {
    if (!productId) return;
    void (async () => {
      try {
        const res = await api<{ product: LinkedProduct }>(`/api/buyer/products/${productId}`);
        setLinkedProduct(res.product);
        setTitle((t) => t || `Sourcing : ${res.product.name}`);
        setDescription((d) => d || `Je souhaite commander : ${res.product.name}.`);
      } catch {
        // Product may have been unpublished since the feed loaded — the
        // form still works as a free-form request.
      }
    })();
  }, [productId]);

  async function onFilesSelected(files: FileList | null) {
    if (!files || !files.length) return;
    const remaining = SOURCING_REQUEST_MAX_MEDIA - images.length;
    const toUpload = Array.from(files).slice(0, remaining);
    setUploading(true);
    setError(null);
    try {
      for (const file of toUpload) {
        const uploaded = await uploadImage(file);
        setImages((prev) => [...prev, { id: uploaded.id, url: uploaded.url }]);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Échec de l'envoi d'une image.");
    } finally {
      setUploading(false);
    }
  }

  function removeImage(id: string) {
    setImages((prev) => prev.filter((img) => img.id !== id));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setTooMany(false);
    try {
      const res = await api<{ request: { id: string } }>('/api/buyer/sourcing-requests', {
        method: 'POST',
        body: {
          title,
          description,
          productId: linkedProduct?.id ?? null,
          tiktokLink: tiktokLink || null,
          facebookLink: facebookLink || null,
          budgetAmount: budgetAmount ? Math.round(Number(budgetAmount)) : null,
          quantity: quantity ? Math.round(Number(quantity)) : null,
          deliveryCountry,
          mediaFileUploadIds: images.map((img) => img.id),
        },
      });
      router.push(`/buyer/mes-demandes/${res.request.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'TOO_MANY_ACTIVE_REQUESTS') {
        setTooMany(true);
        setError(err.message);
      } else {
        setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Demander un sourcing</h1>

      {linkedProduct && (
        <Card>
          <CardContent className="flex items-center gap-3 py-3">
            <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
              {linkedProduct.media[0]?.url && (
                <img src={linkedProduct.media[0].url} alt="" className="size-full object-cover" />
              )}
            </div>
            <p className="text-sm">
              Basé sur <span className="font-medium">{linkedProduct.name}</span> —{' '}
              {linkedProduct.wholesaler.shopName}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détails de la demande</CardTitle>
          <CardDescription>
            Décris ce que tu veux — les agents vérifiés pourront candidater pour s&apos;en occuper.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title">Titre</Label>
              <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                required
                rows={4}
                minLength={10}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tiktokLink">Lien TikTok (optionnel)</Label>
                <Input
                  id="tiktokLink"
                  type="url"
                  value={tiktokLink}
                  onChange={(e) => setTiktokLink(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="facebookLink">Lien Facebook (optionnel)</Label>
                <Input
                  id="facebookLink"
                  type="url"
                  value={facebookLink}
                  onChange={(e) => setFacebookLink(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="budgetAmount">Budget (FCFA)</Label>
                <Input
                  id="budgetAmount"
                  type="number"
                  min={1}
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="quantity">Quantité</Label>
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="deliveryCountry">Pays de livraison</Label>
                <Input
                  id="deliveryCountry"
                  required
                  value={deliveryCountry}
                  onChange={(e) => setDeliveryCountry(e.target.value)}
                  placeholder="Gabon"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Images de référence (jusqu&apos;à {SOURCING_REQUEST_MAX_MEDIA})</Label>
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
              {images.length < SOURCING_REQUEST_MAX_MEDIA && (
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  disabled={uploading}
                  onChange={(e) => void onFilesSelected(e.target.files)}
                />
              )}
            </div>

            {error && (
              <div role="alert" className="text-sm text-destructive">
                {error}
                {tooMany && (
                  <>
                    {' '}
                    <Link href="/buyer/mes-demandes" className="underline">
                      Voir mes demandes
                    </Link>
                  </>
                )}
              </div>
            )}

            <Button type="submit" disabled={submitting || uploading} className="w-fit">
              {submitting ? 'Publication…' : 'Publier la demande'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function DemanderUnSourcingPage() {
  return (
    <Suspense fallback={null}>
      <DemanderUnSourcingForm />
    </Suspense>
  );
}
