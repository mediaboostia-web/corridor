'use client';

// /wholesaler/profil-abonnement — Phase 7. Account-level hub: links out to
// the shop editor (/wholesaler/boutique, Phase 1) and to account security
// (/settings, izikit starter), plus the Pro subscription section this
// phase adds. Deliberately doesn't duplicate either of those forms.
import Link from 'next/link';
import { SubscriptionStatusCard } from '@/components/subscriptions/subscription-status-card';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';

export default function WholesalerProfilAbonnementPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Profil & abonnement</h1>

      <SubscriptionStatusCard />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ma boutique</CardTitle>
          <CardDescription>
            Nom, description, horaires — visible sur ta page publique.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/wholesaler/boutique"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            Modifier ma boutique
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compte & sécurité</CardTitle>
          <CardDescription>Mot de passe, connexion Google.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/settings" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Gérer mon compte
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
