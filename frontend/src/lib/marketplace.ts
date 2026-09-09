export type MarketplaceRole = 'BUYER' | 'AGENT' | 'WHOLESALER';

// Fixed category list (schema.prisma Product.category comment). A flat list
// keeps moderation and buyer filtering simple for v1 — no subcategories.
export const PRODUCT_CATEGORIES = [
  'Bijoux',
  'Cosmétiques',
  'Textiles',
  'Électronique',
  'Fournitures',
  'Chaussures',
  'Maison & déco',
  'Alimentation',
  'Autre',
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const PRODUCT_MAX_MEDIA = 5;

// F8/US1 — "jusqu'à 3 images de référence" on a sourcing request.
export const SOURCING_REQUEST_MAX_MEDIA = 3;

// F12/US1 — free-plan cap: a buyer can't have more than 3 active
// (OPEN | IN_PROGRESS) sourcing requests at once.
export const MAX_ACTIVE_SOURCING_REQUESTS = 3;

// US4 AC — "joindre jusqu'à 3 photos/vidéos comme preuve" per mission
// status change (images only for v1, per the plan's media constraint).
export const MISSION_STATUS_EVENT_MAX_MEDIA = 3;

// Phase 5 — messagerie : une image jointe par message (images only, comme
// le reste du kit — pas de pièce jointe vidéo/document en v1).
export const MESSAGE_MAX_MEDIA = 1;

/** Where a role lands after login / role choice. */
export function roleHomePath(role: MarketplaceRole): string {
  switch (role) {
    case 'BUYER':
      return '/buyer';
    case 'AGENT':
      return '/agent/dashboard';
    case 'WHOLESALER':
      return '/wholesaler/dashboard';
  }
}

// Phase 7 — Abonnements Pro. Pricing per prd.md §6 (freemium table). Prices
// are public (shown on /abonnement/upgrade), so this file (no `server-only`
// gate) is the right home — both the checkout route and the upgrade page
// import from here rather than duplicating the numbers.
export type SubscriptionProfileType = 'AGENT' | 'WHOLESALER';
export type SubscriptionPlan = 'AGENT_PRO' | 'WHOLESALER_PRO';
export type SubscriptionStatus = 'INACTIVE' | 'ACTIVE' | 'GRACE' | 'EXPIRED' | 'CANCELLED';

export const SUBSCRIPTION_CURRENCY = 'XOF';
export const SUBSCRIPTION_PLAN_PRICE: Record<SubscriptionPlan, number> = {
  AGENT_PRO: 5000,
  WHOLESALER_PRO: 13000,
};
// No recurring-charge API on the Bictorys provider (one-shot `charge()`
// only) — a "subscription" here is a fixed 30-day period the user renews by
// checking out again, nudged by the J-3 reminder cron below.
export const SUBSCRIPTION_PERIOD_DAYS = 30;
export const SUBSCRIPTION_GRACE_DAYS = 7;
export const SUBSCRIPTION_RENEWAL_REMINDER_LEAD_DAYS = 3;

// F13/US7 — a free-plan wholesaler can list up to 20 products.
export const WHOLESALER_FREE_PRODUCT_LIMIT = 20;

export function planForProfileType(profileType: SubscriptionProfileType): SubscriptionPlan {
  return profileType === 'AGENT' ? 'AGENT_PRO' : 'WHOLESALER_PRO';
}

/** ACTIVE and GRACE both keep Pro benefits — only the renewal urgency differs. */
export function isProActive(status: string): boolean {
  return status === 'ACTIVE' || status === 'GRACE';
}
