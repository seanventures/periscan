import type { Prisma, PrismaClient } from "@prisma/client";

type MissionAggregateDb = Pick<PrismaClient, "$transaction" | "$executeRaw">;
type MissionAggregateTx = Prisma.TransactionClient;

/**
 * Serialize sibling-run reads + mission status/evidence updates across concurrent
 * runner result submits and reapers. Without this, two hybrid tasks completing
 * in parallel can each miss the other's committed run and leave the mission
 * stuck Running with partial evidenceIds.
 */
export function missionRunAggregateLockKey(missionId: string): string {
  return `mission-run-aggregate:${missionId}`;
}

export async function withMissionRunAggregateLock<T>(
  db: MissionAggregateDb,
  missionId: string,
  run: (tx: MissionAggregateTx) => Promise<T>
): Promise<T> {
  const lockKey = missionRunAggregateLockKey(missionId);
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
