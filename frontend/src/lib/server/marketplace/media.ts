// Shared helper — resolve a batch of FileUpload ids to their Cloudinary
// delivery URLs in a single query. Used by every route that renders
// product/shop images (ProductMedia, WholesalerProfile logo/cover, …).
import 'server-only';
import { prisma } from '@/lib/server/prisma';
import { cloudinaryImageUrl } from '@/lib/server/upload/cloudinary-client';

export async function resolveMediaUrls(
  fileUploadIds: string[],
  opts?: { width?: number },
): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(fileUploadIds)];
  if (!uniqueIds.length) return new Map();
  const uploads = await prisma.fileUpload.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, key: true },
  });
  return new Map(uploads.map((u) => [u.id, cloudinaryImageUrl(u.key, opts)]));
}
