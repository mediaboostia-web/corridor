import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Page introuvable</h1>
      <p className="text-sm text-muted-foreground">
        Cette page n&apos;existe pas ou plus. Vérifie le lien, ou repars de l&apos;accueil.
      </p>
      <Link href="/" className={cn(buttonVariants())}>
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}
