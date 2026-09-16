import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AttackTechniquesCatalog } from "./attack-techniques-catalog";

const timestamp = "2026-06-01T00:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

const authPayload = {
  membership: {
    createdAt: timestamp,
    membershipId: "33333333-3333-4333-8333-333333333333",
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

const techniques = [
  {
    description:
      "Externally observable service discovery and scanning activity.",
    safeExample: true,
    tacticId: "TA0043",
    tacticName: "Reconnaissance",
    techniqueId: "T1595",
    techniqueName: "Active Scanning"
  },
  {
    description: "Account and identity enumeration behaviors.",
    safeExample: true,
    tacticId: "TA0007",
    tacticName: "Discovery",
    techniqueId: "T1087",
    techniqueName: "Account Discovery"
  }
];

const coverage = {
  blockedTechniques: 0,
  controlSourceId: null,
  coveredTechniques: 1,
  generatedAt: timestamp,
  history: [],
  improvedTechniques: 0,
  items: [
    {
      confidence: 0.9,
      controlSourceId: "99999999-9999-4999-8999-999999999999",
      evidenceIds: ["77777777-7777-4777-8777-777777777777"],
      expectedBehaviors: ["Detected"],
      lastObservedAt: timestamp,
      observedBehaviors: ["Detected"],
      observedSources: ["SIEM"],
      previousStatus: null,
      recommendation: "Keep validating this rule after changes.",
      scenarioId: "scenario.active-scanning",
      signalIds: ["88888888-8888-4888-8888-888888888888"],
      status: "Covered",
      tacticName: "Reconnaissance",
      techniqueId: "T1595",
      techniqueName: "Active Scanning",
      title: "Active scanning detection",
      trend: "New"
    }
  ],
  loggedOnlyTechniques: 0,
  missedTechniques: 0,
  needsTuningTechniques: 0,
  noEvidenceTechniques: 0,
  notTestedTechniques: 0,
  recommendations: [],
  regressedTechniques: 0,
  snapshotId: null,
  staleTechniques: 0,
  tenantId,
  totalTechniques: 1
};

function mockFetch(payloadByRoute: Record<string, unknown>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const route = String(input).split("?")[0] ?? "";
    const payload = payloadByRoute[route];

    if (payload == null) {
      return {
        json: async () => ({ error: `Unhandled route ${route}` }),
        ok: false,
        status: 404
      };
    }

    return { json: async () => payload, ok: true, status: 200 };
  }) as unknown as typeof fetch;
}

describe("AttackTechniquesCatalog", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prompts unauthenticated visitors to sign in", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({ error: "Authentication required" }),
        ok: false,
        status: 401
      })) as unknown as typeof fetch
    );

    render(<AttackTechniquesCatalog />);

    await waitFor(() => {
      expect(
        screen.getByText("Sign in to review the ATT&CK catalog.")
      ).toBeInTheDocument();
    });
  });

  it("renders the ATT&CK techniques grouped by tactic from the API", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "/api/v1/attack-techniques": { items: techniques },
        "/api/v1/control-sources/rule-coverage": coverage,
        "/api/v1/me": authPayload
      })
    );

    render(<AttackTechniquesCatalog />);

    await waitFor(() => {
      expect(screen.getByText("T1595 Active Scanning")).toBeInTheDocument();
    });

    expect(screen.getByText("T1087 Account Discovery")).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Mapped technique count: 2" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Tactics covered count: 2" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("ATT&CK catalog metrics")).toHaveClass(
      "grid-cols-1",
      "sm:grid-cols-2",
      "lg:grid-cols-4"
    );

    // The tactic-coverage chart's accessible table fallback (jsdom) is computed
    // from the real loaded techniques.
    const tacticFigure = screen.getByRole("figure", {
      name: "Curated techniques by ATT&CK tactic"
    });
    expect(
      within(tacticFigure).getByRole("rowheader", { name: "Reconnaissance" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Tenant techniques measured count: 1"
      })
    ).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("T1595 tenant coverage")).getByText(
        "Covered"
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(/not the complete MITRE catalog/i)
    ).toBeInTheDocument();
  });
});
