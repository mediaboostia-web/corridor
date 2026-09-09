// Shared (client + server) Mission status pipeline. Forward-only: the agent
// drives the agent-settable statuses one at a time via
// POST /api/agent/missions/[id]/status (no client-specified target — the
// server always computes "next", so the transition can never be forged to
// skip a step). The buyer closes the loop
// (POST /api/buyer/missions/[id]/confirm-delivery); AUTO_LIVRE only by the
// mission-auto-deliver cron after 14 days of buyer inaction (US9). LITIGE
// exists in the schema for a future dispute flow — not reachable in v1.
//
// Two fulfillment types share this pipeline (agent's choice at candidature
// time, default STANDARD — see Candidature.fulfillmentType /
// Mission.fulfillmentType):
//   STANDARD   — full 5-step sequence, buyer confirms at EXPEDIE. For
//                sourcing shipped over distance.
//   INSTANTANE — stops at ACHETE, buyer confirms there. EMBALLE/EXPEDIE
//                don't apply to a same-day, hand-to-hand local errand.
export const MISSION_FULFILLMENT_TYPES = ['STANDARD', 'INSTANTANE'] as const;
export type MissionFulfillmentType = (typeof MISSION_FULFILLMENT_TYPES)[number];

export const MISSION_FULFILLMENT_TYPE_LABEL: Record<MissionFulfillmentType, string> = {
  STANDARD: 'Standard (emballage + expédition)',
  INSTANTANE: 'Instantané (remise en main propre)',
};

export const MISSION_FULFILLMENT_TYPE_DESCRIPTION: Record<MissionFulfillmentType, string> = {
  STANDARD: "J'achète, j'emballe et j'expédie — pour une livraison à distance.",
  INSTANTANE: 'Je récupère et je remets en main propre le jour même, sans emballage ni expédition.',
};

export type MissionAgentStatus = 'RECU' | 'EN_ACHAT' | 'ACHETE' | 'EMBALLE' | 'EXPEDIE';
export type MissionStatus = MissionAgentStatus | 'LIVRE' | 'AUTO_LIVRE' | 'LITIGE';

export const MISSION_AGENT_STATUS_ORDER: Record<MissionFulfillmentType, MissionAgentStatus[]> = {
  STANDARD: ['RECU', 'EN_ACHAT', 'ACHETE', 'EMBALLE', 'EXPEDIE'],
  INSTANTANE: ['RECU', 'EN_ACHAT', 'ACHETE'],
};

export const MISSION_STATUS_LABEL: Record<MissionStatus, string> = {
  RECU: 'Reçu',
  EN_ACHAT: 'En achat',
  ACHETE: 'Acheté',
  EMBALLE: 'Emballé',
  EXPEDIE: 'Expédié',
  LIVRE: 'Livré',
  AUTO_LIVRE: 'Livré (auto-confirmé)',
  LITIGE: 'Litige',
};

function orderFor(fulfillmentType: string): MissionAgentStatus[] {
  return (
    MISSION_AGENT_STATUS_ORDER[fulfillmentType as MissionFulfillmentType] ??
    MISSION_AGENT_STATUS_ORDER.STANDARD
  );
}

/**
 * Next agent-settable status after `current` for the given fulfillment type,
 * or null if none remain (the last agent status for that type, or a
 * terminal state). `fulfillmentType` defaults to STANDARD so existing
 * single-arg call sites (and their fixture data predating this field) keep
 * their original behavior.
 */
export function nextAgentStatus(
  current: string,
  fulfillmentType: string = 'STANDARD',
): MissionAgentStatus | null {
  const order = orderFor(fulfillmentType);
  const idx = order.indexOf(current as MissionAgentStatus);
  if (idx === -1 || idx === order.length - 1) return null;
  return order[idx + 1] as MissionAgentStatus;
}

/** The last agent-settable status for a fulfillment type — where the buyer's confirm-delivery takes over. */
export function lastAgentStatus(fulfillmentType: string = 'STANDARD'): MissionAgentStatus {
  const order = orderFor(fulfillmentType);
  return order[order.length - 1] as MissionAgentStatus;
}

/** True once a mission has reached the status where only the buyer (or the auto-deliver cron) can close it. */
export function isAwaitingBuyerConfirmation(
  status: string,
  fulfillmentType: string = 'STANDARD',
): boolean {
  return status === lastAgentStatus(fulfillmentType);
}

export function isTerminalMissionStatus(status: string): boolean {
  return status === 'LIVRE' || status === 'AUTO_LIVRE' || status === 'LITIGE';
}
