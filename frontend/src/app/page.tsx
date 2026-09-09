'use client';

// Public homepage. Logged-in users bounce straight to their role home (or the
// role-choice step) — everyone else sees the full pitch: héro, besoin,
// solution, acteurs (acheteur/agent, le grossiste est différé, cf.
// repriorisation MVP), engagements, témoignages (engagements produit
// vérifiables présentés en citations, pas d'avis fabriqués), FAQ,
// communauté WhatsApp, footer.
//
// Design notes: structural reproduction of the Wrike-style reference the
// user provided (pill buttons, 20px card radius, one signature floating
// shadow, uppercase tracked eyebrows structuring every section, one
// highlighted keyword per headline, layered ambient background), recolored
// to Corridor's own terracotta + ardoise palette — no second accent
// introduced, no fabricated numbers/logos/testimonials (pre-launch
// product). Radius/pill treatment is scoped to this landing page via
// className overrides (tailwind-merge dedupes the conflicting radius
// utility) — the rest of the app keeps its existing 10px radius system.
import { useState, useEffect, useRef, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRightIcon,
  MapPinIcon,
  PackageCheckIcon,
  SearchXIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  ShieldOffIcon,
  PackageXIcon,
  MessageCircleOffIcon,
  MessageCircleIcon,
  UsersIcon,
  CircleHelpIcon,
  HandshakeIcon,
  QuoteIcon,
  PlusIcon,
  WaypointsIcon,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { roleHomePath } from '@/lib/marketplace';
import { Logo } from '@/components/logo';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Motion primitives — IntersectionObserver-driven, transform/opacity only,
// honors prefers-reduced-motion. No scroll listener, no animation library.
// ---------------------------------------------------------------------------

function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: visible ? `${delay}ms` : '0ms' }}
      className={cn(
        'transition-all duration-700 ease-out',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Feedback motion: the nav gains a floor and the signature shadow once the
 * hero is scrolled past. Driven by an IntersectionObserver on a 1px sentinel
 * (never a scroll listener). */
function useScrolledPastHero(): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const sentinel = document.getElementById('hero-sentinel');
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) =>
      setScrolled(!(entry?.isIntersecting ?? true)),
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);
  return scrolled;
}

/** Uppercase tracked micro-label ("eyebrow") — the reference's section-rhythm
 * device, one per section, steel-blue-gray equivalent (muted-foreground). */
function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="text-xs font-semibold tracking-[0.125em] text-muted-foreground uppercase">
      {children}
    </span>
  );
}

/** Purely decorative ambient icon badge — the reference's "Floating Icon
 * Badge" component (small, accent-colored, offset over a corner). aria-hidden
 * since it carries no information a screen reader user needs. */
function FloatingBadge({
  icon: Icon,
  tone = 'outline',
  className,
}: {
  icon: LucideIcon;
  tone?: 'outline' | 'primary' | 'ink';
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'absolute flex size-12 items-center justify-center rounded-full shadow-[var(--shadow-float)]',
        tone === 'outline' && 'border border-border bg-card text-primary',
        tone === 'primary' && 'bg-primary text-primary-foreground',
        tone === 'ink' && 'bg-foreground text-background',
        className,
      )}
    >
      <Icon className="size-5" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

const NAV_LINKS = [
  { href: '#solution', label: 'Comment ça marche' },
  { href: '#engagements', label: 'Pourquoi Corridor' },
  { href: '#pour-qui', label: 'Rejoindre' },
];

// Stand-in for the reference's "TRUSTED BY 20,000+ customers" logo strip —
// no fake logos or counts (pre-launch, no real customers to show), same
// eyebrow + evenly spaced row rhythm, honest short claims instead.
const HERO_PROOF = [
  { label: 'Identité vérifiée', caption: 'Avant chaque mission' },
  { label: 'Présence locale', caption: 'Un agent à Cotonou' },
  { label: 'Suivi horodaté', caption: 'À chaque étape' },
];

const NEEDS = [
  {
    icon: SearchXIcon,
    title: 'Introuvable seul',
    body: "Ce que tu vois en ligne n'existe pas toujours comme annoncé, et personne sur place pour vérifier avant d'envoyer de l'argent.",
  },
  {
    icon: ShieldAlertIcon,
    title: "Confiance à l'aveugle",
    body: "Payer quelqu'un que tu n'as jamais vu, sans aucune garantie que la commande parte vraiment.",
  },
  {
    icon: MessageCircleOffIcon,
    title: 'Silence total',
    body: "Une fois la commande lancée, plus aucune nouvelle avant l'arrivée, ou la non arrivée, du colis.",
  },
  {
    icon: PackageXIcon,
    title: 'Produit non conforme',
    body: 'Ce qui arrive ne ressemble parfois en rien à ce qui avait été montré, et il est déjà trop tard pour réagir.',
  },
  {
    icon: ShieldOffIcon,
    title: 'Aucun recours',
    body: "Si quelque chose tourne mal, il n'y a personne vers qui se retourner. L'argent est simplement parti.",
  },
];

const STEPS = [
  {
    title: 'Tu postes ta demande',
    body: 'Un lien, une photo, ou juste une description. Pas besoin de trouver le contact toi-même.',
  },
  {
    title: "Un agent vérifié s'en occupe",
    body: 'Il se rend sur place, vérifie ce que tu veux en direct, négocie et achète pour toi.',
  },
  {
    title: 'Tu suis, tu reçois',
    body: "Un suivi clair à chaque étape, jusqu'à la livraison chez toi.",
  },
];

// Staggered card positions for the "Comment ça marche" left column, one per
// STEPS entry, matching the reference's diagonal card stack.
const STEP_CARD_POSITION = ['top-0 left-0', 'top-28 right-0 sm:top-32', 'bottom-0 left-6'];

// Short, honest process highlights (no invented numbers) standing in for the
// reference's "3485 / 426 / 281" stat row.
const PROCESS_PROOF = [
  { label: 'Une demande', caption: 'Postée en quelques mots' },
  { label: 'Un agent', caption: 'Vérifié, sur place à Cotonou' },
  { label: 'Un suivi', caption: "Clair, jusqu'à la livraison" },
];

const COMMUNITY_PERKS = [
  'Découvre de bons plans et des adresses fiables',
  'Échange librement avec les autres membres',
  'Pose toutes tes questions, sans détour',
  "Participe à des sessions d'information en direct",
  "Profite d'un accompagnement personnalisé",
];

// Visuel du panneau "communauté" : mêmes badges flottants que les autres
// panneaux de la page plutôt qu'une photo de personne (interdite par le
// brief produit).
const COMMUNITY_ICONS: LucideIcon[] = [MessageCircleIcon, UsersIcon, CircleHelpIcon];

const ACTORS = [
  {
    badge: 'Acheteur',
    headline: "Tu as besoin de quelque chose ? Dis-le, un agent s'en occupe.",
    pitch:
      "Tu as vu quelque chose qui t'intéresse, ou tu as juste une idée en tête. Tu postes ta demande, et un agent vérifié à Cotonou s'en occupe pour toi.",
    cta: 'Je poste ma demande',
    icons: [ShieldCheckIcon, PackageCheckIcon, MapPinIcon] as LucideIcon[],
  },
  {
    badge: 'Agent sourcing',
    headline: 'Tu es à Cotonou ? Utilise ton temps pour aider, et sois payé pour ça.',
    pitch:
      "Tu connais le terrain. Tu vérifies, tu achètes, tu envoies, et tu es payé directement par l'acheteur pour ton temps.",
    cta: 'Je deviens agent',
    icons: [HandshakeIcon, MapPinIcon, PackageCheckIcon] as LucideIcon[],
  },
];

// Tone + scatter position for the 3 floating badges inside each actor
// card's visual panel — stands in for the reference's photo, no stock
// imagery (banned by the product's own design brief).
const PANEL_TONES: Array<'primary' | 'ink' | 'outline'> = ['primary', 'ink', 'outline'];
const PANEL_ICON_POSITIONS = [
  'top-5 left-5',
  'top-1/2 right-6 -translate-y-1/2',
  'bottom-5 left-[38%]',
];

const COMMITMENTS = [
  {
    icon: HandshakeIcon,
    title: 'Confiance entre deux personnes',
    body: 'On ne met pas de plateforme entre vous. La confiance se construit entre une personne qui a besoin, et une personne qui répond présent.',
  },
  {
    icon: MapPinIcon,
    title: 'Le travail de terrain compte',
    body: "Le temps d'un agent sur le terrain n'est pas un service invisible. C'est un travail reconnu, payé directement par la personne qui en profite.",
  },
  {
    icon: ShieldCheckIcon,
    title: 'Une présence, pas un profil anonyme',
    body: 'Un agent vérifié a un nom, un visage, un historique de missions. Jamais un compte caché derrière un écran.',
  },
  {
    icon: PackageCheckIcon,
    title: 'La transparence comme respect',
    body: 'Ne rien cacher, à aucune étape : pas une fonctionnalité, une marque de respect envers la personne qui attend.',
  },
];

// Pas de faux témoignages attribués à des personnes inventées (produit
// pré-lancement, aucun utilisateur réel) — des engagements concrets et
// vérifiables, présentés dans un format "citation" captivant plutôt qu'en
// grille numérotée plate. Aucun nom, aucun avatar, aucune note : ce sont
// des promesses du produit, pas des avis fabriqués.
const TESTIMONIALS = [
  {
    quote: 'Personne ne rejoint une mission sans prouver qui il est.',
    detail: "Pièce d'identité et selfie contrôlés avant toute candidature.",
  },
  {
    quote: 'Chaque étape reste là, à consulter quand tu veux.',
    detail: "Reçu, en achat, acheté, expédié, livré : rien ne disparaît de l'historique.",
  },
  {
    quote: 'Ton argent ne passe jamais par nous. Jamais.',
    detail: "L'échange se fait directement entre toi et l'agent, sans intermédiaire financier.",
  },
  {
    quote: 'Un silence ne bloque jamais indéfiniment.',
    detail:
      "Passé un délai raisonnable, la commande est confirmée automatiquement, pour protéger le travail de l'agent.",
  },
];

const FAQS = [
  {
    q: "Comment sait-on qu'un agent est fiable ?",
    a: "Chaque agent passe une vérification d'identité avant de pouvoir candidater sur une demande, et son historique de missions reste visible publiquement.",
  },
  {
    q: "Et si le produit ne correspond pas à ce que j'attendais ?",
    a: "L'agent vérifie en direct avant d'acheter et peut échanger avec toi pendant cette vérification. Rien n'est acheté à l'aveugle.",
  },
  {
    q: 'Comment se passe le paiement ?',
    a: "Directement entre toi et l'agent, hors plateforme. Pas d'escrow, pas d'intermédiaire financier.",
  },
  {
    q: 'Que se passe-t-il si je ne confirme pas la réception ?',
    a: "La commande est automatiquement marquée comme livrée après un délai raisonnable, pour protéger le travail de l'agent en cas de silence.",
  },
  {
    q: 'Dans quelles zones Corridor est disponible ?',
    a: 'Des agents sur le terrain à Cotonou, avec livraison vers le Gabon, le Togo et le reste de la zone CEMAC.',
  },
  {
    q: 'Puis-je suivre ma commande en temps réel ?',
    a: 'Oui, chaque étape (réception, achat, expédition, livraison) est visible depuis ton compte, sans avoir à relancer qui que ce soit.',
  },
];

function FaqItem({
  id,
  q,
  a,
  open,
  onToggle,
}: {
  id: string;
  q: string;
  a: string;
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = `${id}-panel`;
  const buttonId = `${id}-button`;
  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-card transition-colors',
        open && 'border-primary/40',
      )}
    >
      <h3>
        <button
          type="button"
          id={buttonId}
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex w-full items-center justify-between gap-4 p-5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span className="text-sm font-semibold sm:text-base">{q}</span>
          <span
            aria-hidden="true"
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-foreground transition-transform duration-300',
              open && 'rotate-45 bg-primary text-primary-foreground',
            )}
          >
            <PlusIcon className="size-4" />
          </span>
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        aria-hidden={!open}
        className={cn(
          'grid transition-all duration-300 ease-out',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <p className="overflow-hidden px-5 pb-5 text-sm text-muted-foreground">{a}</p>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const scrolled = useScrolledPastHero();

  useEffect(() => {
    if (loading || !user) return;
    router.replace(
      user.marketplaceRole ? roleHomePath(user.marketplaceRole) : '/onboarding/choisir-role',
    );
  }, [user, loading, router]);

  if (loading || user) return null;

  return (
    <main className="flex flex-col">
      <header
        className={cn(
          'sticky top-0 z-40 bg-background transition-shadow duration-300',
          scrolled ? 'shadow-[var(--shadow-float)]' : 'shadow-none',
        )}
      >
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-8 lg:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden text-sm font-medium text-muted-foreground hover:text-foreground sm:inline"
            >
              Se connecter
            </Link>
            <Link
              href="/signup"
              className={cn(buttonVariants({ size: 'sm' }), 'rounded-full px-5')}
            >
              S&apos;inscrire
            </Link>
          </div>
        </div>
      </header>
      <div id="hero-sentinel" className="h-px" aria-hidden="true" />

      {/* 1. Héro — composition centrée fidèle à la capture DriveX fournie :
          badge au-dessus du titre, titre sur deux lignes (la 2ᵉ entièrement
          dans l'accent, pas juste un mot — la référence colore la ligne
          entière), sous-texte centré, deux boutons pleine pilule côte à
          côte, rangée de "stats" sous les CTA, badges d'icônes flottants
          dispersés. Palette Corridor uniquement : les 3 badges violet/vert/
          orange du modèle deviennent 3 tons de notre seul accent (plein
          terracotta / plein encre / contour) plutôt que 3 nouvelles
          couleurs, et les stats restent des promesses honnêtes plutôt que
          des chiffres inventés (produit pré-lancement). */}
      <section className="relative overflow-hidden border-b border-border">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-accent/70 via-accent/20 to-transparent" />
          <div className="absolute top-[-14rem] left-1/2 size-[42rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.3] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]"
            style={{
              backgroundImage:
                'linear-gradient(to right, var(--color-border) 1px, transparent 1px), linear-gradient(to bottom, var(--color-border) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />
        </div>

        <FloatingBadge
          icon={ShieldCheckIcon}
          tone="primary"
          className="top-24 left-[8%] hidden rotate-[-8deg] sm:flex"
        />
        <FloatingBadge
          icon={HandshakeIcon}
          tone="ink"
          className="top-40 right-[10%] hidden rotate-[6deg] sm:flex"
        />
        <FloatingBadge
          icon={MapPinIcon}
          tone="outline"
          className="bottom-24 left-[14%] hidden rotate-[5deg] lg:flex"
        />
        <FloatingBadge
          icon={PackageCheckIcon}
          tone="outline"
          className="right-[13%] bottom-16 hidden rotate-[-6deg] lg:flex"
        />

        <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 pt-20 pb-16 text-center sm:px-6 lg:pt-28 lg:pb-20">
          <Reveal>
            <Badge variant="outline" className="w-fit rounded-full bg-background/80">
              Corridor Bénin → CEMAC
            </Badge>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="text-4xl leading-[1.1] font-bold tracking-tight sm:text-5xl lg:text-6xl">
              <span className="block">Ce que tu cherches,</span>
              <span className="block text-primary">un agent vérifié l&apos;obtient pour toi</span>
            </h1>
          </Reveal>
          <Reveal delay={140}>
            <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
              Décris ton besoin en quelques mots. Un agent vérifié sur place le vérifie,
              l&apos;achète et te l&apos;envoie.
            </p>
          </Reveal>
          <Reveal delay={200} className="flex flex-wrap items-center justify-center gap-4 pt-1">
            <Button size="lg" className="rounded-full px-7" onClick={() => router.push('/signup')}>
              Publier ma demande
              <ArrowRightIcon />
            </Button>
            <a
              href="#solution"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'lg' }),
                'rounded-full px-7',
              )}
            >
              En savoir plus
            </a>
          </Reveal>
          <Reveal
            delay={260}
            className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4"
          >
            {HERO_PROOF.map((p) => (
              <div key={p.label} className="flex flex-col items-center gap-0.5">
                <span className="text-lg font-bold text-primary sm:text-xl">{p.label}</span>
                <span className="text-xs text-muted-foreground">{p.caption}</span>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* 2. Le besoin — grille bento (3 cartes puis 2, comme la capture
          fournie) : chaque carte a un panneau d'aperçu clair au-dessus de
          son titre. Pas de faux écran d'app (un problème n'a pas de
          "dashboard") — le panneau reste une illustration honnête (icône +
          halo teinté), pas une capture inventée. */}
      <section id="besoin" className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <Reveal className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
          <Eyebrow>Le problème</Eyebrow>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Ce que l&apos;achat à distance a de plus difficile
          </h2>
          <p className="text-base text-muted-foreground">
            Pas de simples désagréments : les vraies raisons pour lesquelles acheter à distance
            tourne mal, et pour lesquelles tant de gens renoncent.
          </p>
        </Reveal>
        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-6">
          {NEEDS.map((n, i) => (
            <Reveal
              key={n.title}
              delay={i * 90}
              className={cn('lg:col-span-2', i >= 3 && 'lg:col-span-3')}
            >
              <div className="flex h-full flex-col gap-4 rounded-[20px] bg-muted p-4">
                <div className="relative flex h-28 items-center justify-center overflow-hidden rounded-2xl bg-background">
                  <div
                    aria-hidden="true"
                    className="absolute size-20 rounded-full bg-primary/10 blur-xl"
                  />
                  <n.icon className="relative size-9 text-primary" strokeWidth={1.5} />
                </div>
                <div className="flex flex-col gap-1 px-1 pb-1">
                  <h3 className="text-base font-semibold">{n.title}</h3>
                  <p className="text-sm text-muted-foreground">{n.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* 3. La solution — reproduit la capture fournie : à gauche, 3
          cartes en escalier flottant sur un grand cercle teinté, chacune
          avec un numéro fantôme partiellement caché derrière ; à droite,
          eyebrow + titre (2ᵉ ligne en italique dans l'accent, même famille
          de police — jamais une police différente pour l'emphase) + texte
          simple + rangée de "preuves" sans chiffres inventés. */}
      <section id="solution" className="overflow-hidden border-y border-border bg-muted/30">
        <div className="mx-auto grid max-w-6xl gap-16 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-28">
          <Reveal className="relative mx-auto h-[420px] w-full max-w-md sm:h-[460px]">
            <div
              aria-hidden="true"
              className="absolute top-1/2 -left-16 -z-10 size-[26rem] -translate-y-1/2 rounded-full bg-accent"
            />
            {STEPS.map((s, i) => (
              <div key={s.title} className={cn('absolute w-60 sm:w-64', STEP_CARD_POSITION[i])}>
                <span
                  aria-hidden="true"
                  className="absolute -top-7 -left-2 -z-10 text-6xl font-bold text-foreground/10 select-none"
                >
                  {i + 1}
                </span>
                <div className="relative flex flex-col gap-1.5 rounded-2xl bg-card p-5 shadow-[var(--shadow-float)]">
                  <h3 className="text-base font-semibold">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.body}</p>
                </div>
              </div>
            ))}
          </Reveal>

          <Reveal delay={120} className="relative flex flex-col gap-5">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-4 -right-6 hidden size-32 rounded-full border border-primary/25 lg:block"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-2 bottom-0 hidden size-16 rounded-full bg-primary/70 blur-[1px] lg:block"
            />
            <Eyebrow>Comment ça marche</Eyebrow>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              <span className="block">Trois étapes,</span>
              <span className="block text-primary italic">un agent qui s&apos;occupe de tout</span>
            </h2>
            <p className="max-w-md text-base text-muted-foreground">
              Tu expliques ce qu&apos;il te faut. Un agent vérifié à Cotonou vérifie, achète et
              t&apos;envoie ce que tu cherches.
            </p>
            <div className="mt-2 flex flex-wrap gap-x-10 gap-y-4">
              {PROCESS_PROOF.map((p) => (
                <div key={p.label} className="flex flex-col gap-0.5">
                  <span className="text-xl font-bold sm:text-2xl">{p.label}</span>
                  <span className="text-sm text-muted-foreground">{p.caption}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* 4. Les acteurs — reproduit la capture "Feature Card" fournie :
          grande carte teintée, texte + lien fléché d'un côté, panneau
          visuel de l'autre. Pas de photo de personne (le brief produit
          interdit la photographie stock générique) — le panneau reprend le
          motif des badges d'icônes flottants déjà utilisé ailleurs sur la
          page, sur un fond dégradé, plutôt qu'une image inventée. */}
      <section id="pour-qui" className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <Reveal className="flex flex-col gap-3">
          <Eyebrow>Pour qui</Eyebrow>
          <h2 className="max-w-lg text-2xl font-bold tracking-tight sm:text-3xl">
            Que tu aies un besoin, ou du temps à offrir sur le terrain.
          </h2>
        </Reveal>
        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {ACTORS.map((a, i) => (
            <Reveal key={a.badge} delay={i * 120}>
              <div className="flex h-full flex-col gap-6 rounded-[20px] bg-muted p-6 sm:p-8 xl:grid xl:grid-cols-2 xl:items-center xl:gap-8">
                <div className="flex flex-col gap-4">
                  <Badge className="w-fit">{a.badge}</Badge>
                  <h3 className="text-xl font-bold tracking-tight sm:text-2xl">{a.headline}</h3>
                  <p className="text-sm text-muted-foreground">{a.pitch}</p>
                  <Link
                    href="/signup"
                    className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-primary"
                  >
                    {a.cta}
                    <ArrowRightIcon className="size-4" />
                  </Link>
                </div>
                <div className="relative h-48 overflow-hidden rounded-2xl bg-gradient-to-br from-primary/15 via-accent to-accent/40 xl:h-full xl:min-h-[200px]">
                  {a.icons.map((Icon, idx) => (
                    <FloatingBadge
                      key={idx}
                      icon={Icon}
                      tone={PANEL_TONES[idx] ?? 'outline'}
                      className={PANEL_ICON_POSITIONS[idx] ?? ''}
                    />
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* 5. Les engagements — repensée comme un manifeste plutôt qu'une
          grille de cartes (déjà utilisée en sections 2 et 4) : une citation
          engagée en grand format, puis 4 valeurs profondes et centrées sur
          l'humain en bande éditoriale. Registre "créatif mais pro" : un
          seul flourish (le guillemet géant en accent), pas de couleur
          supplémentaire, pas de gadget. */}
      <section id="engagements" className="mx-auto w-full max-w-5xl px-4 py-20 sm:px-6 lg:py-28">
        <Reveal className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
          <Eyebrow>Pourquoi Corridor</Eyebrow>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Une confiance construite, pas seulement promise.
          </h2>
        </Reveal>

        <Reveal delay={100} className="relative mx-auto mt-10 max-w-3xl">
          <span
            aria-hidden="true"
            className="absolute -top-8 -left-2 font-heading text-7xl text-primary/20 select-none sm:-left-8 sm:text-8xl"
          >
            &ldquo;
          </span>
          <p className="relative px-6 text-center text-xl leading-relaxed font-medium text-foreground sm:text-2xl">
            Corridor existe parce qu&apos;une personne qui a besoin de quelque chose mérite{' '}
            <span className="text-primary italic">une personne réelle</span> pour s&apos;en occuper,
            pas un algorithme anonyme. Et parce que le temps d&apos;un agent sur le terrain mérite
            d&apos;être reconnu, pas seulement utilisé.
          </p>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
          {COMMITMENTS.map((c, i) => (
            <Reveal
              key={c.title}
              delay={160 + i * 90}
              className="flex flex-col gap-3 py-6 first:pt-0 sm:px-6 sm:py-0 sm:first:pl-0 sm:last:pr-0"
            >
              <c.icon className="size-5 text-primary" />
              <h3 className="text-base font-semibold">{c.title}</h3>
              <p className="text-sm text-muted-foreground">{c.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* 6. Témoignages — le produit est pré-lancement (aucun utilisateur
          réel), donc pas de fausses citations attribuées à des personnes
          inventées. Ce sont des engagements concrets et vérifiables,
          présentés en format "citation" captivant (pas de nom, pas
          d'avatar, pas de note). */}
      <section id="temoignages" className="border-y border-border bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <Reveal className="flex flex-col gap-3">
            <Eyebrow>Ce que Corridor te promet</Eyebrow>
            <h2 className="max-w-lg text-2xl font-bold tracking-tight sm:text-3xl">
              Pas des promesses en l&apos;air. Des mécanismes que tu peux vérifier toi-même.
            </h2>
          </Reveal>
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.quote} delay={i * 100}>
                <div className="flex h-full flex-col gap-3 rounded-[20px] border-l-4 border-primary bg-card p-6 shadow-[var(--shadow-float)]">
                  <QuoteIcon className="size-5 text-primary" />
                  <p className="text-lg font-semibold text-foreground italic sm:text-xl">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <p className="text-sm text-muted-foreground">{t.detail}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 7. FAQ — modernisée : grille 2 colonnes de cartes indépendantes
          (plus la liste plate à filets précédente), bascule +/× plutôt
          qu'un chevron, et câblage accessibilité complet (aria-controls,
          aria-labelledby, aria-hidden sur le panneau fermé — pas seulement
          aria-expanded sur le bouton). */}
      <section id="faq" className="mx-auto w-full max-w-5xl px-4 py-20 sm:px-6 lg:py-28">
        <Reveal className="flex flex-col gap-3">
          <Eyebrow>Questions fréquentes</Eyebrow>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Les dernières questions, avant de se lancer.
          </h2>
        </Reveal>
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FAQS.map((f, i) => (
            <Reveal key={f.q} delay={i * 60}>
              <FaqItem
                id={`faq-${i}`}
                q={f.q}
                a={f.a}
                open={openFaq === i}
                onToggle={() => setOpenFaq(openFaq === i ? null : i)}
              />
            </Reveal>
          ))}
        </div>
      </section>

      {/* 8. Rejoindre la communauté — reproduit la capture "Communauté
          WhatsApp" fournie. Pas de vraie photo de personne (interdite par
          le brief produit) : le panneau visuel reprend le motif des badges
          d'icônes flottants déjà utilisé pour les sections Pour qui/Solution
          plutôt qu'une image inventée. Le bouton pointe vers /signup en
          attendant le vrai lien d'invitation WhatsApp — à remplacer dès
          qu'il est fourni. */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <Reveal className="overflow-hidden rounded-[28px] bg-accent/40">
          <div className="grid grid-cols-1 gap-8 p-6 sm:p-10 lg:grid-cols-2 lg:items-center lg:gap-12">
            <div className="flex flex-col gap-5">
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-background px-4 py-1.5 text-sm font-medium text-primary shadow-[var(--shadow-float)]">
                <MessageCircleIcon className="size-4" />
                Rejoindre la communauté WhatsApp
              </span>
              <h2 className="text-2xl leading-tight font-bold tracking-tight sm:text-3xl">
                <span className="block font-normal text-foreground/70">Rejoins la</span>
                <span className="block">communauté</span>
                <span className="block text-primary">Corridor</span>
              </h2>
              <ul className="flex flex-col gap-2">
                {COMMUNITY_PERKS.map((perk) => (
                  <li key={perk} className="flex items-start gap-2 text-sm text-foreground">
                    <span
                      aria-hidden="true"
                      className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                    />
                    {perk}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={cn(buttonVariants({ size: 'lg' }), 'w-fit rounded-full px-7')}
              >
                Rejoindre la communauté
                <ArrowRightIcon />
              </Link>
            </div>

            <div className="relative h-56 overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-accent to-background sm:h-72 lg:h-full lg:min-h-[280px]">
              {COMMUNITY_ICONS.map((Icon, idx) => (
                <FloatingBadge
                  key={idx}
                  icon={Icon}
                  tone={PANEL_TONES[idx] ?? 'outline'}
                  className={PANEL_ICON_POSITIONS[idx] ?? ''}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-3 bg-foreground px-6 py-5 text-background sm:flex-row sm:px-10">
            <p className="text-center text-sm sm:text-left">
              Échange directement avec l&apos;équipe <strong>Corridor</strong> et les autres
              membres.
            </p>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold tracking-tight text-background">
              <WaypointsIcon className="size-3.5 text-primary" />
              Corridor <span className="text-primary">Sourcing</span>
            </span>
          </div>
        </Reveal>
      </section>

      {/* Footer complet */}
      <footer className="px-4 py-10 sm:px-6">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 sm:grid-cols-4">
          <div className="col-span-2 flex flex-col gap-2 sm:col-span-1">
            <Logo />
            <p className="text-sm text-muted-foreground">
              Le corridor Bénin → CEMAC, avec un agent vérifié sur le terrain.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Produit</span>
            <a href="#besoin" className="text-sm text-muted-foreground hover:text-foreground">
              Le besoin
            </a>
            <a href="#solution" className="text-sm text-muted-foreground hover:text-foreground">
              Comment ça marche
            </a>
            <a href="#pour-qui" className="text-sm text-muted-foreground hover:text-foreground">
              Pour qui
            </a>
            <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground">
              FAQ
            </a>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Compte</span>
            <Link href="/signup" className="text-sm text-muted-foreground hover:text-foreground">
              S&apos;inscrire
            </Link>
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
              Se connecter
            </Link>
          </div>
        </div>
        <p className="mx-auto mt-8 max-w-6xl text-sm text-muted-foreground">
          Corridor Sourcing, Cotonou, Bénin.
        </p>
      </footer>
    </main>
  );
}
