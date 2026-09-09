'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { uploadImage } from '@/lib/upload';
import { PRODUCT_CATEGORIES, PRODUCT_MAX_MEDIA } from '@/lib/marketplace';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ProductImage {
  id: string;
  url: string | null;
}

interface ProductDetail {
  id: string;
  name: string;
  category: string;
  description: string;
  priceAmount: number;
  minQuantity: number;
  status: 'DRAFT' | 'PENDING' | 'PUBLISHED';
  rejectionReason: string | null;
  media: ProductImage[];
}

export default function ModifierProduitPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api<{ product: ProductDetail }>(`/api/wholesaler/products/${params.id}`);
        setProduct(res.product);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id]);

  async function onFilesSelected(files: FileList | null) {
    if (!files || !files.length || !product) return;
    const remaining = PRODUCT_MAX_MEDIA - product.media.length;
    const toUpload = Array.from(files).slice(0, remaining);
    setUploading(true);
    setError(null);
    try {
      for (const file of toUpload) {
        const uploaded = await uploadImage(file);
        setProduct((prev) =>
          prev ? { ...prev, media: [...prev.media, { id: uploaded.id, url: uploaded.url }] } : prev,
        );
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Échec de l'envoi d'une image.");
    } finally {
      setUploading(false);
    }
  }

  function removeImage(id: string) {
    setProduct((prev) => (prev ? { ...prev, media: prev.media.filter((m) => m.id !== id) } : prev));
  }

  async function onSave() {
    if (!product) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await api<{ product: ProductDetail }>(`/api/wholesaler/products/${product.id}`, {
        method: 'PATCH',
        body: {
          name: product.name,
          category: product.category,
          description: product.description,
          priceAmount: product.priceAmount,
          minQuantity: product.minQuantity,
          mediaFileUploadIds: product.media.map((m) => m.id),
        },
      });
      setProduct(res.product);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setSaving(false);
    }
  }

  async function onSubmitForReview() {
    if (!product) return;
    if (product.media.length === 0) {
      setError('Ajoute au moins une photo avant de soumettre le produit.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave();
      await api(`/api/wholesaler/products/${product.id}/submit`, { method: 'POST' });
      router.push('/wholesaler/catalogue');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (!product)
    return <p className="text-sm text-destructive">{error ?? 'Produit introuvable.'}</p>;

  const busy = saving || uploading;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Modifier le produit</h1>
        <Badge variant="outline">{product.status}</Badge>
      </div>

      {product.status === 'DRAFT' && product.rejectionReason && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          Refusé par la modération : {product.rejectionReason}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détails du produit</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Nom du produit</Label>
              <Input
                id="name"
                value={product.name}
                onChange={(e) => setProduct({ ...product, name: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category">Catégorie</Label>
              <Select
                value={product.category}
                onValueChange={(v) => setProduct({ ...product, category: v ?? product.category })}
              >
                <SelectTrigger id="category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={4}
                value={product.description}
                onChange={(e) => setProduct({ ...product, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="priceAmount">Prix (FCFA)</Label>
                <Input
                  id="priceAmount"
                  type="number"
                  min={1}
                  value={product.priceAmount}
                  onChange={(e) => setProduct({ ...product, priceAmount: Number(e.target.value) })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="minQuantity">Quantité minimum</Label>
                <Input
                  id="minQuantity"
                  type="number"
                  min={1}
                  value={product.minQuantity}
                  onChange={(e) => setProduct({ ...product, minQuantity: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Photos (jusqu&apos;à {PRODUCT_MAX_MEDIA})</Label>
              <div className="flex flex-wrap gap-2">
                {product.media.map((img) => (
                  <div key={img.id} className="relative">
                    {img.url && (
                      <img
                        src={img.url}
                        alt=""
                        className="h-20 w-20 rounded-lg border border-border object-cover"
                      />
                    )}
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
              {product.media.length < PRODUCT_MAX_MEDIA && (
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
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            {saved && <p className="text-sm text-primary">Produit mis à jour.</p>}

            <div className="flex gap-3">
              <Button variant="outline" disabled={busy} onClick={() => void onSave()}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
              {product.status === 'DRAFT' && (
                <Button disabled={busy} onClick={() => void onSubmitForReview()}>
                  Soumettre pour publication
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
