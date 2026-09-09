'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { uploadImage } from '@/lib/upload';
import { PRODUCT_CATEGORIES, PRODUCT_MAX_MEDIA } from '@/lib/marketplace';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface UploadedImage {
  id: string;
  url: string;
}

export default function NouveauProduitPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>('');
  const [description, setDescription] = useState('');
  const [priceAmount, setPriceAmount] = useState('');
  const [minQuantity, setMinQuantity] = useState('1');
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<'draft' | 'publish' | null>(null);

  async function onFilesSelected(files: FileList | null) {
    if (!files || !files.length) return;
    const remaining = PRODUCT_MAX_MEDIA - images.length;
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

  async function createProduct(): Promise<{ id: string }> {
    const res = await api<{ product: { id: string } }>('/api/wholesaler/products', {
      method: 'POST',
      body: {
        name,
        category,
        description,
        priceAmount: Math.round(Number(priceAmount)),
        minQuantity: Math.round(Number(minQuantity)),
        mediaFileUploadIds: images.map((img) => img.id),
      },
    });
    return res.product;
  }

  async function onSaveDraft(e: FormEvent) {
    e.preventDefault();
    setSubmitting('draft');
    setError(null);
    try {
      await createProduct();
      router.push('/wholesaler/catalogue');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setSubmitting(null);
    }
  }

  async function onSubmitForReview(e: FormEvent) {
    e.preventDefault();
    if (images.length === 0) {
      setError('Ajoute au moins une photo avant de soumettre le produit.');
      return;
    }
    setSubmitting('publish');
    setError(null);
    try {
      const product = await createProduct();
      await api(`/api/wholesaler/products/${product.id}/submit`, { method: 'POST' });
      router.push('/wholesaler/catalogue');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setSubmitting(null);
    }
  }

  const busy = submitting !== null || uploading;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Ajouter un produit</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détails du produit</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Nom du produit</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category">Catégorie</Label>
              <Select value={category} onValueChange={(v) => setCategory(v ?? '')}>
                <SelectTrigger id="category" className="w-full">
                  <SelectValue placeholder="Choisir une catégorie" />
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
                required
                rows={4}
                minLength={10}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="priceAmount">Prix (FCFA)</Label>
                <Input
                  id="priceAmount"
                  type="number"
                  required
                  min={1}
                  value={priceAmount}
                  onChange={(e) => setPriceAmount(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="minQuantity">Quantité minimum</Label>
                <Input
                  id="minQuantity"
                  type="number"
                  required
                  min={1}
                  value={minQuantity}
                  onChange={(e) => setMinQuantity(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="images">Photos (jusqu&apos;à {PRODUCT_MAX_MEDIA})</Label>
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
              {images.length < PRODUCT_MAX_MEDIA && (
                <Input
                  id="images"
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

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={busy || !name || !category || !description || !priceAmount}
                onClick={onSaveDraft}
              >
                {submitting === 'draft' ? 'Enregistrement…' : 'Enregistrer comme brouillon'}
              </Button>
              <Button
                type="button"
                disabled={busy || !name || !category || !description || !priceAmount}
                onClick={onSubmitForReview}
              >
                {submitting === 'publish' ? 'Envoi…' : 'Soumettre pour publication'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
