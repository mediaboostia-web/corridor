// GET/POST /api/agent/verification — Phase 3 identity verification
// submission. `actionZone` is collected here (together with the 3 ID
// photos) rather than in /api/agent/profile because admins review it
// alongside the KYC documents as one submission — see the schema comment
// on AgentProfile.actionZone.
//
// verificationStatus lifecycle: UNVERIFIED -> (submit) -> PENDING ->
// (admin) -> VERIFIED | REJECTED. REJECTED (like UNVERIFIED) allows
// resubmission — see POST /api/admin/agents/[id]/reject for the admin half.
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireMarketplaceRole } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { resolveMediaUrls } from '@/lib/server/marketplace/media';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const VERIFICATION_SELECT = {
  verificationStatus: true,
  actionZone: true,
  idFrontUploadId: true,
  idBackUploadId: true,
  selfieUploadId: true,
  verificationSubmittedAt: true,
  verificationReviewedAt: true,
  verificationRejectionReason: true,
} as const;

async function serialize(profile: {
  verificationStatus: string;
  actionZone: string | null;
  idFrontUploadId: string | null;
  idBackUploadId: string | null;
  selfieUploadId: string | null;
  verificationSubmittedAt: Date | null;
  verificationReviewedAt: Date | null;
  verificationRejectionReason: string | null;
}) {
  const ids = [profile.idFrontUploadId, profile.idBackUploadId, profile.selfieUploadId].filter(
    (id): id is string => id !== null,
  );
  const urls = await resolveMediaUrls(ids);
  return {
    verificationStatus: profile.verificationStatus,
    actionZone: profile.actionZone,
    idFrontUrl: profile.idFrontUploadId ? (urls.get(profile.idFrontUploadId) ?? null) : null,
    idBackUrl: profile.idBackUploadId ? (urls.get(profile.idBackUploadId) ?? null) : null,
    selfieUrl: profile.selfieUploadId ? (urls.get(profile.selfieUploadId) ?? null) : null,
    submittedAt: profile.verificationSubmittedAt,
    reviewedAt: profile.verificationReviewedAt,
    rejectionReason: profile.verificationRejectionReason,
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireMarketplaceRole('AGENT');
    if (auth instanceof NextResponse) return auth;

    const profile = await prisma.agentProfile.findUnique({
      where: { userId: auth.user.sub },
      select: VERIFICATION_SELECT,
    });
    if (!profile) {
      return NextResponse.json({ error: 'PROFILE_NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json(
      { verification: await serialize(profile) },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}

const Body = z.object({
  actionZone: z.string().trim().min(2).max(200),
  idFrontUploadId: z.string(),
  idBackUploadId: z.string(),
  selfieUploadId: z.string(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireMarketplaceRole('AGENT');
    if (auth instanceof NextResponse) return auth;

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'VALIDATION_FAILED' }, { status: 400 });
    }

    const profile = await prisma.agentProfile.findUnique({
      where: { userId: auth.user.sub },
      select: { id: true, verificationStatus: true },
    });
    if (!profile) {
      return NextResponse.json({ error: 'PROFILE_NOT_FOUND' }, { status: 404 });
    }
    if (profile.verificationStatus === 'PENDING') {
      return NextResponse.json({ error: 'VERIFICATION_PENDING' }, { status: 409 });
    }
    if (profile.verificationStatus === 'VERIFIED') {
      return NextResponse.json({ error: 'ALREADY_VERIFIED' }, { status: 409 });
    }

    const { actionZone, idFrontUploadId, idBackUploadId, selfieUploadId } = parsed.data;
    const uploadIds = [idFrontUploadId, idBackUploadId, selfieUploadId];
    const owned = await prisma.fileUpload.count({
      where: { id: { in: uploadIds }, userId: auth.user.sub },
    });
    if (owned !== new Set(uploadIds).size) {
      return NextResponse.json({ error: 'UPLOAD_NOT_FOUND' }, { status: 400 });
    }

    const updated = await prisma.agentProfile.update({
      where: { userId: auth.user.sub },
      data: {
        actionZone,
        idFrontUploadId,
        idBackUploadId,
        selfieUploadId,
        verificationStatus: 'PENDING',
        verificationSubmittedAt: new Date(),
        verificationReviewedAt: null,
        verificationReviewerId: null,
        verificationRejectionReason: null,
      },
      select: VERIFICATION_SELECT,
    });

    return NextResponse.json(
      { verification: await serialize(updated) },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
