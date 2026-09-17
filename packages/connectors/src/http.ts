/**
 * Self-contained HTTP hardening utility for connector calls.
 *
 * Wraps the global `fetch` with a request timeout, exponential-backoff retries
 * on transient failures, and HTTP 429 rate-limit handling that honors the
 * `Retry-After` header. Failures are surfaced through a single typed error,
 * {@link ConnectorHttpError}, carrying a coarse `kind` so callers can branch on
 * the failure class without parsing messages.
 *
 * Dependency-free: relies only on Node 20 globals (`fetch`, `AbortController`).
 */

/** Coarse classification of a connector HTTP failure. */
export type ConnectorHttpErrorKind =
  | "client"
  | "network"
  | "rate_limited"
  | "server"
  | "timeout";

/** First argument accepted by the global `fetch` (string | URL | Request). */
export type FetchInput = Parameters<typeof globalThis.fetch>[0];

/** Minimal `fetch` shape so a stub can be injected in tests. */
export type FetchImpl = (
  input: FetchInput,
  init?: RequestInit
) => Promise<Response>;

/** Tunable behavior for {@link connectorFetch}; every field is optional. */
export interface ConnectorFetchOptions {
  /** Injectable `fetch` implementation. Defaults to `globalThis.fetch`. */
  fetchImpl?: FetchImpl;
  /** Number of retry attempts after the initial try. Defaults to 2. */
  retries?: number;
  /** Allow retrying non-idempotent methods (POST/PUT/PATCH/DELETE). Off by
   * default so a transient 5xx/429 never double-sends a mutating request. */
  retryNonIdempotent?: boolean;
  /** Sleep helper used between retries. Defaults to a real timer. */
  sleep?: (ms: number) => Promise<void>;
  /** Per-attempt timeout in milliseconds. Defaults to 15000. */
  timeoutMs?: number;
}

/** Typed error thrown by {@link connectorFetch} for any non-recoverable failure. */
export class ConnectorHttpError extends Error {
  readonly detail: string;
  readonly kind: ConnectorHttpErrorKind;
  readonly status?: number;

  constructor(
    kind: ConnectorHttpErrorKind,
    detail: string,
    options?: { cause?: unknown; status?: number }
  ) {
    super(
      detail,
      options?.cause === undefined ? undefined : { cause: options.cause }
    );
    this.name = "ConnectorHttpError";
    this.detail = detail;
    this.kind = kind;
    this.status = options?.status;
  }
}

const DEFAULT_RETRIES = 2;
const DEFAULT_TIMEOUT_MS = 15000;
const BASE_BACKOFF_MS = 250;
const MAX_RETRY_AFTER_MS = 30000;

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Parse a `Retry-After` header. Only the seconds form is honored; the value is
 * clamped to {@link MAX_RETRY_AFTER_MS}. Returns `undefined` when absent or
 * unparseable so the caller falls back to exponential backoff.
 */
function parseRetryAfterMs(response: Response): number | undefined {
  const header = response.headers.get("retry-after");
  if (header === null) {
    return undefined;
  }
  const seconds = Number(header.trim());
  if (!Number.isFinite(seconds) || seconds < 0) {
    return undefined;
  }
  return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
}

/** Exponential backoff delay for the given (zero-based) attempt index. */
function backoffMs(attempt: number): number {
  return BASE_BACKOFF_MS * 2 ** attempt;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/**
 * Hardened wrapper around `fetch`.
 *
 * Resolves with the {@link Response} for any completed request that is not
 * retried further — including non-429 4xx responses, so callers can inspect
 * `.ok` and the status themselves. Throws a {@link ConnectorHttpError} only
 * when the request times out, the network fails, or the retry budget is
 * exhausted on a retryable status.
 */
export async function connectorFetch(
  input: FetchInput,
  init?: RequestInit,
  options?: ConnectorFetchOptions
): Promise<Response> {
  const fetchImpl = options?.fetchImpl ?? globalThis.fetch;
  const retries = options?.retries ?? DEFAULT_RETRIES;
  const sleep = options?.sleep ?? defaultSleep;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const method = (init?.method ?? "GET").toUpperCase();
  const idempotent =
    method === "GET" || method === "HEAD" || method === "OPTIONS";
  // Only retry idempotent reads by default; opt in for known-idempotent POSTs.
  const canRetry = idempotent || options?.retryNonIdempotent === true;

  let lastError: ConnectorHttpError | undefined;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const hasRetriesLeft = attempt < retries;

    let response: Response;
    try {
      response = await fetchWithTimeout(fetchImpl, input, init, timeoutMs);
    } catch (error) {
      // Timeouts are never retried: the budget is per-attempt and a timeout
      // already consumed the full window, so surface it immediately.
      if (error instanceof ConnectorHttpError && error.kind === "timeout") {
        throw error;
      }
      lastError = new ConnectorHttpError(
        "network",
        `network error: ${describeError(error)}`,
        { cause: error }
      );
      if (hasRetriesLeft && canRetry) {
        await sleep(backoffMs(attempt));
        continue;
      }
      throw lastError;
    }

    if (response.status === 429) {
      lastError = new ConnectorHttpError(
        "rate_limited",
        "rate limited (HTTP 429)",
        { status: 429 }
      );
      if (hasRetriesLeft && canRetry) {
        const retryAfterMs = parseRetryAfterMs(response);
        await sleep(retryAfterMs ?? backoffMs(attempt));
        continue;
      }
      throw lastError;
    }

    if (response.status >= 500) {
      lastError = new ConnectorHttpError(
        "server",
        `server error (HTTP ${response.status})`,
        { status: response.status }
      );
      if (hasRetriesLeft && canRetry) {
        await sleep(backoffMs(attempt));
        continue;
      }
      throw lastError;
    }

    // Success or a non-retryable 4xx: hand the Response back to the caller.
    return response;
  }

  // Unreachable in practice: the loop either returns or throws. Guard anyway so
  // the function has a total signature.
  throw (
    lastError ??
    new ConnectorHttpError("network", "request failed without a response")
  );
}

async function fetchWithTimeout(
  fetchImpl: FetchImpl,
  input: FetchInput,
  init: RequestInit | undefined,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetchImpl(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted || isAbortError(error)) {
      throw new ConnectorHttpError(
        "timeout",
        `request timed out after ${timeoutMs}ms`,
        { cause: error }
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
