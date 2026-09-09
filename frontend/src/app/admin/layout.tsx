'use client';

// Wraps every /admin/* route in a check against GET /api/admin/me (real
// server-side role check, not a client-side guess) — mirrors the starter's
// examples/frontend-pages/admin/layout.tsx pattern. Redirects non-admins to /.
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface AdminMe {
  admin: { id: string; email: string; role: 'ADMIN' | 'SUPERADMIN' };
}

const NAV = [
  { href: '/admin/dashboard', label: 'Tableau de bord' },
  { href: '/admin/produits', label: 'Modération produits' },
  { href: '/admin/verifications-agents', label: 'Vérification agents' },
  { href: '/admin/utilisateurs', label: 'Utilisateurs' },
  { href: '/admin/abonnements', label: 'Abonnements' },
  { href: '/admin/notifications', label: 'Notifications' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [admin, setAdmin] = useState<AdminMe['admin'] | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await api<AdminMe>('/api/admin/me');
        if (!cancelled) setAdmin(res.admin);
      } catch {
        if (!cancelled) router.replace('/');
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!checked || !admin) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center text-sm text-muted-foreground">
        Vérification des accès…
      </main>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="flex h-16 items-center justify-between border-b border-border px-4 sm:px-6">
        <Link href="/admin" className="text-base font-semibold tracking-tight">
          Corridor <span className="text-primary">Admin</span>
        </Link>
        <span className="text-sm text-muted-foreground">
          {admin.email} · {admin.role}
        </span>
      </header>
      <nav className="flex gap-1 overflow-x-auto border-b border-border px-4 sm:px-6">
        {NAV.map((item) => {
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
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
