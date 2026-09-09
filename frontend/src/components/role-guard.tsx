'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { roleHomePath, type MarketplaceRole } from '@/lib/marketplace';

/**
 * Client-side route-group guard for the (buyer)/(agent)/(wholesaler) layouts.
 * Redirects: no session -> /login, no role chosen yet -> onboarding,
 * wrong role -> that role's own home. Renders nothing while loading/redirecting
 * so the guarded page never flashes for the wrong audience.
 */
export function RoleGuard({
  role,
  children,
}: {
  role: MarketplaceRole;
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (!user.marketplaceRole) {
      router.replace('/onboarding/choisir-role');
      return;
    }
    if (user.marketplaceRole !== role) {
      router.replace(roleHomePath(user.marketplaceRole));
    }
  }, [user, loading, role, router]);

  if (loading || !user || user.marketplaceRole !== role) return null;
  return <>{children}</>;
}
