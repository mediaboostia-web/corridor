// Split-screen auth shell (login/signup/forgot-password/reset-password/
// verify-email all render through this layout). Left: white panel, logo +
// the page's own Card form. Right (desktop only): a bold single-accent brand
// panel reusing the same mission-tracker mockup as the homepage hero, so the
// brand feels like one system rather than one-off pages. No stock photography
// (design_systeme.md explicitly bans generic market-seller stock photos) and
// no fake/invented product screenshot — the tracker mirrors the real feature
// at /agent/mes-missions/[id] and /buyer/mes-commandes/[id].
import {
  ShieldCheckIcon,
  MapPinIcon,
  PackageCheckIcon,
  CheckCircle2Icon,
  CircleIcon,
} from 'lucide-react';
import { Logo } from '@/components/logo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const TRUST_POINTS = [
  { icon: ShieldCheckIcon, label: 'Vérifié' },
  { icon: MapPinIcon, label: 'Terrain' },
  { icon: PackageCheckIcon, label: 'Suivi' },
];

const TRACKER_STEPS = [
  { label: 'Reçu', done: true },
  { label: 'En achat', done: true, current: true },
  { label: 'Acheté', done: false },
  { label: 'Expédié', done: false },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-[100dvh] lg:grid-cols-2">
      <div className="flex flex-col gap-10 px-4 py-10 sm:px-10 sm:py-12">
        <Logo />
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>

      <div className="relative hidden flex-col justify-center gap-10 overflow-hidden bg-primary px-14 py-12 text-primary-foreground lg:flex">
        <div className="flex flex-col gap-4">
          <Badge
            variant="outline"
            className="w-fit border-primary-foreground/30 text-primary-foreground"
          >
            Corridor Bénin → CEMAC
          </Badge>
          <h2 className="max-w-sm text-3xl leading-[1.15] font-semibold tracking-tight">
            Un agent vérifié s&apos;occupe de tout, du premier contact à la livraison.
          </h2>
          <p className="max-w-xs text-sm text-primary-foreground/75">
            Pas d&apos;escrow, pas de fintech. Juste une vérification humaine, à chaque étape.
          </p>
        </div>

        <div className="flex items-center gap-6">
          {TRUST_POINTS.map((t) => (
            <div key={t.label} className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-full bg-primary-foreground/10">
                <t.icon className="size-4" />
              </span>
              <span className="text-sm text-primary-foreground/85">{t.label}</span>
            </div>
          ))}
        </div>

        <Card className="w-full max-w-xs -rotate-2 gap-0 self-start shadow-[var(--shadow-float)]">
          <CardHeader className="flex-row items-center justify-between border-b border-border pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Suivi en direct
            </CardTitle>
            <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
              En cours
            </span>
          </CardHeader>
          <CardContent className="pt-4">
            <ol className="flex flex-col gap-3">
              {TRACKER_STEPS.map((s, i) => (
                <li key={s.label} className="flex items-center gap-3">
                  {s.done ? (
                    <CheckCircle2Icon
                      className={cn(
                        'size-4 shrink-0',
                        s.current ? 'text-primary' : 'text-foreground/70',
                      )}
                    />
                  ) : (
                    <CircleIcon className="size-4 shrink-0 text-muted-foreground/40" />
                  )}
                  <span
                    className={cn(
                      'text-sm',
                      s.current
                        ? 'font-semibold text-primary'
                        : s.done
                          ? 'text-foreground'
                          : 'text-muted-foreground',
                    )}
                  >
                    {s.label}
                  </span>
                  {i < TRACKER_STEPS.length - 1 && (
                    <span className="h-px flex-1 bg-border" aria-hidden="true" />
                  )}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
