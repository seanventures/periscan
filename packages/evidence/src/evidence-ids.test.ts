import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  appendEvidenceIdsAtomically,
  evidenceIdsLockKey,
  unionEvidenceIds,
  withEvidenceIdsAppendLock,
  type EvidenceIdDb
} from "./evidence-ids";

describe("unionEvidenceIds", () => {
  it("dedupes and ignores empty/null entries", () => {
    const a = randomUUID();
    const b = randomUUID();

    expect(unionEvidenceIds([a, a], b, null, undefined, ["", b])).toEqual([
      a,
      b
    ]);
  });
});

describe("atomic evidenceIds append", () => {
  it("takes a per-entity advisory lock before mutating", async () => {
    const executeRaw = vi.fn(async () => undefined);
    const db = {
      async $transaction<T>(fn: (tx: never) => Promise<T>) {
        return fn({ $executeRaw: executeRaw } as never);
      }
    } satisfies EvidenceIdDb;

    const result = await withEvidenceIdsAppendLock(
      db,
      "validation_runs",
      "run-1",
      async () => "ok"
    );

    expect(result).toBe("ok");
    expect(executeRaw).toHaveBeenCalledTimes(1);
    const call = executeRaw.mock.calls[0] as unknown as
      | [TemplateStringsArray, string]
      | undefined;
    expect(call?.[0]?.join("") ?? "").toContain("pg_advisory_xact_lock");
    expect(call?.[1]).toBe(evidenceIdsLockKey("validation_runs", "run-1"));
  });

  it("unions concurrent appends under the lock instead of last-writer-wins", async () => {
    const entityId = randomUUID();
    const existingId = randomUUID();
    const firstId = randomUUID();
    const secondId = randomUUID();
    let stored: string[] = [existingId];
    let active = 0;
    let maxActive = 0;
    const waiters: Array<() => void> = [];

    const db = {
      async $transaction<T>(fn: (tx: never) => Promise<T>) {
        // Simulate advisory-lock serialization: only one txn runs at a time.
        if (active > 0) {
          await new Promise<void>((resolve) => waiters.push(resolve));
        }
        active += 1;
        maxActive = Math.max(maxActive, active);
        try {
          return await fn({
            async $executeRaw() {
              return undefined;
            },
            async $executeRawUnsafe(
              _sql: string,
              next: string[],
              _entityId: string
            ) {
              stored = next;
              return 1;
            },
            async $queryRawUnsafe() {
              // Yield so the second caller queues behind the lock.
              await Promise.resolve();
              return [{ evidence_ids: [...stored] }];
            }
          } as never);
        } finally {
          active -= 1;
          const next = waiters.shift();
          next?.();
        }
      }
    } satisfies EvidenceIdDb;

    await Promise.all([
      appendEvidenceIdsAtomically(db, "ValidationRun", entityId, firstId),
      appendEvidenceIdsAtomically(db, "ValidationRun", entityId, secondId)
    ]);

    expect(maxActive).toBe(1);
    expect(stored.sort()).toEqual([existingId, firstId, secondId].sort());
  });

  it("throws when the target entity row is missing", async () => {
    const db = {
      async $transaction<T>(fn: (tx: never) => Promise<T>) {
        return fn({
          async $executeRaw() {
            return undefined;
          },
          async $queryRawUnsafe() {
            return [];
          }
        } as never);
      }
    } satisfies EvidenceIdDb;

    await expect(
      appendEvidenceIdsAtomically(
        db,
        "EvidencePack",
        randomUUID(),
        randomUUID()
      )
    ).rejects.toThrow(/EvidencePack not found/);
  });
});
