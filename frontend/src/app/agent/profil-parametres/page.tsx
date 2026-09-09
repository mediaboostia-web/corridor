'use client';

// /agent/profil-parametres — Phase 7. Account-level hub: links out to the
// business-profile editor (/agent/profil-public, Phase 3) and to account
// security (/settings, izikit starter), plus the Pro subscription section
// this phase adds. Deliberately doesn't duplicate either of those forms.
import Link from 'next/link';
import { SubscriptionStatusCard } from '@/components/subscriptions/subscription-status-card';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';

export default function AgentProfilParametresPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Profil & paramètres</h1>

      <SubscriptionStatusCard />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profil public</CardTitle>
          <CardDescription>
            Nom, bio, zone d&apos;action — visible sur ta page publique.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/agent/profil-public"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            Modifier mon profil public
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
