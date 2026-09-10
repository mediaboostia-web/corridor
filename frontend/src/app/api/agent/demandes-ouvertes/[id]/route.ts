// GET /api/agent/demandes-ouvertes/[id] — single sourcing-request detail
// for the agent's "Candidater" prefill page. Not restricted to OPEN status
// (an agent who already candidated may want to review a request that has
// since moved on) — the caller's own candidature status/id is included so
// the UI can show its outcome or disable the "Candidater" action.
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { requireMarketplaceRole } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { resolveMediaUrls } from '@/lib/server/marketplace/media';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const reqCtx = makeRequestContext(req.headers);
  return withRequestContext(reqCtx, async () => {
    const auth = await requireMarketplaceRole('AGENT');
    if (auth instanceof NextResponse) return auth;

    const agentProfile = await prisma.agentProfile.findUnique({
      where: { userId: auth.user.sub },
      select: { id: true },
    });
    if (!agentProfile) {
      return NextResponse.json({ error: 'PROFILE_NOT_FOUND' }, { status: 404 });
    }

    const { id } = await ctx.params;
    const request = await prisma.sourcingRequest.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        tiktokLink: true,
        facebookLink: true,
        budgetAmount: true,
        currency: true,
        quantity: true,
        deliveryCountry: true,
        status: true,
        createdAt: true,
        product: {
          select: {
            id: true,
            name: true,
            wholesalerProfile: { select: { shopName: true, slug: true } },
          },
        },
        media: {
          select: { fileUploadId: true, position: true },
          orderBy: { position: 'asc' },
        },
      },
    });
    if (!request) {
      return NextResponse.json({ error: 'REQUEST_NOT_FOUND' }, { status: 404 });
    }

    const myCandidature = await prisma.candidature.findUnique({
      where: {
        sourcingRequestId_agentProfileId: {
          sourcingRequestId: id,
          agentProfileId: agentProfile.id,
        },
      },
      select: { id: true, status: true },
    });

    const urls = await resolveMediaUrls(request.media.map((m) => m.fileUploadId));

    return NextResponse.json(
      {
        request: {
          id: request.id,
          title: request.title,
          description: request.description,
          tiktokLink: request.tiktokLink,
          facebookLink: request.facebookLink,
          budgetAmount: request.budgetAmount,
          currency: request.currency,
          quantity: request.quantity,
          deliveryCountry: request.deliveryCountry,
          status: request.status,
          createdAt: request.createdAt,
          product: request.product
            ? {
                id: request.product.id,
                name: request.product.name,
                wholesalerShopName: request.product.wholesalerProfile?.shopName ?? null,
                wholesalerSlug: request.product.wholesalerProfile?.slug ?? null,
              }
            : null,
          media: request.media.map((m) => ({ url: urls.get(m.fileUploadId) ?? null })),
          myCandidatureId: myCandidature?.id ?? null,
          myCandidatureStatus: myCandidature?.status ?? null,
        },
      },
      { headers: { 'x-request-id': reqCtx.requestId } },
    );
  });
}
