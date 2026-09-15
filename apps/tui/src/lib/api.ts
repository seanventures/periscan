import { HEALTH_ROUTE } from "@periscan/shared";
import type {
  CommunityMissionRemediationsResult,
  CommunityValidationStartResult,
  CommunityValidationSuiteResponse,
  CreateScopeInput,
  EvidenceArtifact,
  ExecutionEnvironment,
  PolicyDecision,
  Scope,
  ValidatedFinding,
  ValidationMission,
  ValidationRun
} from "@periscan/shared";

export const SESSION_COOKIE_NAME = "periscan_session";
export const CSRF_COOKIE_NAME = "periscan_csrf";
export const CSRF_HEADER_NAME = "x-csrf-token";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Auth bootstrap paths that may run before a CSRF cookie exists. */
const CSRF_EXEMPT_PATHS = new Set([
  "/api/v1/auth/signup",
  "/api/v1/auth/login",
  "/api/v1/auth/logout",
  "/api/v1/auth/password-reset/request",
  "/api/v1/auth/password-reset/confirm",
  "/api/v1/auth/accept-invite",
  "/api/v1/auth/sso/start",
  "/api/v1/auth/sso/callback"
]);

const SAFE_REQUESTED_ACTION = {
  credentialTheft: false,
  destructive: false,
  persistence: false,
  realDataExfiltration: false,
  requiresTimeWindow: false,
  uncontrolledExploitChaining: false
} as const;

export class PeriscanApiError extends Error {
  readonly code?: string;
  readonly status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "PeriscanApiError";
    this.status = status;
    this.code = code;
  }
}

export function isDeniedNeverQueued(error: unknown): boolean {
  return error instanceof PeriscanApiError && error.code === "policy_denied";
}

function itemsOf<T>(payload: unknown): T[] {
  if (
    payload &&
    typeof payload === "object" &&
    "items" in payload &&
    Array.isArray((payload as { items: unknown }).items)
  ) {
    return (payload as { items: T[] }).items;
  }
  return [];
}

function errorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error: unknown }).error;
    if (typeof error === "string" && error.length > 0) {
      return error;
    }
  }
  return fallback;
}

function errorCode(payload: unknown): string | undefined {
  if (payload && typeof payload === "object" && "code" in payload) {
    const code = (payload as { code: unknown }).code;
    if (typeof code === "string" && code.length > 0) {
      return code;
    }
  }
  return undefined;
}

function readSetCookieLines(headers: Headers | undefined): string[] {
  if (!headers) {
    return [];
  }
  const withGetSet = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof withGetSet.getSetCookie === "function") {
    return withGetSet.getSetCookie();
  }
  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

function parseSetCookie(line: string): { name: string; value: string } | null {
  const pair = line.split(";")[0];
  if (!pair) {
    return null;
  }
  const eq = pair.indexOf("=");
  if (eq <= 0) {
    return null;
  }
  const raw = pair.slice(eq + 1).trim();
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    // keep the raw cookie value when it is not URI-encoded
  }
  return {
    name: pair.slice(0, eq).trim(),
    value
  };
}

function queryString(entries: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(entries)) {
    if (value) {
      params.set(key, value);
    }
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

/** Operator TUI HTTP client: in-memory cookie jar + double-submit CSRF. */
export class PeriscanApi {
  private readonly cookies = new Map<string, string>();
  private readonly fetcher: typeof fetch;

  constructor(
    public readonly apiUrl: string,
    options: { fetchImpl?: typeof fetch } = {}
  ) {
    this.apiUrl = apiUrl.replace(/\/$/u, "");
    this.fetcher = options.fetchImpl ?? fetch;
  }

  /**
   * Seed cookie-auth from lab-session exports (python Set-Cookie parse):
   * PERISCAN_API_TOKEN=`periscan_session=…` and PERISCAN_CSRF_TOKEN cookie value.
   * Mutating calls then send Cookie plus x-csrf-token.
   */
  applyLabAuth(sessionToken?: string, csrfToken?: string): void {
    const token = sessionToken?.trim() ?? "";
    const csrf = csrfToken?.trim() ?? "";
    if (token.includes("=")) {
      for (const part of token.split(";")) {
        const parsed = parseSetCookie(part.trim());
        if (parsed) {
          this.cookies.set(parsed.name, parsed.value);
        }
      }
    } else if (token.length > 0 && !token.startsWith("psk_")) {
      this.cookies.set(SESSION_COOKIE_NAME, token);
    }
    if (csrf) {
      this.cookies.set(CSRF_COOKIE_NAME, csrf);
    }
  }

  private cookieHeader(): string | undefined {
    if (this.cookies.size === 0) {
      return undefined;
    }
    return [...this.cookies.entries()]
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  private ingestCookies(response: Response): void {
    for (const line of readSetCookieLines(response.headers)) {
      const parsed = parseSetCookie(line);
      if (!parsed) {
        continue;
      }
      this.cookies.set(parsed.name, parsed.value);
    }
  }

  async request(path: string, init: RequestInit = {}): Promise<Response> {
    const method = (init.method ?? "GET").toUpperCase();
    const mutating = MUTATING_METHODS.has(method);
    const headers = new Headers(init.headers);
    if (init.body != null && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    const cookie = this.cookieHeader();
    if (cookie) {
      headers.set("cookie", cookie);
    }
    const pathName = path.split("?")[0] ?? path;
    if (mutating && !CSRF_EXEMPT_PATHS.has(pathName)) {
      const csrf = this.cookies.get(CSRF_COOKIE_NAME);
      if (csrf) {
        headers.set(CSRF_HEADER_NAME, csrf);
      }
    }

    const response = await this.fetcher(`${this.apiUrl}${path}`, {
      ...init,
      credentials: init.credentials ?? "include",
      headers,
      method
    });
    this.ingestCookies(response);
    return response;
  }

  async requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.request(path, init);
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new PeriscanApiError(
        errorMessage(payload, `Request failed (${response.status})`),
        response.status,
        errorCode(payload)
      );
    }
    return payload as T;
  }

  async health(): Promise<{ status: string; service?: string; timestamp?: string }> {
    return this.requestJson(HEALTH_ROUTE);
  }

  async signup(input: {
    email: string;
    name: string;
    password: string;
    tenantName: string;
  }): Promise<unknown> {
    return this.requestJson("/api/v1/auth/signup", {
      body: JSON.stringify(input),
      method: "POST"
    });
  }

  async login(input: { email: string; password: string }): Promise<unknown> {
    return this.requestJson("/api/v1/auth/login", {
      body: JSON.stringify(input),
      method: "POST"
    });
  }

  async listScopes(): Promise<Scope[]> {
    return itemsOf<Scope>(await this.requestJson("/api/v1/scopes"));
  }

  async createScope(
    input: Pick<CreateScopeInput, "scopeType" | "value"> &
      Partial<Omit<CreateScopeInput, "scopeType" | "value">>
  ): Promise<Scope> {
    return this.requestJson("/api/v1/scopes", {
      body: JSON.stringify(input),
      method: "POST"
    });
  }

  async verifyScope(
    scopeId: string,
    input: { devModeManual?: boolean; operatorAttestation?: boolean } = {}
  ): Promise<Scope> {
    return this.requestJson(`/api/v1/scopes/${scopeId}/verify`, {
      body: JSON.stringify(input),
      method: "POST"
    });
  }

  async communitySuite(
    scopeId?: string
  ): Promise<CommunityValidationSuiteResponse> {
    return this.requestJson(
      `/api/v1/community/validation-suite${queryString({ scopeId })}`
    );
  }

  async previewPolicy(input: {
    executionEnvironment: ExecutionEnvironment;
    missionType?: string;
    requestedAction?: {
      credentialTheft: boolean;
      destructive: boolean;
      persistence: boolean;
      realDataExfiltration: boolean;
      requiresInternalRunner?: boolean;
      requiresTimeWindow?: boolean;
      uncontrolledExploitChaining: boolean;
    };
    safetyLevel: string;
    scopeId: string;
    target: Record<string, unknown>;
  }): Promise<PolicyDecision> {
    return this.requestJson(
      `/api/v1/scopes/${input.scopeId}/policy-decisions/preview`,
      {
        body: JSON.stringify({
          executionEnvironment: input.executionEnvironment,
          missionType: input.missionType ?? "ValidationSnapshot",
          requestedAction: input.requestedAction ?? {
            ...SAFE_REQUESTED_ACTION,
            requiresInternalRunner:
              input.executionEnvironment === "InternalRunner"
          },
          safetyLevel: input.safetyLevel,
          target: input.target
        }),
        method: "POST"
      }
    );
  }

  /** Starts Community validation for an existing policy decision. Denied never queues. */
  async startCommunity(input: {
    moduleIds?: string[];
    policyDecisionId: string;
    scopeId: string;
  }): Promise<CommunityValidationStartResult> {
    return this.requestJson("/api/v1/community/validation-runs", {
      body: JSON.stringify({
        policyDecisionId: input.policyDecisionId,
        scopeId: input.scopeId,
        ...(input.moduleIds === undefined ? {} : { moduleIds: input.moduleIds })
      }),
      method: "POST"
    });
  }

  async listMissions(): Promise<ValidationMission[]> {
    return itemsOf<ValidationMission>(
      await this.requestJson("/api/v1/missions")
    );
  }

  async getMission(missionId: string): Promise<ValidationMission> {
    return this.requestJson(`/api/v1/missions/${missionId}`);
  }

  async listMissionRuns(missionId: string): Promise<ValidationRun[]> {
    return itemsOf<ValidationRun>(
      await this.requestJson(`/api/v1/missions/${missionId}/runs`)
    );
  }

  async listFindings(
    query: { missionId?: string } = {}
  ): Promise<ValidatedFinding[]> {
    return itemsOf<ValidatedFinding>(
      await this.requestJson(
        `/api/v1/findings${queryString({ missionId: query.missionId })}`
      )
    );
  }

  async createCommunityRemediations(
    missionId: string
  ): Promise<CommunityMissionRemediationsResult> {
    return this.requestJson(
      `/api/v1/community/validation-runs/${missionId}/remediations`,
      { method: "POST" }
    );
  }

  async verifyRemediation(remediationId: string): Promise<{
    remediation: { remediationId: string; status: string };
    verificationEvent: { measuredRevalidation: boolean; outcome: string };
  }> {
    const payload = await this.requestJson<{
      remediation?: { remediationId?: string; status?: string };
      verificationEvent?: {
        measuredRevalidation?: boolean;
        outcome?: string;
      };
    }>(`/api/v1/remediations/${remediationId}/verify`, {
      body: JSON.stringify({}),
      method: "POST"
    });
    return {
      remediation: {
        remediationId: payload.remediation?.remediationId ?? remediationId,
        status: payload.remediation?.status ?? "Inconclusive"
      },
      verificationEvent: {
        measuredRevalidation: Boolean(
          payload.verificationEvent?.measuredRevalidation
        ),
        outcome: payload.verificationEvent?.outcome ?? "Inconclusive"
      }
    };
  }

  async listEvidence(): Promise<EvidenceArtifact[]> {
    return itemsOf<EvidenceArtifact>(
      await this.requestJson("/api/v1/evidence")
    );
  }
}
