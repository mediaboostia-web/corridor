// Small generic helper — not project-specific enough to belong in
// zod-helpers.ts (protected). Needed because `exactOptionalPropertyTypes`
// rejects `{ name?: string }` = `{ name: string | undefined }`: a Zod
// `.optional()` field's inferred type includes an explicit `undefined`,
// which Prisma's generated `*UpdateInput` types (built for
// exactOptionalPropertyTypes) don't accept. Stripping undefined-valued keys
// before spreading into `data:` satisfies both "field omitted" (Prisma
// leaves it unchanged) and the strict type.
export function stripUndefined<T extends Record<string, unknown>>(
  obj: T,
): { [K in keyof T]: Exclude<T[K], undefined> } {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key] = value;
  }
  return out as { [K in keyof T]: Exclude<T[K], undefined> };
}
