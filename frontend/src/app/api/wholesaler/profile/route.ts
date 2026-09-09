// GET/PATCH /api/wholesaler/profile — the authed WHOLESALER's own shop
// profile (Phase 1 "Ma boutique"). `slug` is intentionally NOT editable here
// — it's the public URL (/boutiques/[slug]) set once at role choice; keeping
// it stable avoids broken links. Logo/cover are FileUpload ids uploaded via
// the existing POST /api/upload route; this handler resolves them to
// Cloudinary URLs on read.
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireMarketplaceRole } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { stripUndefined } from '@/lib/server/object-utils';
import { cloudinaryImageUrl } from '@/lib/server/upload/cloudinary-client';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const PROFILE_SELECT = {
  id: true,
  shopName: true,
  slug: true,
  logoUploadId: true,
  coverUploadId: true,
  description: true,
  locationCity: true,
  locationDetail: true,
  hours: true,
  whatsappLink: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

async function resolveImageUrls<
  T extends { logoUploadId: string | null; coverUploadId: string | null },
>(profile: T): Promise<T & { logoUrl: string | null; coverUrl: string | null }> {
  const ids = [profile.logoUploadId, profile.coverUploadId].filter(
    (id): id is string => id !== null,
  );
  const uploads = ids.length
    ? await prisma.fileUpload.findMany({
        where: { id: { in: ids } },
        select: { id: true, key: true },
      })
    : [];
  const keyById = new Map(uploads.map((u) => [u.id, u.key]));
  const urlFor = (uploadId: string | null): string | null => {
    if (!uploadId) return null;
    const key = keyById.get(uploadId);
    return key ? cloudinaryImageUrl(key) : null;
  };
  return {
    ...profile,
    logoUrl: urlFor(profile.logoUploadId),
    coverUrl: urlFor(profile.coverUploadId),
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireMarketplaceRole('WHOLESALER');
    if (auth instanceof NextResponse) return auth;

    const profile = await prisma.wholesalerProfile.findUnique({
      where: { userId: auth.user.sub },
      select: PROFILE_SELECT,
    });
    if (!profile) {
      return NextResponse.json({ error: 'PROFILE_NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json(
      { profile: await resolveImageUrls(profile) },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}

const Body = z.object({
  shopName: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  locationCity: z.string().trim().min(1).max(120).optional(),
  locationDetail: z.string().trim().max(200).nullable().optional(),
  hours: z.string().trim().max(200).nullable().optional(),
  whatsappLink: z.string().trim().max(300).nullable().optional(),
  logoUploadId: z.string().nullable().optional(),
  coverUploadId: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireMarketplaceRole('WHOLESALER');
    if (auth instanceof NextResponse) return auth;

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'VALIDATION_FAILED' }, { status: 400 });
    }

    const existing = await prisma.wholesalerProfile.findUnique({
      where: { userId: auth.user.sub },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'PROFILE_NOT_FOUND' }, { status: 404 });
    }

    // Ownership check for referenced uploads — a user must not point their
    // shop's logo/cover at another user's private FileUpload row.
    const uploadIds = [parsed.data.logoUploadId, parsed.data.coverUploadId].filter(
      (id): id is string => typeof id === 'string',
    );
    if (uploadIds.length) {
      const owned = await prisma.fileUpload.count({
        where: { id: { in: uploadIds }, userId: auth.user.sub },
      });
      if (owned !== uploadIds.length) {
        return NextResponse.json({ error: 'UPLOAD_NOT_FOUND' }, { status: 400 });
      }
    }

    const updated = await prisma.wholesalerProfile.update({
      where: { userId: auth.user.sub },
      data: stripUndefined(parsed.data),
      select: PROFILE_SELECT,
    });

    return NextResponse.json(
      { profile: await resolveImageUrls(updated) },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
