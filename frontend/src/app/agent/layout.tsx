import { RoleGuard } from '@/components/role-guard';
import { RoleShell } from '@/components/role-shell';

const NAV = [
  { href: '/agent/dashboard', label: 'Tableau de bord' },
  { href: '/agent/demandes-ouvertes', label: 'Demandes ouvertes' },
  { href: '/agent/mes-missions', label: 'Mes missions' },
  { href: '/agent/messagerie', label: 'Messagerie' },
  { href: '/agent/verification', label: 'Vérification' },
  { href: '/agent/notifications', label: 'Notifications' },
  { href: '/agent/profil-public', label: 'Mon profil' },
  { href: '/agent/profil-parametres', label: 'Profil & paramètres' },
];

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard role="AGENT">
      <RoleShell nav={NAV}>{children}</RoleShell>
    </RoleGuard>
  );
}
