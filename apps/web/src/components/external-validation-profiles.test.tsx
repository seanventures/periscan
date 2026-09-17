import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ValidationMission, ValidationRun } from "@periscan/shared";

import {
  ExternalValidationProfiles,
  externalValidationState
} from "./external-validation-profiles";

const timestamp = "2026-07-14T14:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const scopeId = "33333333-3333-4333-8333-333333333333";
const decisionId = "44444444-4444-4444-8444-444444444444";
const missionId = "55555555-5555-4555-8555-555555555555";
const runId = "66666666-6666-4666-8666-666666666666";

const authPayload = {
  membership: {
    createdAt: timestamp,
    membershipId: "77777777-7777-4777-8777-777777777777",
    role: "Owner",
    tenantId,
    updatedAt: timestamp,
    userId
  },
  tenant: {
    billingAccountId: null,
    createdAt: timestamp,
    dataRegion: "us-east-1",
    name: "Demo Security",
    parentTenantId: null,
    tenantId,
    type: "Organization",
    updatedAt: timestamp
  },
  user: {
    createdAt: timestamp,
    email: "owner@example.com",
    name: "Owner User",
    status: "Active",
    updatedAt: timestamp,
    userId
  }
};

const scope = {
  assetClass: "BusinessApplication",
  businessCriticality: "High",
  createdAt: timestamp,
  createdBy: userId,
  effectiveMaxSafetyLevel: "ActiveNonInvasive",
  externalValidationProfileId: "safe-baseline",
  isOperationalTechnology: false,
  lastPostureCheckAt: null,
  maxSafetyLevel: "ActiveNonInvasive",
  nextPostureCheckAt: null,
  purdueLevel: null,
  safetyRestrictionReason:
    "This scope permits validation through ActiveNonInvasive.",
  scopeId,
  scopeType: "Domain",
  segmentName: "Public application",
  sensitivity: "Moderate",
  tags: ["internet-facing"],
  tenantId,
  updatedAt: timestamp,
  value: "example.com",
  verificationExpiresAt: "2026-10-14T14:00:00.000Z",
  verificationMethod: "dns_txt",
  verificationStale: false,
  verificationStatus: "Verified",
  verificationToken: null,
  verifiedAt: timestamp,
  verifiedBy: userId
};

const profiles = [
  {
    defaultRateLimit: 10,
    description: "Runs the full Periscan safe external baseline.",
    displayName: "Safe Baseline",
    maxRequestsPerTarget: 25,
    profile: "safe-baseline",
    safetyNotes: ["GET-only checks"],
    templateIds: [
      "periscan-safe-http-fingerprint",
      "periscan-safe-http-security-headers"
    ]
  }
];

const mission = {
  completedAt: timestamp,
  createdAt: timestamp,
  evidenceIds: [],
  missionId,
  missionType: "ExposureValidation",
  policyDecisionId: decisionId,
  policyProfile: null,
  requestedBy: userId,
  safetyLevel: "ActiveNonInvasive",
  scopeId,
  scopeIds: [scopeId],
  startedAt: timestamp,
  status: "Completed",
  tenantId,
  updatedAt: timestamp
} satisfies ValidationMission;

const run = {
  completedAt: timestamp,
  createdAt: timestamp,
  errorSummary: null,
  evidenceIds: [],
  missionId,
  moduleId: "nuclei.external_exposure_safe",
  outcome: "Safe external baseline completed with no exposed control gap.",
  policyDecisionId: decisionId,
  runId,
  runnerId: null,
  safetyLevel: "ActiveNonInvasive",
  scopeId,
  startedAt: timestamp,
  status: "Completed",
  target: {
    hostname: "example.com",
    rateLimit: 10,
    templateProfile: "safe-baseline"
  },
  tenantId,
  updatedAt: timestamp,
  validationState: "Fixed"
} satisfies ValidationRun;

function jsonResponse(payload: unknown, status = 200) {
  return {
    json: async () => payload,
    ok: status >= 200 && status < 300,
    status
  };
}

describe("ExternalValidationProfiles", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prompts unauthenticated visitors to sign in", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ error: "Authentication required" }, 401)
      ) as unknown as typeof fetch
    );

    render(<ExternalValidationProfiles />);

    expect(
      await screen.findByText("Sign in to run external validation.")
    ).toBeInTheDocument();
  });

  it("follows the inline guide from verified target to a completed run", async () => {
    const requests: Array<{
      method: string;
      payload?: Record<string, unknown>;
      route: string;
    }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const route = String(input).split("?")[0] ?? "";
        const method = init?.method ?? "GET";
        const payload = init?.body
          ? (JSON.parse(String(init.body)) as Record<string, unknown>)
          : undefined;
        requests.push({ method, payload, route });

        if (route === "/api/v1/me") return jsonResponse(authPayload);
        if (route === "/api/v1/scopes") {
          return jsonResponse({ items: [scope] });
        }
        if (route === "/api/v1/external-validation/profiles") {
          return jsonResponse({ items: profiles });
        }
        if (route === "/api/v1/modules") {
          return jsonResponse({
            items: [
              {
                moduleId: "nuclei.external_exposure_safe",
                resourceLimits: { maxNetworkRequests: 25, memoryMb: 192 },
                timeoutSeconds: 120
              }
            ]
          });
        }
        if (route === "/api/v1/external-validation/attempts") {
          return jsonResponse({ items: [] });
        }
        if (route === "/api/v1/evidence") {
          return jsonResponse({ items: [] });
        }
        if (route === "/api/v1/attack-paths") {
          return jsonResponse({ items: [] });
        }
        if (route === "/api/v1/remediations" && method === "GET") {
          return jsonResponse({ items: [] });
        }
        if (route === `/api/v1/scopes/${scopeId}/policy-decisions/preview`) {
          return jsonResponse({
            approvalState: "NotRequired",
            approvedAt: null,
            approvedBy: null,
            createdAt: timestamp,
            executionEnvironment: "ExternalPoA",
            expiresAt: "2026-07-14T15:00:00.000Z",
            missionType: "ExposureValidation",
            outcome: "Allowed",
            policyDecisionId: decisionId,
            rationale:
              "Verified external scope permits active non-invasive validation.",
            requestedAction: {
              credentialTheft: false,
              destructive: false,
              persistence: false,
              realDataExfiltration: false,
              requiresInternalRunner: false,
              requiresTimeWindow: false,
              uncontrolledExploitChaining: false
            },
            safetyLevel: "ActiveNonInvasive",
            scopeId,
            target: payload?.target,
            tenantId,
            updatedAt: timestamp,
            userId
          });
        }
        if (route === "/api/v1/missions" && method === "POST") {
          return jsonResponse({
            ...mission,
            completedAt: null,
            status: "Draft"
          });
        }
        if (route === `/api/v1/missions/${missionId}/start`) {
          return jsonResponse({
            jobsQueued: 1,
            mission,
            runs: [run]
          });
        }
        return jsonResponse({ error: `Unhandled route ${route}` }, 404);
      }) as unknown as typeof fetch
    );

    render(<ExternalValidationProfiles />);

    expect(
      await screen.findByRole("button", { name: "Run policy preflight" })
    ).toBeEnabled();
    expect(screen.getByText("Safe Baseline")).toBeInTheDocument();
    expect(
      screen.getByText("Target inside verified scope")
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Run policy preflight" })
    );

    const launch = await screen.findByRole("button", {
      name: "Launch safe validation"
    });
    await waitFor(() => expect(launch).toBeEnabled());
    expect(screen.getByText(decisionId)).toBeInTheDocument();

    fireEvent.click(launch);

    expect(
      await screen.findAllByText(
        "Safe external baseline completed with no exposed control gap."
      )
    ).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Prepare fresh re-test" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Normalized results · Completed")
    ).toBeInTheDocument();

    expect(requests).toContainEqual(
      expect.objectContaining({
        method: "POST",
        payload: expect.objectContaining({
          executionEnvironment: "ExternalPoA",
          target: {
            hostname: "example.com",
            rateLimit: 10,
            templateProfile: "safe-baseline"
          }
        }),
        route: `/api/v1/scopes/${scopeId}/policy-decisions/preview`
      })
    );
    expect(requests).toContainEqual(
      expect.objectContaining({
        method: "POST",
        payload: {
          moduleIds: ["nuclei.external_exposure_safe"],
          target: {
            hostname: "example.com",
            rateLimit: 10,
            templateProfile: "safe-baseline"
          }
        },
        route: `/api/v1/missions/${missionId}/start`
      })
    );
  });

  it("labels a persisted deadline failure as timed out", () => {
    const timedOutRun: ValidationRun = {
      ...run,
      errorSummary: "Executor timed out after the bounded 120 second deadline.",
      status: "Failed",
      validationState: "Inconclusive"
    };
    expect(
      externalValidationState({ ...mission, status: "Failed" }, [timedOutRun])
    ).toBe("Timed out");
  });
});
