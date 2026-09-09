// Resolve a batch of User ids to a display label + public profile link,
// role-dependent. Used by the conversation list/find-or-create routes
// (Phase 5 — messagerie) to show "who is this conversation with" without
// each caller re-deriving the AGENT/WHOLESALER/BUYER branching.
import 'server-only';
import { prisma } from '@/lib/server/prisma';

export interface ParticipantInfo {
  userId: string;
  marketplaceRole: string | null;
  label: string;
  href: string | null;
}

export async function resolveParticipants(
  userIds: string[],
): Promise<Map<string, ParticipantInfo>> {
  const uniqueIds = [...new Set(userIds)];
  if (!uniqueIds.length) return new Map();

  const users = await prisma.user.findMany({
    where: { id: { in: uniqueIds } },
    select: {
      id: true,
      email: true,
      marketplaceRole: true,
      agentProfile: { select: { displayName: true, publicSlug: true } },
      wholesalerProfile: { select: { shopName: true, slug: true } },
      buyerProfile: { select: { fullName: true } },
    },
  });

  const map = new Map<string, ParticipantInfo>();
  for (const u of users) {
    let label = u.email;
    let href: string | null = null;
    if (u.marketplaceRole === 'AGENT' && u.agentProfile) {
      label = u.agentProfile.displayName;
      href = `/agents/${u.agentProfile.publicSlug}`;
    } else if (u.marketplaceRole === 'WHOLESALER' && u.wholesalerProfile) {
      label = u.wholesalerProfile.shopName;
      href = `/boutiques/${u.wholesalerProfile.slug}`;
    } else if (u.marketplaceRole === 'BUYER') {
      label = u.buyerProfile?.fullName ?? 'Acheteur';
    }
    map.set(u.id, { userId: u.id, marketplaceRole: u.marketplaceRole, label, href });
  }
  return map;
}
