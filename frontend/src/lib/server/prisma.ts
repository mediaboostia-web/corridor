import { PrismaClient } from '@prisma/client';

declare global {
  // `var` is required for `declare global` to attach to globalThis.

  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__prisma ??
  new PrismaClient({
    // Default $transaction timeout (5s) / maxWait (2s) are too tight for a
    // pooled Neon connection under real network latency — raised to avoid
    // spurious P2028 "Transaction not found" on otherwise-correct code.
    transactionOptions: { timeout: 20000, maxWait: 10000 },
  });

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}
