'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const SHORTCUTS = [
  {
    href: '/agent/demandes-ouvertes',
    title: 'Demandes ouvertes',
    description: 'Parcourir les demandes de sourcing à pourvoir',
  },
  {
    href: '/agent/mes-missions',
    title: 'Mes missions',
    description: 'Suivre et faire avancer tes missions acceptées',
  },
  {
    href: '/agent/verification',
    title: 'Vérification',
    description: 'Vérifier ton identité pour pouvoir candidater',
  },
  {
    href: '/agent/profil-public',
    title: 'Mon profil public',
    description: 'Modifier ta bio et voir tes statistiques',
  },
];

export default function AgentDashboardPage() {
  const { user } = useAuth();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Bienvenue{user ? `, ${user.name ?? user.email}` : ''}
        </h1>
        <p className="text-muted-foreground">
          Retrouve tes demandes ouvertes et tes missions ci-dessous.
        </p>
      </div>

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
