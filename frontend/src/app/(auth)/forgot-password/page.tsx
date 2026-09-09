'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { MailIcon } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { IconInput } from '../_components/icon-input';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api('/api/auth/forgot-password', { method: 'POST', body: { email } });
      setSubmitted(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'TOO_MANY_RESET_REQUESTS') {
        setError('Trop de demandes pour cet email. Réessaie dans une heure.');
      } else {
        setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Vérifie ta boîte mail</CardTitle>
          <CardDescription>
            Si un compte existe pour <strong className="text-foreground">{email}</strong>, tu
            recevras un code de réinitialisation dans la minute.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/reset-password" className="text-sm text-foreground underline">
            Tu as déjà ton code ?
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Mot de passe oublié ?</CardTitle>
        <CardDescription>
          Entre ton email, on t&apos;envoie un code pour réinitialiser ton mot de passe.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <IconInput
              icon={MailIcon}
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? 'Envoi…' : 'Envoyer le code'}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          Tu t&apos;en souviens ?{' '}
          <Link href="/login" className="text-foreground underline">
            Se connecter
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
