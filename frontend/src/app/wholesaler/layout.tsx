import { RoleGuard } from '@/components/role-guard';
import { RoleShell } from '@/components/role-shell';

const NAV = [
  { href: '/wholesaler/dashboard', label: 'Tableau de bord' },
  { href: '/wholesaler/catalogue', label: 'Catalogue' },
  { href: '/wholesaler/boutique', label: 'Ma boutique' },
  { href: '/wholesaler/commandes', label: 'Commandes' },
  { href: '/wholesaler/lives', label: 'Lives' },
  { href: '/wholesaler/messagerie', label: 'Messagerie' },
  { href: '/wholesaler/notifications', label: 'Notifications' },
  { href: '/wholesaler/profil-abonnement', label: 'Profil & abonnement' },
];

export default function WholesalerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard role="WHOLESALER">
      <RoleShell nav={NAV}>{children}</RoleShell>
    </RoleGuard>
  );
}
