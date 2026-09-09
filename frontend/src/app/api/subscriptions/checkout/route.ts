// POST /api/subscriptions/checkout — Phase 7 (F25/F26, US8). Starts a
// Bictorys hosted checkout for the authed AGENT/WHOLESALER's Pro plan.
//
// Mirrors /api/orders (Stripe-grade Idempotency-Key replay, CircuitBreaker,
// lazy provider init -> 503 not 500) with one deliberate simplification:
// `amount`/`currency`/`plan` are derived server-side from the caller's
// `marketplaceRole` — the client cannot set the price. This is the schema's
// own invariant (see the comment above `model Order` in schema.prisma):
// Order is reserved for Pro-subscription payments, never sourcing
// transactions, so there's no body to fingerprint against a replay — the
// price for a given role is deterministic, unlike /api/orders' free-form
// amount.
//
// Activation itself does NOT happen here — it happens in the Bictorys
// webhook's `onPaid` handler once the charge actually clears, keyed off
// `Order.metadata.subscriptionPlan` written below.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAnyMarketplaceRole } from '@/lib/server/middleware';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { prisma } from '@/lib/server/prisma';
import { CircuitOpenError } from '@/lib/server/payments/circuit-breaker';
import {
  breaker,
  getProvider,
  PaymentProviderUnconfiguredError,
} from '@/lib/server/payments/provider-singleton';
import {
  planForProfileType,
  SUBSCRIPTION_CURRENCY,
  SUBSCRIPTION_PLAN_PRICE,
  type SubscriptionProfileType,
} from '@/lib/marketplace';

const IDEM_KEY_MAX_LEN = 200;
const ORDER_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24h PENDING window, matches /api/orders

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAnyMarketplaceRole(['AGENT', 'WHOLESALER']);
    if (auth instanceof NextResponse) return auth;

    const profileType: SubscriptionProfileType =
      auth.marketplaceRole === 'AGENT' ? 'AGENT' : 'WHOLESALER';
    const plan = planForProfileType(profileType);
    const amount = SUBSCRIPTION_PLAN_PRICE[plan];

    const idemKey = req.headers.get('idempotency-key') ?? '';
    if (!idemKey) {
      return NextResponse.json(
        { error: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Idempotency-Key header required' },
        { status: 400, headers: { 'x-request-id': ctx.requestId } },
      );
    }
    if (idemKey.length > IDEM_KEY_MAX_LEN) {
      return NextResponse.json(
        {
          error: 'IDEMPOTENCY_KEY_INVALID',
          message: `Idempotency-Key exceeds ${IDEM_KEY_MAX_LEN} characters`,
        },
        { status: 400, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    // Replay branch (Pitfall 3 — echo the outcome, not the row). No body
    // fingerprint needed: the price is derived from the caller's role, not
    // client input, so a replay of the same Idempotency-Key by the same
    // user can only ever mean the same (plan, amount).
    const existing = await prisma.order.findUnique({ where: { idempotencyKey: idemKey } });
    if (existing) {
      if (existing.status === 'PENDING' || existing.status === 'PAID') {
        if (existing.status === 'PENDING' && !existing.paymentUrl) {
          return NextResponse.json(
            {
              error: 'PAYMENT_IN_FLIGHT',
              message: 'Prior attempt did not complete; retry shortly.',
            },
            { status: 503, headers: { 'x-request-id': ctx.requestId, 'Retry-After': '5' } },
          );
        }
        return NextResponse.json(
          { id: existing.id, paymentUrl: existing.paymentUrl, status: existing.status },
          { status: 200, headers: { 'x-request-id': ctx.requestId } },
        );
      }
      return NextResponse.json(
        {
          error: 'PAYMENT_PROVIDER_UNAVAILABLE',
          message:
            'A previous attempt with this Idempotency-Key did not complete; submit a new key to retry.',
        },
        { status: 503, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    let provider;
    try {
      provider = getProvider();
    } catch (err) {
      if (err instanceof PaymentProviderUnconfiguredError) {
        return NextResponse.json(
          { error: 'PAYMENT_PROVIDER_UNCONFIGURED', message: 'Payment provider not configured' },
          { status: 503, headers: { 'x-request-id': ctx.requestId } },
        );
      }
      throw err;
    }

    const envPublicUrl = process.env.PUBLIC_URL;
    if (!envPublicUrl && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        {
          error: 'PAYMENT_PROVIDER_UNCONFIGURED',
          message: 'PUBLIC_URL not set; cannot construct success/failure redirect URLs.',
        },
        { status: 503, headers: { 'x-request-id': ctx.requestId } },
      );
    }
    const publicUrl = envPublicUrl ?? 'http://localhost:3000';

    const order = await prisma.order.create({
      data: {
        userId: auth.user.sub,
        amount,
        currency: SUBSCRIPTION_CURRENCY,
        provider: 'bictorys',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + ORDER_EXPIRY_MS),
        idempotencyKey: idemKey,
        customerEmail: auth.user.email,
        metadata: { subscriptionPlan: plan, profileType },
      },
    });

    try {
      const result = await breaker.execute(() =>
        provider.charge({
          amount,
          currency: SUBSCRIPTION_CURRENCY,
          customer: { email: auth.user.email },
          successUrl: `${publicUrl}/abonnement/upgrade?status=success`,
          failureUrl: `${publicUrl}/abonnement/upgrade?status=failed`,
          externalRef: order.id,
        }),
      );

      await prisma.order.update({
        where: { id: order.id },
        data: { providerChargeId: result.providerChargeId, paymentUrl: result.paymentUrl },
      });

      return NextResponse.json(
        { id: order.id, paymentUrl: result.paymentUrl, status: 'PENDING' },
        { status: 201, headers: { 'x-request-id': ctx.requestId } },
      );
    } catch (err) {
      if (err instanceof CircuitOpenError) {
        await prisma.order.update({ where: { id: order.id }, data: { status: 'FAILED' } });
        const retryAfterSec = Math.max(1, Math.ceil((err.retryAt.getTime() - Date.now()) / 1000));
        return NextResponse.json(
          {
            error: 'PAYMENT_PROVIDER_UNAVAILABLE',
            message: 'Payment provider temporarily unavailable. Try again shortly.',
          },
          {
            status: 503,
            headers: { 'x-request-id': ctx.requestId, 'Retry-After': String(retryAfterSec) },
          },
        );
      }
      await prisma.order.update({ where: { id: order.id }, data: { status: 'FAILED' } });
      const message = err instanceof Error ? err.message : 'Unknown payment error';
      return NextResponse.json(
        { error: 'PAYMENT_FAILED', message },
        { status: 502, headers: { 'x-request-id': ctx.requestId } },
      );
    }
  });
}
