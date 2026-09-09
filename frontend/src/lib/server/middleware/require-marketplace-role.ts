/**
 * Corridor Sourcing marketplace role type — orthogonal to the admin-tier
 * `AdminRole` (`User.role`). Gates BUYER/AGENT/WHOLESALER routes via
 * `User.marketplaceRole`.
 *
 * The gate logic lives in `./index.ts` (`requireMarketplaceRole`,
 * `requireAnyMarketplaceRole`, `requireVerifiedAgent`) — this file only
 * exports the role type, mirroring `require-admin.ts` / `require-org-role.ts`.
 */
import 'server-only';

export type MarketplaceRole = 'BUYER' | 'AGENT' | 'WHOLESALER';
