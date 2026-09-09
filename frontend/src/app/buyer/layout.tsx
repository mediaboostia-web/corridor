import { RoleGuard } from '@/components/role-guard';
import { RoleShell } from '@/components/role-shell';

const NAV = [
  { href: '/buyer', label: 'Accueil' },
  { href: '/buyer/demander-un-sourcing', label: 'Demander un sourcing' },
  { href: '/buyer/catalogue', label: 'Catalogue' },
  { href: '/buyer/mes-demandes', label: 'Mes demandes' },
  { href: '/buyer/mes-commandes', label: 'Mes commandes' },
  { href: '/buyer/lives', label: 'Lives' },
  { href: '/buyer/messagerie', label: 'Messagerie' },
  { href: '/buyer/notifications', label: 'Notifications' },
  { href: '/buyer/profil', label: 'Profil' },
];

export default function BuyerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard role="BUYER">
      <RoleShell nav={NAV}>{children}</RoleShell>
    </RoleGuard>
  );
}
