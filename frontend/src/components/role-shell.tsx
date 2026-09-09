'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BellIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const NOTIF_POLL_MS = 30_000;

function NotificationBell({ role }: { role: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await api<{ count: number }>('/api/notifications/count');
        if (!cancelled) setCount(res.count);
      } catch {
        // Best-effort — a stale badge count isn't worth surfacing an error for.
      }
    }
    void poll();
    const id = window.setInterval(poll, NOTIF_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return (
    <Link
      href={`/${role.toLowerCase()}/notifications`}
      className="relative inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
      aria-label="Notifications"
    >
      <BellIcon className="size-4" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  );
}

const ROLE_LABEL: Record<string, string> = {
  BUYER: 'Acheteur',
  AGENT: 'Agent sourcing',
  WHOLESALER: 'Grossiste',
};

export interface RoleNavItem {
  href: string;
  label: string;
}

/**
 * Authenticated shell shared by the buyer/agent/wholesaler route groups:
 * brand + role badge + logout, plus an optional per-role nav strip. Each
 * layout passes only the menu items that actually have a page behind them
 * (Phases 1+) — no dead links here.
 */
export function RoleShell({ children, nav }: { children: React.ReactNode; nav?: RoleNavItem[] }) {
  const { user, logout, loggingOut } = useAuth();
  const pathname = usePathname();

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="flex h-16 items-center justify-between border-b border-border px-4 sm:px-6">
        <Link href="/" className="text-base font-semibold tracking-tight">
          Corridor <span className="text-primary">Sourcing</span>
        </Link>
        <div className="flex items-center gap-3">
          {user?.marketplaceRole && (
            <>
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {ROLE_LABEL[user.marketplaceRole]}
              </span>
              <NotificationBell role={user.marketplaceRole} />
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => void logout()} disabled={loggingOut}>
            {loggingOut ? 'Déconnexion…' : 'Se déconnecter'}
          </Button>
        </div>
      </header>
      {nav && nav.length > 0 && (
        <nav className="flex gap-1 overflow-x-auto border-b border-border px-4 sm:px-6">
          {nav.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
