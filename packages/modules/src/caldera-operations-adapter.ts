import { randomUUID } from "node:crypto";
import { isIP } from "node:net";

import {
  assertCalderaAbilitiesAllowlisted,
  CalderaAdapterError,
  normalizeCalderaOperation,
  PINNED_CALDERA_API_VERSION,
  PINNED_CALDERA_OBFUSCATOR,
  PINNED_CALDERA_PLANNER_ID,
  PINNED_CALDERA_SOURCE_ID,
  type CalderaNormalizedOperation
} from "@periscan/shared";

export { CalderaAdapterError } from "@periscan/shared";

export type CalderaFetch = (
  input: string,
  init?: RequestInit
) => Promise<Response>;

export interface CalderaOperationsClientConfig {
  apiKey: string;
  baseUrl: string;
  fetchImpl?: CalderaFetch;
}

export interface CalderaCreateOperationInput {
  abilityIds: string[];
  name: string;
}

export interface CalderaCreateOperationResult {
  jobsQueued: 0;
  operationId: string;
  state: "paused";
}

export interface CalderaOperationsClient {
  cancelOperation(operationId: string): Promise<CalderaNormalizedOperation>;
  createOperation(
    input: CalderaCreateOperationInput
  ): Promise<CalderaCreateOperationResult>;
  ingestOperation(operationId: string): Promise<CalderaNormalizedOperation>;
  startOperation(operationId: string): Promise<{ state: "running" }>;
  stopOperation(operationId: string): Promise<{ state: "finished" }>;
}

function isLoopbackOrPrivateIpv4(host: string): boolean {
  const parts = host.split(".").map((part) => Number(part));
  const a = parts[0];
  const b = parts[1];
  if (
    a === undefined ||
    b === undefined ||
    parts.some((part) => Number.isNaN(part))
  ) {
    return false;
  }
  if (a === 127) {
    return true;
  }
  if (a === 10) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  return false;
}

function assertIsolatedCalderaBaseUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new CalderaAdapterError(
      "isolated_url_required",
      "Caldera base URL must be a valid http(s) URL for a customer-managed isolated instance."
    );
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new CalderaAdapterError(
      "isolated_url_required",
      "Caldera adapter only talks to customer-managed isolated http(s) endpoints."
    );
  }
  if (parsed.username || parsed.password) {
    throw new CalderaAdapterError(
      "isolated_url_required",
      "Caldera base URL must not embed credentials."
    );
  }
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/gu, "");
  if (
    host === "169.254.169.254" ||
    host === "metadata" ||
    host === "metadata.google.internal" ||
    host.endsWith(".mitre.org") ||
    host === "caldera.mitre.org"
  ) {
    throw new CalderaAdapterError(
      "isolated_url_required",
      "Caldera adapter refuses public, metadata, and non-isolated hosts."
    );
  }
  const isolatedName =
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".lab.test") ||
    host.endsWith(".internal");
  const isolatedIp =
    isIP(host) === 4 ? isLoopbackOrPrivateIpv4(host) : host === "::1";
  if (!isolatedName && !isolatedIp) {
    throw new CalderaAdapterError(
      "isolated_url_required",
      "Caldera adapter requires a customer-managed isolated host (loopback, RFC1918, localhost, *.lab.test, or *.internal)."
    );
  }
  return parsed;
}

function apiRoot(baseUrl: URL): string {
  const path = baseUrl.pathname.replace(/\/$/u, "");
  return `${baseUrl.origin}${path}/api/${PINNED_CALDERA_API_VERSION}`;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text) {
    return {};
  }
  const parsed: unknown = JSON.parse(text);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}

export function createCalderaOperationsClient(
  config: CalderaOperationsClientConfig
): CalderaOperationsClient {
  if (!config.apiKey.trim()) {
    throw new CalderaAdapterError(
      "api_key_required",
      "Customer-managed Caldera API key is required."
    );
  }
  const baseUrl = assertIsolatedCalderaBaseUrl(config.baseUrl);
  const root = apiRoot(baseUrl);
  const fetchImpl = config.fetchImpl ?? globalThis.fetch;
  const cancelled = new Set<string>();

  async function calderaFetch(
    path: string,
    init: RequestInit
  ): Promise<Record<string, unknown>> {
    const response = await fetchImpl(`${root}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        KEY: config.apiKey,
        ...(init.headers ?? {})
      },
      redirect: "error"
    });
    if (!response.ok) {
      throw new CalderaAdapterError(
        "http_error",
        `Caldera API ${init.method ?? "GET"} ${path} returned ${response.status}.`
      );
    }
    return readJson(response);
  }

  async function ingest(
    operationId: string
  ): Promise<CalderaNormalizedOperation> {
    const operation = await calderaFetch(`/operations/${operationId}`, {
      method: "GET"
    });
    try {
      await calderaFetch(`/operations/${operationId}/report`, {
        body: JSON.stringify({}),
        method: "POST"
      });
    } catch (error) {
      if (
        !(error instanceof CalderaAdapterError) ||
        error.code !== "http_error"
      ) {
        throw error;
      }
    }
    return normalizeCalderaOperation({
      cancelled: cancelled.has(operationId),
      operation: {
        ...operation,
        id: typeof operation.id === "string" ? operation.id : operationId
      }
    });
  }

  return {
    async createOperation(input) {
      assertCalderaAbilitiesAllowlisted(input.abilityIds);
      const adversaryId = randomUUID();
      await calderaFetch("/adversaries", {
        body: JSON.stringify({
          adversary_id: adversaryId,
          atomic_ordering: input.abilityIds,
          name: input.name
        }),
        method: "POST"
      });
      const created = await calderaFetch("/operations", {
        body: JSON.stringify({
          adversary: { adversary_id: adversaryId },
          auto_close: true,
          autonomous: 0,
          name: input.name,
          obfuscator: PINNED_CALDERA_OBFUSCATOR,
          planner: { id: PINNED_CALDERA_PLANNER_ID },
          source: { id: PINNED_CALDERA_SOURCE_ID },
          state: "paused"
        }),
        method: "POST"
      });
      const operationId =
        typeof created.id === "string" && created.id.length > 0
          ? created.id
          : adversaryId;
      return {
        jobsQueued: 0,
        operationId,
        state: "paused"
      };
    },

    async startOperation(operationId) {
      if (cancelled.has(operationId)) {
        throw new CalderaAdapterError(
          "operation_cancelled",
          "Cancelled Caldera operations cannot be started."
        );
      }
      await calderaFetch(`/operations/${operationId}`, {
        body: JSON.stringify({ state: "running" }),
        method: "PATCH"
      });
      return { state: "running" };
    },

    async stopOperation(operationId) {
      await calderaFetch(`/operations/${operationId}`, {
        body: JSON.stringify({ state: "finished" }),
        method: "PATCH"
      });
      return { state: "finished" };
    },

    async cancelOperation(operationId) {
      cancelled.add(operationId);
      await calderaFetch(`/operations/${operationId}`, {
        body: JSON.stringify({ state: "cleanup" }),
        method: "PATCH"
      });
      return ingest(operationId);
    },

    ingestOperation(operationId) {
      return ingest(operationId);
    }
  };
}
