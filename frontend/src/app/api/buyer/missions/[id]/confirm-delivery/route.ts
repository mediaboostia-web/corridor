// POST /api/buyer/missions/[id]/confirm-delivery — the buyer confirms
// receipt (F19/US9). Only allowed once the mission has reached the last
// agent-settable status for its fulfillment type (EXPEDIE for STANDARD,
// ACHETE for INSTANTANE — see lib/mission-status.ts). Sets status LIVRE +
// deliveryConfirmedAt, records a final
// MissionStatusEvent authored by the buyer (schema's documented exception
// to "normally the agent"), and increments AgentProfile.missionCount in
// the same transaction — the schema's denormalization comment calls this
// out explicitly ("recomputed on ... Mission completion").
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { verifyCsrf } from '@/lib/server/auth';
import { requireMarketplaceRole } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { createNotification } from '@/lib/server/notifications';
import { missionStatusChanged } from '@/lib/server/notifications/templates';
import { MISSION_STATUS_LABEL, isAwaitingBuyerConfirmation } from '@/lib/mission-status';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

type Discriminator =
  | { kind: 'NOT_FOUND' }
  | { kind: 'NOT_READY' }
  | {
      kind: 'OK';
      mission: { id: string; status: string };
      agentUserId: string;
      requestTitle: string;
    };

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const reqCtx = makeRequestContext(req.headers);
  return withRequestContext(reqCtx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireMarketplaceRole('BUYER');
    if (auth instanceof NextResponse) return auth;

    const { id } = await ctx.params;
    const deliveryConfirmedAt = new Date();

    const result: Discriminator = await prisma.$transaction(async (tx) => {
      const mission = await tx.mission.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          buyerId: true,
          agentProfileId: true,
          fulfillmentType: true,
          agentProfile: { select: { userId: true } },
          sourcingRequest: { select: { title: true } },
        },
      });
      if (!mission || mission.buyerId !== auth.user.sub) {
        return { kind: 'NOT_FOUND' as const };
      }
      if (!isAwaitingBuyerConfirmation(mission.status, mission.fulfillmentType)) {
        return { kind: 'NOT_READY' as const };
      }

      const updated = await tx.mission.update({
        where: { id },
        data: { status: 'LIVRE', deliveryConfirmedAt },
        select: { id: true, status: true },
      });

      await tx.missionStatusEvent.create({
        data: { missionId: id, status: 'LIVRE', createdByUserId: auth.user.sub },
      });

      await tx.agentProfile.update({
        where: { id: mission.agentProfileId },
        data: { missionCount: { increment: 1 } },
      });

      return {
        kind: 'OK' as const,
        mission: updated,
        agentUserId: mission.agentProfile.userId,
        requestTitle: mission.sourcingRequest.title,
      };
    });

    if (result.kind === 'NOT_FOUND') {
      return NextResponse.json({ error: 'MISSION_NOT_FOUND' }, { status: 404 });
    }
    if (result.kind === 'NOT_READY') {
      return NextResponse.json({ error: 'MISSION_NOT_READY_FOR_CONFIRMATION' }, { status: 409 });
    }

    try {
      await createNotification(
        prisma,
        missionStatusChanged(
          result.agentUserId,
          result.mission.id,
          result.mission.status,
          MISSION_STATUS_LABEL.LIVRE,
          result.requestTitle,
        ),
      );
    } catch {
      // Best-effort — the confirmation is already committed.
    }

    return NextResponse.json(
      { mission: result.mission },
      { headers: { 'x-request-id': reqCtx.requestId } },
    );
  });
}
