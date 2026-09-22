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

function expectOverlayHonestyCopy() {
  expect(screen.getAllByText(/not 100% ATT&CK/i).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/scenario execution requires qualification/i).length).toBeGreaterThan(0);
}

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
        name: "Safe-subset coverage: 1 of 2"
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

  it("shows an ATT&CK to safe-module coverage column without claiming BAS parity", async () => {
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
      expect(
        screen.getByRole("table", { name: "ATT&CK to safe-module map" })
      ).toBeInTheDocument();
    });

    const map = screen.getByRole("table", {
      name: "ATT&CK to safe-module map"
    });
    expect(
      within(map).getByRole("columnheader", { name: "Coverage" })
    ).toBeInTheDocument();
    expect(
      within(map).getByRole("columnheader", { name: "Safe module" })
    ).toBeInTheDocument();

    const scanning = within(map).getByRole("row", { name: /T1595/i });
    expect(within(scanning).getByText("Live disabled")).toBeInTheDocument();
    expect(
      within(scanning).getByText("not executed (live disabled)")
    ).toBeInTheDocument();

    const credentials = within(map).getByRole("row", { name: /T1552/i });
    expect(within(credentials).getByText("Safe module")).toBeInTheDocument();
    expect(
      within(credentials).getByText("gitleaks.repo_secrets")
    ).toBeInTheDocument();

    const validAccounts = within(map).getByRole("row", { name: /T1078/i });
    expect(within(validAccounts).getByText("Catalog only")).toBeInTheDocument();

    expect(
      within(screen.getByLabelText("T1595 module coverage")).getByText(
        "Live disabled"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(/partial ATT&CK mapping; execution coverage requires measured receipts/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/complete ATT&CK BAS parity/i)
    ).not.toBeInTheDocument();
  });

  it("overlays control-validation coverage against the safe subset, not 100% ATT&CK", async () => {
    const coverageWithOutOfSubset = {
      ...coverage,
      coveredTechniques: 2,
      totalTechniques: 2,
      items: [
        ...coverage.items,
        {
          ...coverage.items[0],
          scenarioId: "scenario.process-injection",
          tacticName: "Defense Evasion",
          techniqueId: "T1055",
          techniqueName: "Process Injection",
          title: "Process injection detection"
        }
      ]
    };

    vi.stubGlobal(
      "fetch",
      mockFetch({
        "/api/v1/attack-techniques": { items: techniques },
        "/api/v1/control-sources/rule-coverage": coverageWithOutOfSubset,
        "/api/v1/me": authPayload
      })
    );

    render(<AttackTechniquesCatalog />);

    await waitFor(() => {
      expect(
        screen.getByRole("status", { name: "Safe-subset coverage: 1 of 2" })
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(/1 of 2 curated safe-subset techniques/i)
    ).toBeInTheDocument();
    expectOverlayHonestyCopy();
    expect(
      within(screen.getByLabelText("T1595 tenant coverage")).getByText(
        "Covered"
      )
    ).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("T1087 tenant coverage")).getByText(
        "No measured scenario"
      )
    ).toBeInTheDocument();
    expect(screen.queryByText("T1055")).not.toBeInTheDocument();
    expect(screen.queryByText(/complete ATT&CK BAS parity/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/live Atomic/i)).not.toBeInTheDocument();
  });

  it("shows an empty overlay when the tenant has no control-validation coverage", async () => {
    const emptyCoverage = {
      ...coverage,
      coveredTechniques: 0,
      items: [],
      totalTechniques: 0
    };

    vi.stubGlobal(
      "fetch",
      mockFetch({
        "/api/v1/attack-techniques": { items: techniques },
        "/api/v1/control-sources/rule-coverage": emptyCoverage,
        "/api/v1/me": authPayload
      })
    );

    render(<AttackTechniquesCatalog />);

    await waitFor(() => {
      expect(
        screen.getByRole("status", {
          name: "No tenant control-validation coverage yet."
        })
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("status", { name: "Safe-subset coverage: 0 of 2" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/not proof that controls are absent/i)
    ).toBeInTheDocument();
    expectOverlayHonestyCopy();
    expect(screen.getByText("T1595 Active Scanning")).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("T1595 tenant coverage")).getByText(
        "No measured scenario"
      )
    ).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("T1595 tenant coverage")).queryByText(
        "Covered"
      )
    ).not.toBeInTheDocument();
  });

  it("does not claim 100% ATT&CK when every safe-subset technique is covered", async () => {
    const fullSubsetCoverage = {
      ...coverage,
      coveredTechniques: 2,
      totalTechniques: 2,
      items: [
        coverage.items[0],
        {
          ...coverage.items[0],
          scenarioId: "scenario.account-discovery",
          tacticName: "Discovery",
          techniqueId: "T1087",
          techniqueName: "Account Discovery",
          title: "Account discovery detection"
        }
      ]
    };

    vi.stubGlobal(
      "fetch",
      mockFetch({
        "/api/v1/attack-techniques": { items: techniques },
        "/api/v1/control-sources/rule-coverage": fullSubsetCoverage,
        "/api/v1/me": authPayload
      })
    );

    render(<AttackTechniquesCatalog />);

    await waitFor(() => {
      expect(
        screen.getByRole("status", { name: "Safe-subset coverage: 2 of 2" })
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(/2 of 2 curated safe-subset techniques/i)
    ).toBeInTheDocument();
    expectOverlayHonestyCopy();
    expect(screen.queryByText(/complete ATT&CK BAS parity/i)).not.toBeInTheDocument();
    expect(
      within(screen.getByLabelText("T1595 tenant coverage")).getByText(
        "Covered"
      )
    ).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("T1087 tenant coverage")).getByText(
        "Covered"
      )
    ).toBeInTheDocument();
  });

  it("shows an empty catalog state when the ATT&CK reference API returns no techniques", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "/api/v1/attack-techniques": { items: [] },
        "/api/v1/control-sources/rule-coverage": {
          ...coverage,
          coveredTechniques: 0,
          items: [],
          totalTechniques: 0
        },
        "/api/v1/me": authPayload
      })
    );

    render(<AttackTechniquesCatalog />);

    await waitFor(() => {
      expect(
        screen.getByText(
          "No curated ATT&CK reference techniques were returned."
        )
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("status", { name: "Safe-subset coverage: 0 of 0" })
    ).toBeInTheDocument();
    expectOverlayHonestyCopy();
  });
});
