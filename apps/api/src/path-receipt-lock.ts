import type { Prisma, PrismaClient } from "@prisma/client";

type PathReceiptDb = Pick<PrismaClient, "$transaction" | "$executeRaw">;
type PathReceiptTx = Prisma.TransactionClient;

/**
 * Serialize correlation refresh (snapshot→pathEdge deleteMany→reattach) with
 * pathEdgeReceipt.create + recompute. Cascade deletes on path_edges would
 * otherwise wipe receipts created after the refresh snapshot.
 */
export function pathEdgeReceiptLockKey(pathId: string): string {
  return `path-edge-receipts:${pathId}`;
}

export async function withPathEdgeReceiptLock<T>(
  db: PathReceiptDb,
  pathId: string,
  run: (tx: PathReceiptTx) => Promise<T>
): Promise<T> {
  const lockKey = pathEdgeReceiptLockKey(pathId);
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      return run(tx);
    },
    {
      maxWait: 15_000,
      timeout: 60_000
    }
  );
}
