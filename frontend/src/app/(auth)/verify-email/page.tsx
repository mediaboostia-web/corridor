'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { MailIcon, KeyRoundIcon } from 'lucide-react';
import { api, ApiError, storeCsrfToken } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { IconInput } from '../_components/icon-input';

function VerifyEmailForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useAuth();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [code, setCode] = useState(params.get('code') ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    const qEmail = params.get('email');
    const qCode = params.get('code');
    if (qEmail && qCode) {
      void verify(qEmail, qCode);
    }
    // Intentionally runs once on mount to auto-submit the emailed link's params.
  }, []);

  async function verify(emailValue: string, codeValue: string) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api<{ csrfToken?: string }>('/api/auth/verify-email', {
        method: 'POST',
        body: { email: emailValue, code: codeValue },
      });
      if (res.csrfToken) storeCsrfToken(res.csrfToken);
      await refresh();
      router.push('/onboarding/choisir-role');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setSubmitting(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void verify(email, code);
  }

  async function resend() {
    if (!email) {
      setResendMessage('Entre ton email d’abord.');
      return;
    }
    setResending(true);
    setResendMessage(null);
    setError(null);
    try {
      await api('/api/auth/resend-verification', { method: 'POST', body: { email } });
      setResendMessage('Si un compte existe pour cet email, un nouveau code vient d’être envoyé.');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'TOO_MANY_RESEND_ATTEMPTS') {
        setResendMessage('Trop de demandes. Réessaie dans quelques minutes.');
      } else {
        setResendMessage(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
      }
    } finally {
      setResending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Vérifie ton email</CardTitle>
        <CardDescription>
          Un code à 8 caractères t&apos;a été envoyé par email. Il expire dans 15 minutes.
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="code">Code de vérification</Label>
            <IconInput
              icon={KeyRoundIcon}
              id="code"
              type="text"
              required
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={8}
              className="font-mono tracking-widest uppercase"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? 'Vérification…' : 'Vérifier'}
          </Button>
        </form>
        {resendMessage && (
          <p role="status" className="text-center text-sm text-muted-foreground">
            {resendMessage}
          </p>
        )}
        <p className="text-center text-sm text-muted-foreground">
          Pas reçu de code ?{' '}
          <button
            type="button"
            onClick={() => void resend()}
            disabled={resending}
            className="text-foreground underline disabled:opacity-50"
          >
            {resending ? 'Envoi…' : 'Renvoyer le code'}
          </button>
        </p>
        <p className="text-center text-sm text-muted-foreground">
          Mauvaise adresse ?{' '}
          <Link href="/signup" className="text-foreground underline">
            Recommence l&apos;inscription
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailForm />
    </Suspense>
  );
}
