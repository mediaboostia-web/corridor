// POST /api/subscriptions/checkout — Phase 7. Mirrors /api/orders' test
// bootstrap (prisma-mock, requireAnyMarketplaceRole mocked, provider
// singleton mocked) with the deliberate simplification that price is
// server-derived from marketplaceRole, not client input.
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies } from '@/test-utils/mock-cookies';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

mockNextCookies();

vi.mock('@/lib/server/middleware', () => ({
  requireAnyMarketplaceRole: vi.fn(),
}));

vi.mock('@/lib/server/payments/provider-singleton', () => ({
  getProvider: vi.fn(),
  breaker: { execute: vi.fn() },
  PaymentProviderUnconfiguredError: class PaymentProviderUnconfiguredError extends Error {
    constructor() {
      super('Payment provider not configured');
      this.name = 'PaymentProviderUnconfiguredError';
    }
  },
}));

import { requireAnyMarketplaceRole } from '@/lib/server/middleware';
import { getProvider, breaker } from '@/lib/server/payments/provider-singleton';
import { CircuitOpenError } from '@/lib/server/payments/circuit-breaker';
import { POST } from './route';

const mockRequireAnyMarketplaceRole = vi.mocked(requireAnyMarketplaceRole);
const mockGetProvider = vi.mocked(getProvider);
const mockExecute = vi.mocked(breaker.execute);

const agentCtx = {
  user: { sub: 'user-1', email: 'karim@example.com' },
  marketplaceRole: 'AGENT' as const,
};
const wholesalerCtx = {
  user: { sub: 'user-2', email: 'maridiath@example.com' },
  marketplaceRole: 'WHOLESALER' as const,
};

function makePost(opts: { idempotencyKey?: string | null } = {}): NextRequest {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-csrf-token': 'csrf-tok',
    cookie: 'app-csrf=csrf-tok',
  };
  if (opts.idempotencyKey !== null) {
    headers['idempotency-key'] = opts.idempotencyKey ?? 'idem-key-1';
  }
  return new NextRequest('http://test/api/subscriptions/checkout', { method: 'POST', headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NODE_ENV', 'test');
});

describe('POST /api/subscriptions/checkout', () => {
  it('returns 400 IDEMPOTENCY_KEY_REQUIRED when the header is missing', async () => {
    mockRequireAnyMarketplaceRole.mockResolvedValue(agentCtx);
    const res = await POST(makePost({ idempotencyKey: null }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('derives amount/plan from AGENT role (5000 XOF, AGENT_PRO), not client input', async () => {
    mockRequireAnyMarketplaceRole.mockResolvedValue(agentCtx);
    prismaMock.order.findUnique.mockResolvedValue(null);
    prismaMock.order.create.mockResolvedValue({ id: 'order-1' } as never);
    prismaMock.order.update.mockResolvedValue({} as never);
    mockGetProvider.mockReturnValue({
      name: 'bictorys',
      charge: vi.fn(),
    } as never);
    mockExecute.mockResolvedValue({ providerChargeId: 'ch_1', paymentUrl: 'https://pay/1' });

    const res = await POST(makePost());
    expect(res.status).toBe(201);
    expect(prismaMock.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 5000,
          currency: 'XOF',
          userId: 'user-1',
          metadata: { subscriptionPlan: 'AGENT_PRO', profileType: 'AGENT' },
        }),
      }),
    );
  });

  it('derives amount/plan from WHOLESALER role (13000 XOF, WHOLESALER_PRO)', async () => {
    mockRequireAnyMarketplaceRole.mockResolvedValue(wholesalerCtx);
    prismaMock.order.findUnique.mockResolvedValue(null);
    prismaMock.order.create.mockResolvedValue({ id: 'order-2' } as never);
    prismaMock.order.update.mockResolvedValue({} as never);
    mockGetProvider.mockReturnValue({ name: 'bictorys', charge: vi.fn() } as never);
    mockExecute.mockResolvedValue({ providerChargeId: 'ch_2', paymentUrl: 'https://pay/2' });

    await POST(makePost({ idempotencyKey: 'idem-key-2' }));
    expect(prismaMock.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 13000,
          currency: 'XOF',
          metadata: { subscriptionPlan: 'WHOLESALER_PRO', profileType: 'WHOLESALER' },
        }),
      }),
    );
  });

  it('replays a PENDING/PAID prior Order for the same Idempotency-Key without re-charging', async () => {
    mockRequireAnyMarketplaceRole.mockResolvedValue(agentCtx);
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: 'PAID',
      paymentUrl: 'https://pay/1',
    } as never);

    const res = await POST(makePost({ idempotencyKey: 'idem-key-1' }));
    expect(res.status).toBe(200);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('marks Order FAILED and returns 503 on CircuitOpenError', async () => {
    mockRequireAnyMarketplaceRole.mockResolvedValue(agentCtx);
    prismaMock.order.findUnique.mockResolvedValue(null);
    prismaMock.order.create.mockResolvedValue({ id: 'order-3' } as never);
    prismaMock.order.update.mockResolvedValue({} as never);
    mockGetProvider.mockReturnValue({ name: 'bictorys', charge: vi.fn() } as never);
    mockExecute.mockRejectedValue(new CircuitOpenError('bictorys', new Date(Date.now() + 5000)));

    const res = await POST(makePost());
    expect(res.status).toBe(503);
    expect(prismaMock.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'FAILED' } }),
    );
  });
});
