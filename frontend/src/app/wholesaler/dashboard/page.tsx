'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const SHORTCUTS = [
  { href: '/wholesaler/catalogue', title: 'Catalogue', description: 'Gérer tes produits' },
  { href: '/wholesaler/boutique', title: 'Ma boutique', description: 'Modifier ta page publique' },
  {
    href: '/wholesaler/commandes',
    title: 'Commandes',
    description: 'Missions sourcées depuis ta boutique',
  },
  { href: '/wholesaler/lives', title: 'Lives', description: 'Annoncer un live' },
];

export default function WholesalerDashboardPage() {
  const { user } = useAuth();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Bienvenue{user ? `, ${user.name ?? user.email}` : ''}
        </h1>
        <p className="text-muted-foreground">
          Retrouve ton catalogue, ta boutique et tes commandes ci-dessous.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
