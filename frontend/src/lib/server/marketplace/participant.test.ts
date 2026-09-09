import { prismaMock } from '@/test-utils/prisma-mock';
import { it, expect, vi, beforeEach } from 'vitest';
import { resolveParticipants } from './participant';

beforeEach(() => {
  vi.clearAllMocks();
});

it('returns an empty map for an empty input without querying the DB', async () => {
  const map = await resolveParticipants([]);
  expect(map.size).toBe(0);
  expect(prismaMock.user.findMany).not.toHaveBeenCalled();
});

it('de-duplicates ids before querying', async () => {
  prismaMock.user.findMany.mockResolvedValue([]);
  await resolveParticipants(['u1', 'u1', 'u1']);
  expect(prismaMock.user.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: { in: ['u1'] } } }),
  );
});

it('labels an AGENT with displayName + /agents/[slug] href', async () => {
  prismaMock.user.findMany.mockResolvedValue([
    {
      id: 'u1',
      email: 'karim@example.com',
      marketplaceRole: 'AGENT',
      agentProfile: { displayName: 'Karim', publicSlug: 'karim' },
      wholesalerProfile: null,
      buyerProfile: null,
    },
  ] as never);
  const map = await resolveParticipants(['u1']);
  expect(map.get('u1')).toEqual({
    userId: 'u1',
    marketplaceRole: 'AGENT',
    label: 'Karim',
    href: '/agents/karim',
  });
});

it('labels a WHOLESALER with shopName + /boutiques/[slug] href', async () => {
  prismaMock.user.findMany.mockResolvedValue([
    {
      id: 'u2',
      email: 'maridiath@example.com',
      marketplaceRole: 'WHOLESALER',
      agentProfile: null,
      wholesalerProfile: { shopName: 'Chez Maridiath', slug: 'chez-maridiath' },
      buyerProfile: null,
    },
  ] as never);
  const map = await resolveParticipants(['u2']);
  expect(map.get('u2')).toEqual({
    userId: 'u2',
    marketplaceRole: 'WHOLESALER',
    label: 'Chez Maridiath',
    href: '/boutiques/chez-maridiath',
  });
});

it('labels a BUYER with fullName (or a fallback) and no href', async () => {
  prismaMock.user.findMany.mockResolvedValue([
    {
      id: 'u3',
      email: 'jenni@example.com',
      marketplaceRole: 'BUYER',
      agentProfile: null,
      wholesalerProfile: null,
      buyerProfile: { fullName: 'Jenni' },
    },
    {
      id: 'u4',
      email: 'no-name@example.com',
      marketplaceRole: 'BUYER',
      agentProfile: null,
      wholesalerProfile: null,
      buyerProfile: null,
    },
  ] as never);
  const map = await resolveParticipants(['u3', 'u4']);
  expect(map.get('u3')).toEqual({
    userId: 'u3',
    marketplaceRole: 'BUYER',
    label: 'Jenni',
    href: null,
  });
  expect(map.get('u4')).toEqual({
    userId: 'u4',
    marketplaceRole: 'BUYER',
    label: 'Acheteur',
    href: null,
  });
});

it('falls back to the email when marketplaceRole is null', async () => {
  prismaMock.user.findMany.mockResolvedValue([
    {
      id: 'u5',
      email: 'ghost@example.com',
      marketplaceRole: null,
      agentProfile: null,
      wholesalerProfile: null,
      buyerProfile: null,
    },
  ] as never);
  const map = await resolveParticipants(['u5']);
  expect(map.get('u5')?.label).toBe('ghost@example.com');
});
