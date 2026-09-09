// Shared brand mark: an icon badge (Waypoints — a path with stops, evoking
// the Cotonou → CEMAC sourcing corridor) + wordmark. One definition reused
// across the homepage navbar, the (auth) split-screen panel, and the
// footer so the brand reads as one system rather than a plain text label
// repeated in slightly different markup each time.
import Link from 'next/link';
import { WaypointsIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Logo({ className, href = '/' }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn('flex items-center gap-2', className)}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <WaypointsIcon className="size-4.5" />
      </span>
      <span className="text-base font-semibold tracking-tight text-foreground">
        Corridor <span className="text-primary">Sourcing</span>
      </span>
    </Link>
  );
}
