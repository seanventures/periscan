/**
 * HTTP Idempotency-Key support for core proof-loop POSTs (P20-7).
 *
 * Clients may send `Idempotency-Key` (or `idempotency-key`) on selected POSTs.
 * On first request we execute the handler and store status + body under
 * (tenantId, route, key) with a hash of the canonical request body. Replays
 * with the same key + same body return the stored response. Same key with a
 * different body → 409 `idempotency_key_conflict`.
 *
 * Keys are optional: omit the header for legacy non-idempotent behavior.
 * Storage is in-process by default (tests + single-node); production can swap
 * in a Prisma-backed store once the migration is applied.
 */

import { createHash } from "node:crypto";

import { AppServiceError } from "./runtime-services.js";

export const IDEMPOTENCY_HEADER = "idempotency-key";
/** Max age for in-memory records (24h). */
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
/** Key length bounds (Stripe-like). */
export const IDEMPOTENCY_KEY_MIN = 8;
export const IDEMPOTENCY_KEY_MAX = 200;

export type StoredIdempotentResponse = {
  bodyHash: string;
  createdAtMs: number;
  responseBody: string;
  statusCode: number;
};

export type IdempotencyLookup =
  | { kind: "miss" }
  | { kind: "hit"; record: StoredIdempotentResponse }
  | { kind: "conflict"; reason: string };

export interface IdempotencyStore {
  get(
    tenantId: string,
    route: string,
    key: string
  ): Promise<StoredIdempotentResponse | null>;
  /**
   * Insert if absent. Returns `created` when this process owns the first write,
   * `exists` when another record already occupies the slot (caller should re-get).
   */
  putIfAbsent(
    tenantId: string,
    route: string,
    key: string,
    record: StoredIdempotentResponse
  ): Promise<"created" | "exists">;
}

function storageKey(tenantId: string, route: string, key: string): string {
  return `${tenantId}\0${route}\0${key}`;
}

/**
 * In-process store. Suitable for unit tests and single-node dev.
 * Multi-instance production should use a durable store (Prisma table).
 */
export function createMemoryIdempotencyStore(
  options: { ttlMs?: number; now?: () => number } = {}
): IdempotencyStore {
  const ttlMs = options.ttlMs ?? IDEMPOTENCY_TTL_MS;
  const now = options.now ?? (() => Date.now());
  const map = new Map<string, StoredIdempotentResponse>();

  function purgeExpired(asOf: number) {
    for (const [k, v] of map) {
      if (asOf - v.createdAtMs > ttlMs) {
        map.delete(k);
      }
    }
  }

  return {
    async get(tenantId, route, key) {
      const asOf = now();
      purgeExpired(asOf);
      const hit = map.get(storageKey(tenantId, route, key));
      if (!hit) return null;
      if (asOf - hit.createdAtMs > ttlMs) {
        map.delete(storageKey(tenantId, route, key));
        return null;
      }
      return hit;
    },
    async putIfAbsent(tenantId, route, key, record) {
      const asOf = now();
      purgeExpired(asOf);
      const sk = storageKey(tenantId, route, key);
      if (map.has(sk)) {
        return "exists";
      }
      map.set(sk, record);
      return "created";
    }
  };
}

/** Stable hash of JSON body (sorted object keys at top level via JSON.stringify of already-parsed value). */
export function canonicalBodyHash(body: unknown): string {
  const canonical =
    body === undefined || body === null
      ? ""
      : typeof body === "string"
        ? body
        : JSON.stringify(body);
  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Parse Idempotency-Key header. Returns null when absent (caller proceeds
 * without idempotency). Throws AppServiceError on malformed values.
 */
export function parseIdempotencyKey(
  header: string | string[] | undefined
): string | null {
  if (header === undefined || header === null) {
    return null;
  }
  const raw = Array.isArray(header) ? header[0] : header;
  if (raw === undefined) {
    return null;
  }
  const key = raw.trim();
  if (key.length === 0) {
    return null;
  }
  if (key.length < IDEMPOTENCY_KEY_MIN || key.length > IDEMPOTENCY_KEY_MAX) {
    throw new AppServiceError(
      `Idempotency-Key must be between ${IDEMPOTENCY_KEY_MIN} and ${IDEMPOTENCY_KEY_MAX} characters.`,
      400,
      "idempotency_key_invalid"
    );
  }
  // Printable ASCII without control chars (automation-friendly).
  if (!/^[\x21-\x7E]+$/u.test(key)) {
    throw new AppServiceError(
      "Idempotency-Key must be printable ASCII without spaces.",
      400,
      "idempotency_key_invalid"
    );
  }
  return key;
}

export function readIdempotencyKeyFromRequest(headers: {
  [key: string]: string | string[] | undefined;
}): string | null {
  // Node lowercases header names; accept both spellings defensively.
  return parseIdempotencyKey(
    headers[IDEMPOTENCY_HEADER] ?? headers["Idempotency-Key"]
  );
}

export type IdempotentExecutionResult<T> = {
  body: T;
  replayed: boolean;
  statusCode: number;
};

/**
 * Run `execute` under an optional Idempotency-Key. When `key` is null, runs
 * once with no storage. When present, returns the first successful (or error
 * status) response for replays with the same body hash.
 */
export async function withIdempotencyKey<T>(input: {
  store: IdempotencyStore;
  tenantId: string;
  route: string;
  key: string | null;
  body: unknown;
  execute: () => Promise<{ statusCode: number; body: T }>;
}): Promise<IdempotentExecutionResult<T>> {
  if (!input.key) {
    const result = await input.execute();
    return { ...result, replayed: false };
  }

  const bodyHash = canonicalBodyHash(input.body);
  const existing = await input.store.get(
    input.tenantId,
    input.route,
    input.key
  );
  if (existing) {
    if (existing.bodyHash !== bodyHash) {
      throw new AppServiceError(
        "This Idempotency-Key is already bound to a different request body.",
        409,
        "idempotency_key_conflict"
      );
    }
    return {
      body: JSON.parse(existing.responseBody) as T,
      replayed: true,
      statusCode: existing.statusCode
    };
  }

  const result = await input.execute();
  // Only cache successful and client-success-shaped responses (2xx/3xx).
  // Do not cache 5xx so clients can safely retry after server faults.
  if (result.statusCode >= 200 && result.statusCode < 500) {
    const record: StoredIdempotentResponse = {
      bodyHash,
      createdAtMs: Date.now(),
      responseBody: JSON.stringify(result.body),
      statusCode: result.statusCode
    };
    const put = await input.store.putIfAbsent(
      input.tenantId,
      input.route,
      input.key,
      record
    );
    if (put === "exists") {
      // Race: another concurrent request stored first — re-read and validate.
      const winner = await input.store.get(
        input.tenantId,
        input.route,
        input.key
      );
      if (winner) {
        if (winner.bodyHash !== bodyHash) {
          throw new AppServiceError(
            "This Idempotency-Key is already bound to a different request body.",
            409,
            "idempotency_key_conflict"
          );
        }
        return {
          body: JSON.parse(winner.responseBody) as T,
          replayed: true,
          statusCode: winner.statusCode
        };
      }
    }
  }

  return { ...result, replayed: false };
}

/** Routes that honor Idempotency-Key (proof-loop automation pack). */
export const IDEMPOTENT_ROUTES = {
  createMission: "POST /api/v1/missions",
  startMission: "POST /api/v1/missions/:id/start",
  createRemediation: "POST /api/v1/remediations",
  verifyRemediation: "POST /api/v1/remediations/:id/verify",
  createScope: "POST /api/v1/scopes",
  createRemediationTicket: "POST /api/v1/remediations/:id/create-ticket"
} as const;

type PrismaIdempotencyClient = {
  apiIdempotencyRecord: {
    findUnique: (args: {
      where: {
        tenantId_route_idempotencyKey: {
          tenantId: string;
          route: string;
          idempotencyKey: string;
        };
      };
    }) => Promise<{
      bodyHash: string;
      createdAt: Date;
      expiresAt: Date;
      responseBody: string;
      statusCode: number;
    } | null>;
    create: (args: {
      data: {
        bodyHash: string;
        expiresAt: Date;
        idempotencyKey: string;
        responseBody: string;
        route: string;
        statusCode: number;
        tenantId: string;
      };
    }) => Promise<unknown>;
  };
};

/**
 * Durable store backed by `api_idempotency_records`. Use in multi-instance
 * deployments so retries across pods share the same first response.
 */
export function createPrismaIdempotencyStore(
  prisma: PrismaIdempotencyClient,
  options: { ttlMs?: number; now?: () => number } = {}
): IdempotencyStore {
  const ttlMs = options.ttlMs ?? IDEMPOTENCY_TTL_MS;
  const now = options.now ?? (() => Date.now());

  return {
    async get(tenantId, route, key) {
      const row = await prisma.apiIdempotencyRecord.findUnique({
        where: {
          tenantId_route_idempotencyKey: {
            tenantId,
            route,
            idempotencyKey: key
          }
        }
      });
      if (!row) return null;
      if (row.expiresAt.getTime() <= now()) {
        return null;
      }
      return {
        bodyHash: row.bodyHash,
        createdAtMs: row.createdAt.getTime(),
        responseBody: row.responseBody,
        statusCode: row.statusCode
      };
    },
    async putIfAbsent(tenantId, route, key, record) {
      try {
        await prisma.apiIdempotencyRecord.create({
          data: {
            bodyHash: record.bodyHash,
            expiresAt: new Date(record.createdAtMs + ttlMs),
            idempotencyKey: key,
            responseBody: record.responseBody,
            route,
            statusCode: record.statusCode,
            tenantId
          }
        });
        return "created";
      } catch (error) {
        // Unique violation → concurrent first-writer already stored.
        const code =
          error && typeof error === "object" && "code" in error
            ? String((error as { code: unknown }).code)
            : "";
        if (code === "P2002") {
          return "exists";
        }
        throw error;
      }
    }
  };
}
