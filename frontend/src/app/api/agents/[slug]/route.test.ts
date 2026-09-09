// GET /api/agents/[slug] — public agent profile, VERIFIED-only.
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies } from '@/test-utils/mock-cookies';
import { it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

mockNextCookies();

function req(slug: string): NextRequest {
  return new NextRequest(`http://localhost/api/agents/${slug}`);
}
function ctx(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

it('returns 404 AGENT_NOT_FOUND for an unknown slug', async () => {
  prismaMock.agentProfile.findUnique.mockResolvedValue(null);
  const res = await GET(req('unknown'), ctx('unknown'));
  expect(res.status).toBe(404);
});

it('returns 404 AGENT_NOT_FOUND for a non-VERIFIED agent', async () => {
  prismaMock.agentProfile.findUnique.mockResolvedValue({
    id: 'agent-1',
    userId: 'user-1',
    displayName: 'Karim',
    bio: null,
    actionZone: 'Dantokpa',
    verificationStatus: 'PENDING',
    missionCount: 0,
    avgRating: null,
    reviewCount: 0,
    isSuspended: false,
    createdAt: new Date('2026-01-01'),
  } as never);
  const res = await GET(req('karim'), ctx('karim'));
  expect(res.status).toBe(404);
});

it('returns 404 AGENT_NOT_FOUND for a suspended agent', async () => {
  prismaMock.agentProfile.findUnique.mockResolvedValue({
    id: 'agent-1',
    userId: 'user-1',
    displayName: 'Karim',
    bio: null,
    actionZone: 'Dantokpa',
    verificationStatus: 'VERIFIED',
    missionCount: 5,
    avgRating: 4.5,
    reviewCount: 5,
    isSuspended: true,
    createdAt: new Date('2026-01-01'),
  } as never);
  const res = await GET(req('karim'), ctx('karim'));
  expect(res.status).toBe(404);
});

it('returns the public profile for a VERIFIED, non-suspended agent', async () => {
  prismaMock.agentProfile.findUnique.mockResolvedValue({
    id: 'agent-1',
    userId: 'user-1',
    displayName: 'Karim',
    bio: 'Agent sourcing à Cotonou.',
    actionZone: 'Dantokpa',
    verificationStatus: 'VERIFIED',
    missionCount: 5,
    avgRating: 4.5,
    reviewCount: 5,
    isSuspended: false,
    createdAt: new Date('2026-01-01'),
  } as never);
  prismaMock.review.findMany.mockResolvedValue([
    { id: 'review-1', rating: 5, comment: 'Super rapide !', createdAt: new Date('2026-01-05') },
  ] as never);
  prismaMock.proSubscription.findUnique.mockResolvedValue(null);
  const res = await GET(req('karim'), ctx('karim'));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.profile).toMatchObject({
    displayName: 'Karim',
    missionCount: 5,
    avgRating: 4.5,
    isPro: false,
  });
  expect(body.profile.idFrontUrl).toBeUndefined();
  expect(prismaMock.review.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { agentProfileId: 'agent-1' } }),
  );
  expect(body.reviews).toEqual([
    { id: 'review-1', rating: 5, comment: 'Super rapide !', createdAt: '2026-01-05T00:00:00.000Z' },
  ]);
});

it('marks isPro true when the agent has an ACTIVE ProSubscription', async () => {
  prismaMock.agentProfile.findUnique.mockResolvedValue({
    id: 'agent-1',
    userId: 'user-1',
    displayName: 'Karim',
    bio: 'Agent sourcing à Cotonou.',
    actionZone: 'Dantokpa',
    verificationStatus: 'VERIFIED',
    missionCount: 5,
    avgRating: 4.5,
    reviewCount: 5,
    isSuspended: false,
    createdAt: new Date('2026-01-01'),
  } as never);
  prismaMock.review.findMany.mockResolvedValue([]);
  prismaMock.proSubscription.findUnique.mockResolvedValue({ status: 'ACTIVE' } as never);
  const res = await GET(req('karim'), ctx('karim'));
  const body = await res.json();
  expect(body.profile.isPro).toBe(true);
  expect(prismaMock.proSubscription.findUnique).toHaveBeenCalledWith(
    expect.objectContaining({ where: { userId: 'user-1' } }),
  );
});
