'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

// Secondary shortcuts — "Demander un sourcing" gets its own hero CTA below
// instead of being just one card among equals (product decision: le besoin
// le plus fréquent est "je sais ce que je veux, trouve-le-moi", pas la
// découverte par catalogue — cf. analyse repriorisation MVP).
const SHORTCUTS = [
  {
    href: '/buyer/mes-demandes',
    title: 'Mes demandes',
    description: 'Suivre tes demandes en cours',
  },
  {
    href: '/buyer/mes-commandes',
    title: 'Mes commandes',
    description: 'Suivre tes missions acceptées',
  },
  {
    href: '/buyer/catalogue',
    title: 'Catalogue',
    description: "Pas d'idée précise ? Parcourir les produits des grossistes pour t'inspirer",
  },
  { href: '/buyer/lives', title: 'Lives', description: 'Voir les lives à venir' },
];

export default function BuyerHomePage() {
  const { user } = useAuth();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Bienvenue{user ? `, ${user.name ?? user.email}` : ''}
        </h1>
        <p className="text-muted-foreground">Dis-nous ce que tu cherches, un agent s'en occupe.</p>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg">Tu sais ce que tu veux ?</CardTitle>
          <CardDescription>
            Décris ta demande — un agent vérifié la trouve et te la ramène, où qu'elle soit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/buyer/demander-un-sourcing">
            <Button size="lg">Demander un sourcing</Button>
          </Link>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SHORTCUTS.map((s) => (
          <Link key={s.href} href={s.href}>
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardTitle className="text-base">{s.title}</CardTitle>
                <CardDescription>{s.description}</CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
