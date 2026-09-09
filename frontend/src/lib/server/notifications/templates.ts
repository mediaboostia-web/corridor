/**
 * Notification templates.
 *
 * Each project defines its own typed wrappers around `createNotification`.
 * The example below ships with the template — adapt it, replace it, or add
 * more (e.g. `firePaymentReceived`, `fireExportReady`). The pattern:
 *
 *   1. Build a `CreateNotificationInput` with a *deterministic* dedupeKey
 *      so the unique constraint enforces at-most-once delivery for that
 *      logical event (e.g. `payment-received:${orderId}` — never include
 *      a timestamp or random suffix).
 *   2. Pass the input + your PrismaClient to `createNotification`.
 *   3. Optionally enqueue an email via `EmailQueue.enqueue` — but ONLY
 *      after the notification row is created, so a duplicate event never
 *      sends a duplicate email.
 *
 * Keep these helpers free of side effects beyond the row insert; the
 * email enqueue belongs at the call site so each project can pick the
 * right channel (no email vs. transactional vs. marketing).
 */

import type { CreateNotificationInput } from './index';

export function welcomeNotification(userId: string, email: string): CreateNotificationInput {
  return {
    userId,
    type: 'WELCOME',
    title: 'Welcome!',
    body: `Glad to have you on board, ${email}.`,
    dedupeKey: `welcome:${userId}`,
  };
}

/**
 * Example: notification dispatched after a successful payment.
 * Called from the Bictorys webhook handler's `onPaid` post-commit hook.
 */
export function paymentReceived(
  userId: string,
  orderId: string,
  amount: number,
  currency: string,
): CreateNotificationInput {
  return {
    userId,
    type: 'PAYMENT_RECEIVED',
    title: 'Payment received',
    body: `Order ${orderId} for ${amount} ${currency} confirmed.`,
    data: { orderId, amount, currency },
    dedupeKey: `payment-received:${orderId}`,
  };
}

/**
 * Corridor Sourcing — product moderation (Phase 1). `moderatedAt` is
 * generated once by the route and reused for both the DB row and this
 * dedupeKey, so a retried request dedupes but a later resubmission +
 * re-approval (a fresh moderatedAt) fires a fresh notification.
 */
export function productApproved(
  userId: string,
  productId: string,
  productName: string,
  moderatedAt: Date,
): CreateNotificationInput {
  return {
    userId,
    type: 'PRODUCT_APPROVED',
    title: 'Produit publié',
    body: `"${productName}" est maintenant visible dans le catalogue.`,
    data: { productId },
    dedupeKey: `product-approved:${productId}:${moderatedAt.toISOString()}`,
  };
}

export function productRejected(
  userId: string,
  productId: string,
  productName: string,
  reason: string,
  moderatedAt: Date,
): CreateNotificationInput {
  return {
    userId,
    type: 'PRODUCT_REJECTED',
    title: 'Produit refusé',
    body: `"${productName}" n'a pas été approuvé : ${reason}`,
    data: { productId, reason },
    dedupeKey: `product-rejected:${productId}:${moderatedAt.toISOString()}`,
  };
}

/**
 * Corridor Sourcing — agent identity verification (Phase 3). `reviewedAt` is
 * generated once by the route and reused for both the DB row and this
 * dedupeKey, so a retried request dedupes but a later resubmission +
 * re-review (a fresh reviewedAt) fires a fresh notification.
 */
export function verificationApproved(
  userId: string,
  agentProfileId: string,
  reviewedAt: Date,
): CreateNotificationInput {
  return {
    userId,
    type: 'VERIFICATION_APPROVED',
    title: 'Identité vérifiée',
    body: 'Ton profil agent est vérifié : tu peux maintenant candidater aux demandes de sourcing.',
    data: { agentProfileId },
    dedupeKey: `verification-approved:${agentProfileId}:${reviewedAt.toISOString()}`,
  };
}

export function verificationRejected(
  userId: string,
  agentProfileId: string,
  reason: string,
  reviewedAt: Date,
): CreateNotificationInput {
  return {
    userId,
    type: 'VERIFICATION_REJECTED',
    title: 'Vérification refusée',
    body: `Ta demande de vérification n'a pas été approuvée : ${reason}`,
    data: { agentProfileId, reason },
    dedupeKey: `verification-rejected:${agentProfileId}:${reviewedAt.toISOString()}`,
  };
}

/**
 * Corridor Sourcing — sourcing-request candidatures (Phase 3). Each event is
 * tied to a specific Candidature row whose id is unique per (request,
 * agent), so the candidature id alone is a sufficient dedupe key.
 */
export function newCandidature(
  buyerId: string,
  sourcingRequestId: string,
  sourcingRequestTitle: string,
  candidatureId: string,
): CreateNotificationInput {
  return {
    userId: buyerId,
    type: 'NEW_CANDIDATURE',
    title: 'Nouvelle candidature',
    body: `Un agent a candidaté sur ta demande "${sourcingRequestTitle}".`,
    data: { sourcingRequestId, candidatureId },
    dedupeKey: `new-candidature:${candidatureId}`,
  };
}

export function candidatureAccepted(
  agentUserId: string,
  sourcingRequestId: string,
  sourcingRequestTitle: string,
  candidatureId: string,
): CreateNotificationInput {
  return {
    userId: agentUserId,
    type: 'CANDIDATURE_ACCEPTED',
    title: 'Candidature acceptée',
    body: `Ta candidature sur "${sourcingRequestTitle}" a été acceptée. Une mission a été créée.`,
    data: { sourcingRequestId, candidatureId },
    dedupeKey: `candidature-accepted:${candidatureId}`,
  };
}

/**
 * Corridor Sourcing — mission pipeline (Phase 4, F18). Fired on every
 * Mission.status transition. Usually toward whichever party did NOT cause
 * it (the buyer when the agent advances a step; the agent when the buyer
 * confirms delivery), but the mission-auto-deliver cron notifies BOTH
 * parties for the same (mission, status) pair — so the dedupeKey MUST
 * include userId (Notification.dedupeKey is globally unique, not scoped
 * per user; omitting userId here would silently drop the second party's
 * notification to the unique-constraint dedupe).
 */
export function missionStatusChanged(
  userId: string,
  missionId: string,
  status: string,
  statusLabel: string,
  requestTitle: string,
): CreateNotificationInput {
  return {
    userId,
    type: 'MISSION_STATUS_CHANGED',
    title: 'Mise à jour de commande',
    body: `"${requestTitle}" est maintenant au statut : ${statusLabel}.`,
    data: { missionId, status },
    dedupeKey: `mission-status-changed:${missionId}:${status}:${userId}`,
  };
}

/**
 * Corridor Sourcing — messagerie (Phase 5). One notification per Message
 * row (2-party threads only), so the message id alone is a sufficient
 * dedupe key — no risk of the multi-recipient collision documented on
 * `missionStatusChanged` above.
 */
export function newMessage(
  recipientUserId: string,
  conversationId: string,
  messageId: string,
  senderLabel: string,
  preview: string,
): CreateNotificationInput {
  return {
    userId: recipientUserId,
    type: 'NEW_MESSAGE',
    title: 'Nouveau message',
    body: `${senderLabel} : ${preview}`,
    data: { conversationId, messageId },
    dedupeKey: `new-message:${messageId}`,
  };
}

/**
 * Corridor Sourcing — avis & alerte note basse (Phase 6, F20). Sent to
 * every admin when a review pushes/keeps a VERIFIED agent's avgRating
 * below 3.0 with 3+ reviews. Not an auto-suspension — the admin decides
 * (per the plan's explicit "déclenché par l'admin sur alerte, pas
 * automatique"). Dedupe key ties to the triggering Review's own id (a
 * fresh review means a fresh, worth-reading alert even if the agent stays
 * below threshold).
 */
export function agentRatingAlert(
  adminUserId: string,
  agentProfileId: string,
  agentDisplayName: string,
  avgRating: number,
  reviewCount: number,
  reviewId: string,
): CreateNotificationInput {
  return {
    userId: adminUserId,
    type: 'AGENT_RATING_ALERT',
    title: 'Note agent sous le seuil',
    body: `${agentDisplayName} est à ${avgRating.toFixed(1)}/5 sur ${reviewCount} avis. Une suspension manuelle peut être envisagée.`,
    data: { agentProfileId, avgRating, reviewCount },
    dedupeKey: `agent-rating-alert:${adminUserId}:${reviewId}`,
  };
}

/**
 * Corridor Sourcing — abonnements Pro (Phase 7, F27/US8). Fired by the
 * `subscription-renewal-reminder` cron (J-3) while the subscription is
 * still ACTIVE. dedupeKey ties to `currentPeriodEnd`, not a timestamp — the
 * cron runs hourly and will call this repeatedly across the whole 3-day
 * reminder window, but createNotification's dedupe (Notification.dedupeKey
 * @unique) silently drops every call after the first for the same period,
 * so no separate "already reminded" flag is needed on ProSubscription.
 */
export function subscriptionRenewalReminder(
  userId: string,
  plan: string,
  currentPeriodEnd: Date,
): CreateNotificationInput {
  return {
    userId,
    type: 'SUBSCRIPTION_RENEWAL_REMINDER',
    title: 'Ton abonnement Pro expire bientôt',
    body: `Ton abonnement ${plan} se termine le ${currentPeriodEnd.toLocaleDateString('fr-FR')}. Renouvelle-le pour garder tes avantages Pro.`,
    data: { plan, currentPeriodEnd: currentPeriodEnd.toISOString() },
    dedupeKey: `subscription-renewal-reminder:${userId}:${currentPeriodEnd.toISOString()}`,
  };
}

/**
 * Fired by `subscription-grace-sweep` when an ACTIVE subscription's period
 * ends unrenewed and moves to GRACE (still Pro for `graceEndsAt` more days).
 */
export function subscriptionGraceStarted(
  userId: string,
  plan: string,
  graceEndsAt: Date,
): CreateNotificationInput {
  return {
    userId,
    type: 'SUBSCRIPTION_GRACE_STARTED',
    title: 'Abonnement Pro non renouvelé',
    body: `Ton abonnement ${plan} n'a pas été renouvelé. Tu gardes tes avantages Pro jusqu'au ${graceEndsAt.toLocaleDateString('fr-FR')}, passé ce délai ils seront suspendus.`,
    data: { plan, graceEndsAt: graceEndsAt.toISOString() },
    dedupeKey: `subscription-grace-started:${userId}:${graceEndsAt.toISOString()}`,
  };
}

/**
 * Fired by `subscription-grace-sweep` when the grace period itself lapses
 * and the subscription moves GRACE -> EXPIRED (Pro benefits actually lost).
 * dedupeKey ties to the `graceEndsAt` that just lapsed (not a "now"
 * timestamp) so a future re-subscribe -> re-expire cycle for the same user
 * still fires a fresh notification instead of colliding with this one.
 */
export function subscriptionDowngraded(
  userId: string,
  plan: string,
  graceEndsAt: Date,
): CreateNotificationInput {
  return {
    userId,
    type: 'SUBSCRIPTION_DOWNGRADED',
    title: 'Abonnement Pro expiré',
    body: `Ton abonnement ${plan} a expiré et tes avantages Pro sont désactivés. Tu peux te réabonner à tout moment.`,
    data: { plan },
    dedupeKey: `subscription-downgraded:${userId}:${graceEndsAt.toISOString()}`,
  };
}

/**
 * Corridor Sourcing — admin agent suspension (Phase 8). Manual action taken
 * after an `agentRatingAlert` (never automatic — see that template's own
 * comment). `suspendedAt`/`unsuspendedAt` are generated once by the route
 * and reused for both the DB write and this dedupeKey, so a retried
 * request dedupes but a later suspend/unsuspend cycle fires fresh.
 */
export function agentSuspended(
  userId: string,
  agentProfileId: string,
  reason: string | null,
  suspendedAt: Date,
): CreateNotificationInput {
  return {
    userId,
    type: 'AGENT_SUSPENDED',
    title: 'Profil suspendu',
    body: reason
      ? `Ton profil agent a été suspendu par un administrateur : ${reason}`
      : 'Ton profil agent a été suspendu par un administrateur.',
    data: { agentProfileId, reason },
    dedupeKey: `agent-suspended:${agentProfileId}:${suspendedAt.toISOString()}`,
  };
}

export function agentUnsuspended(
  userId: string,
  agentProfileId: string,
  unsuspendedAt: Date,
): CreateNotificationInput {
  return {
    userId,
    type: 'AGENT_UNSUSPENDED',
    title: 'Profil réactivé',
    body: 'Ton profil agent a été réactivé : tu peux de nouveau candidater.',
    data: { agentProfileId },
    dedupeKey: `agent-unsuspended:${agentProfileId}:${unsuspendedAt.toISOString()}`,
  };
}

export function candidatureRejected(
  agentUserId: string,
  sourcingRequestId: string,
  sourcingRequestTitle: string,
  candidatureId: string,
): CreateNotificationInput {
  return {
    userId: agentUserId,
    type: 'CANDIDATURE_REJECTED',
    title: 'Candidature non retenue',
    body: `Ta candidature sur "${sourcingRequestTitle}" n'a pas été retenue.`,
    data: { sourcingRequestId, candidatureId },
    dedupeKey: `candidature-rejected:${candidatureId}`,
  };
}
