import { readFileSync } from "node:fs";
import { join } from "node:path";

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ToolGovernanceMarketplace } from "./tool-governance-marketplace";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams()
}));

function jsonResponse(payload: unknown) {
  return {
    json: async () => payload,
    ok: true,
    status: 200
  };
}

const now = "2026-07-29T12:00:00.000Z";

function toolFixture(overrides: {
  toolId?: string;
  displayName?: string;
  license?: string;
  policyStatus?: "Enabled" | "Deferred" | "RequiresLegalReview";
  governanceStatus?: "Enabled" | "Disabled" | "LegalReviewRequired" | "Blocked";
  installStatus?: string;
  enabled?: boolean;
}) {
  const toolId = overrides.toolId ?? "gitleaks";
  const policyStatus = overrides.policyStatus ?? "Enabled";
  return {
    governance: {
      allowedRuntimes: ["docker"],
      disabledReason:
        policyStatus === "RequiresLegalReview"
          ? "This tool requires legal review before tenant enablement."
          : null,
      enabled: overrides.enabled ?? policyStatus === "Enabled",
      legalReviewStatus:
        policyStatus === "RequiresLegalReview"
          ? "RequiresLegalReview"
          : "Approved",
      pinnedGitRef: null,
      pinnedImageRef: null,
      pinnedVersion: "8.30.0",
      source: "Default",
      status:
        overrides.governanceStatus ??
        (policyStatus === "RequiresLegalReview"
          ? "LegalReviewRequired"
          : "Enabled"),
      tenantId: null,
      toolId,
      updatedAt: now
    },
    recentJobs: [],
    runtimeInstallation: {
      installedAt: null,
      installedVersion: null,
      installStatus: overrides.installStatus ?? "NotInstalled",
      lastCheckedAt: null,
      runtimeAvailable: false,
      runtimeKind: "docker",
      runtimeReason: "Not checked",
      toolId
    },
    tool: {
      capabilities: [],
      capabilityCounts: {
        blocked: 0,
        deferred: 0,
        fixtureOnly: 0,
        implemented: 1,
        planned: 0,
        total: 1
      },
      readiness: "Implemented",
      tool: {
        binaryName: toolId,
        category: "Secrets",
        defaultVersion: "8.30.0",
        displayName: overrides.displayName ?? "Gitleaks",
        dockerImage: "zricethezav/gitleaks",
        docsUrl: "https://example.com/docs",
        gitRepo: null,
        license: overrides.license ?? "MIT",
        moduleIds: ["secrets.gitleaks"],
        notes: "Secrets scanning engine.",
        npmPackage: null,
        phase: "Current",
        pipPackage: null,
        policyStatus,
        runtimePreference: ["docker"],
        toolId
      }
    }
  };
}

describe("ToolGovernanceMarketplace", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("derives Community-startable engines from the suite, not a stale id list", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/tool-governance-marketplace.tsx"),
      "utf8"
    );
    expect(source).not.toMatch(/FIRST_SNAPSHOT_ENGINE_IDS/);
    expect(source).toMatch(/COMMUNITY_VALIDATION_TOOL_IDS/);
    expect(source).toMatch(/classifyEngineLabHonesty/);
    expect(source).toMatch(/isCommunityValidationModuleId/);
    expect(source).toMatch(/Install \+ enable Community pack/);
    expect(source).toMatch(/install-community-pack/);
    expect(source).toMatch(/COPYLEFT_OPT_IN_TOOL_IDS/);
    expect(source).toMatch(/Review licenses & add/);
    expect(source).toMatch(/add-copyleft-pack/);
    expect(source).toMatch(/SecurityCatalogManager/);
    expect(source).not.toMatch(/role="tablist"/);
    expect(source).not.toMatch(/\brole="tab"/);
    expect(source).toMatch(/aria-pressed=\{lane === id\}/);
    expect(source).toMatch(
      /aria-label="Search engines by name or license"\s+className="[^"]*focus-visible:ring-2 focus-visible:ring-brand/
    );
    expect(source).toMatch(
      /className="[^"]*underline[^"]*"[\s\S]{0,160}Run Community validation →/
    );
    expect(
      readFileSync(
        join(process.cwd(), "src/components/security-catalog-manager.tsx"),
        "utf8"
      )
    ).toMatch(/install-open-pack/);
  });

  it("keeps operator catalog first with missions CTA and collapsed labs studio", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/v1/third-party-tools")) {
        return jsonResponse({ items: [] });
      }

      if (url.includes("/api/v1/third-party-tools/license-acceptances")) {
        return jsonResponse({ items: [] });
      }

      // Modules / registry list for platform evidence packs section
      if (url.includes("/api/v1/modules") || url.includes("/api/v1/validation-modules")) {
        return jsonResponse({ items: [] });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal("fetch", fetchImpl as unknown as typeof fetch);

    render(<ToolGovernanceMarketplace />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Engines" })
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("link", {
        name: /Run from a verified scope/i
      })
    ).toHaveAttribute("href", "/missions");
    expect(
      screen.getByLabelText("Search engines by name or license").className
    ).toMatch(/focus-visible:ring-2/);
    expect(
      screen.getByRole("link", { name: /Run Community validation/i }).className
    ).toMatch(/underline/);
    const lanes = screen.getByLabelText("Engine lanes");
    expect(lanes).not.toHaveAttribute("role", "tablist");
    expect(within(lanes).queryByRole("tab")).not.toBeInTheDocument();
    expect(
      within(lanes).getByRole("button", { name: "Community" })
    ).toHaveAttribute("aria-pressed", "false");
    // Platform evidence packs are listed in-product (not a dead /packs link-out)
    expect(
      screen.getByRole("heading", {
        name: "Evidence-producing validation modules"
      })
    ).toBeInTheDocument();
    // Extension developer studio is Labs chrome, collapsed under <details>
    expect(
      screen.getByText(/Labs · Extension developer studio/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Extension developer studio/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByText(/not redistributed by Periscan/i).length
    ).toBeGreaterThan(0);
  });

  it("walks Accept license & install for RequiresLegalReview engines", async () => {
    const acceptBodies: unknown[] = [];
    const installCalls: string[] = [];

    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.endsWith("/api/v1/third-party-tools") && method === "GET") {
        return jsonResponse({
          items: [
            toolFixture({
              toolId: "semgrep",
              displayName: "Semgrep",
              license: "LGPL-2.1",
              policyStatus: "RequiresLegalReview",
              installStatus: "NotInstalled",
              enabled: false
            }),
            toolFixture({
              toolId: "gitleaks",
              displayName: "Gitleaks",
              license: "MIT",
              policyStatus: "Enabled",
              installStatus: "NotInstalled"
            })
          ]
        });
      }

      if (url.includes("/api/v1/third-party-tools/license-acceptances")) {
        if (method === "POST") {
          acceptBodies.push(JSON.parse(String(init?.body ?? "{}")));
          return {
            json: async () => ({
              acceptanceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              acceptedAt: now,
              acceptedBy: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              createdAt: now,
              spdx: "LGPL-2.1",
              tenantId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
              textHash: "a".repeat(64),
              toolId: "semgrep",
              version: "8.30.0"
            }),
            ok: true,
            status: 201
          };
        }
        return jsonResponse({ items: [] });
      }

      if (url.endsWith("/api/v1/third-party-tools/semgrep/install") && method === "POST") {
        installCalls.push("semgrep");
        return jsonResponse({
          action: "Install",
          completedAt: null,
          createdAt: now,
          jobId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          outputRedacted: null,
          reason: "Queued platform install",
          requestedBy: null,
          runtimeKind: "docker",
          startedAt: null,
          status: "Queued",
          tenantId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          toolId: "semgrep"
        });
      }

      if (url.endsWith("/api/v1/extensions/workspace")) {
        return jsonResponse({
          generatedAt: now,
          projects: [],
          releases: [],
          summary: {
            activeCatalogReleases: 0,
            certifiedReleases: 0,
            compatibilityFailures: 0,
            projects: 0,
            revokedReleases: 0,
            runtimeExecutionAuthorized: 0
          }
        });
      }

      if (url.endsWith("/api/v1/modules")) {
        return jsonResponse({ items: [] });
      }

      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    vi.stubGlobal("fetch", fetchImpl as unknown as typeof fetch);

    render(<ToolGovernanceMarketplace />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Semgrep" })).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: "Accept license & install" })
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Accept license & install" })
    );

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(/not redistributed/i)
    ).toBeInTheDocument();
    expect(within(dialog).getAllByText("LGPL-2.1").length).toBeGreaterThan(0);

    const confirm = within(dialog).getByRole("button", {
      name: "Accept license & install"
    });
    expect(confirm).toBeDisabled();

    fireEvent.click(within(dialog).getByRole("checkbox"));

    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    await waitFor(() => {
      expect(acceptBodies).toHaveLength(1);
      expect(acceptBodies[0]).toEqual(
        expect.objectContaining({
          authorized: true,
          toolId: "semgrep"
        })
      );
      expect(installCalls).toEqual(["semgrep"]);
    });
  });

  it("labels Community engines separately from legal-review and catalog theater", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/v1/third-party-tools")) {
        return jsonResponse({
          items: [
            toolFixture({
              toolId: "gitleaks",
              displayName: "Gitleaks",
              policyStatus: "Enabled",
              installStatus: "Installed",
              enabled: true
            }),
            toolFixture({
              toolId: "nmap",
              displayName: "Nmap",
              license: "NPSL",
              policyStatus: "Enabled",
              installStatus: "NotInstalled",
              enabled: false
            }),
            toolFixture({
              toolId: "semgrep",
              displayName: "Semgrep",
              license: "LGPL-2.1",
              policyStatus: "RequiresLegalReview",
              installStatus: "NotInstalled",
              enabled: false
            }),
            toolFixture({
              toolId: "atomic-red-team",
              displayName: "Atomic Red Team",
              policyStatus: "Enabled",
              installStatus: "NotInstalled",
              enabled: false
            }),
            toolFixture({
              toolId: "caldera",
              displayName: "MITRE Caldera",
              policyStatus: "Deferred",
              governanceStatus: "Blocked",
              installStatus: "NotInstalled",
              enabled: false
            }),
            toolFixture({
              toolId: "sharphound",
              displayName: "SharpHound",
              license: "GPL-3.0",
              policyStatus: "RequiresLegalReview",
              installStatus: "NotInstalled",
              enabled: false
            }),
            toolFixture({
              toolId: "sqlmap",
              displayName: "sqlmap",
              license: "GPL-2.0",
              policyStatus: "RequiresLegalReview",
              installStatus: "NotInstalled",
              enabled: false
            }),
            toolFixture({
              toolId: "metasploit",
              displayName: "Metasploit Framework",
              policyStatus: "Enabled",
              installStatus: "Installed",
              enabled: true
            })
          ]
        });
      }

      if (url.includes("/api/v1/third-party-tools/license-acceptances")) {
        return jsonResponse({ items: [] });
      }

      if (url.endsWith("/api/v1/extensions/workspace")) {
        return jsonResponse({
          generatedAt: now,
          projects: [],
          releases: [],
          summary: {
            activeCatalogReleases: 0,
            certifiedReleases: 0,
            compatibilityFailures: 0,
            projects: 0,
            revokedReleases: 0,
            runtimeExecutionAuthorized: 0
          }
        });
      }

      if (url.endsWith("/api/v1/modules")) {
        return jsonResponse({ items: [] });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal("fetch", fetchImpl as unknown as typeof fetch);

    render(<ToolGovernanceMarketplace />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Gitleaks" })).toBeInTheDocument();
    });

    const pack = screen.getByRole("region", {
      name: /Community-startable engines/i
    });
    expect(within(pack).getByText("Gitleaks")).toBeInTheDocument();
    expect(within(pack).getByText("Nmap")).toBeInTheDocument();
    expect(within(pack).queryByText("Atomic Red Team")).not.toBeInTheDocument();
    expect(within(pack).queryByText("MITRE Caldera")).not.toBeInTheDocument();
    expect(within(pack).queryByText("SharpHound")).not.toBeInTheDocument();
    expect(within(pack).queryByText("sqlmap")).not.toBeInTheDocument();
    expect(within(pack).queryByText("Metasploit Framework")).not.toBeInTheDocument();
    expect(within(pack).queryByText("Semgrep")).not.toBeInTheDocument();

    expect(
      screen.getByText(/Catalog-only rows are not Community validation/i)
    ).toBeInTheDocument();

    const gitleaksCard = screen.getByRole("heading", { name: "Gitleaks" })
      .closest("section");
    expect(gitleaksCard).not.toBeNull();
    expect(within(gitleaksCard as HTMLElement).getByText("Community")).toBeInTheDocument();
    expect(
      within(gitleaksCard as HTMLElement).getByRole("button", { name: "Use in mission" })
    ).toBeEnabled();

    const atomicCard = screen
      .getByRole("heading", { name: "Atomic Red Team" })
      .closest("section");
    expect(atomicCard).not.toBeNull();
    expect(within(atomicCard as HTMLElement).getByText("Catalog only")).toBeInTheDocument();
    expect(within(atomicCard as HTMLElement).queryByText("Community")).not.toBeInTheDocument();

    const metasploitCard = screen
      .getByRole("heading", { name: "Metasploit Framework" })
      .closest("section");
    expect(metasploitCard).not.toBeNull();
    expect(
      within(metasploitCard as HTMLElement).getByText("Catalog only")
    ).toBeInTheDocument();
    expect(
      within(metasploitCard as HTMLElement).queryByText("Community")
    ).not.toBeInTheDocument();
    expect(
      within(metasploitCard as HTMLElement).queryByRole("button", {
        name: "Use in mission"
      })
    ).not.toBeInTheDocument();

    const semgrepCard = screen
      .getByRole("heading", { name: "Semgrep" })
      .closest("section");
    expect(semgrepCard).not.toBeNull();
    expect(within(semgrepCard as HTMLElement).getByText("Legal review")).toBeInTheDocument();
    expect(within(semgrepCard as HTMLElement).queryByText("Community")).not.toBeInTheDocument();

    const lanes = screen.getByLabelText("Engine lanes");
    const communityLane = within(lanes).getByRole("button", {
      name: "Community"
    });
    expect(communityLane).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(communityLane);
    expect(communityLane).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "Gitleaks" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Nmap" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Atomic Red Team" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Metasploit Framework" })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "sqlmap" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Semgrep" })).not.toBeInTheDocument();

    fireEvent.click(
      within(lanes).getByRole("button", { name: "Legal review" })
    );
    expect(
      within(lanes).getByRole("button", { name: "Legal review" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(communityLane).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("heading", { name: "Semgrep" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Gitleaks" })).not.toBeInTheDocument();

    fireEvent.click(
      within(lanes).getByRole("button", { name: "Catalog only" })
    );
    expect(screen.getByRole("heading", { name: "Atomic Red Team" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Metasploit Framework" })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "sqlmap" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Gitleaks" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Semgrep" })).not.toBeInTheDocument();
  });

  it("never offers Accept license & install for Engine Lab theater tools", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/v1/third-party-tools")) {
        return jsonResponse({
          items: [
            toolFixture({
              toolId: "semgrep",
              displayName: "Semgrep",
              license: "LGPL-2.1",
              policyStatus: "RequiresLegalReview",
              installStatus: "NotInstalled",
              enabled: false
            }),
            toolFixture({
              toolId: "atomic-red-team",
              displayName: "Atomic Red Team",
              policyStatus: "Enabled",
              installStatus: "NotInstalled",
              enabled: false
            }),
            toolFixture({
              toolId: "caldera",
              displayName: "MITRE Caldera",
              policyStatus: "Deferred",
              governanceStatus: "Blocked",
              installStatus: "NotInstalled",
              enabled: false
            }),
            toolFixture({
              toolId: "sharphound",
              displayName: "SharpHound",
              license: "GPL-3.0",
              policyStatus: "RequiresLegalReview",
              installStatus: "NotInstalled",
              enabled: false
            }),
            toolFixture({
              toolId: "sqlmap",
              displayName: "sqlmap",
              license: "GPL-2.0",
              policyStatus: "RequiresLegalReview",
              installStatus: "NotInstalled",
              enabled: false
            }),
            toolFixture({
              toolId: "metasploit",
              displayName: "Metasploit Framework",
              policyStatus: "Enabled",
              installStatus: "Installed",
              enabled: true
            })
          ]
        });
      }

      if (url.includes("/api/v1/third-party-tools/license-acceptances")) {
        return jsonResponse({ items: [] });
      }

      if (url.endsWith("/api/v1/extensions/workspace")) {
        return jsonResponse({
          generatedAt: now,
          projects: [],
          releases: [],
          summary: {
            activeCatalogReleases: 0,
            certifiedReleases: 0,
            compatibilityFailures: 0,
            projects: 0,
            revokedReleases: 0,
            runtimeExecutionAuthorized: 0
          }
        });
      }

      if (url.endsWith("/api/v1/modules")) {
        return jsonResponse({ items: [] });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal("fetch", fetchImpl as unknown as typeof fetch);

    render(<ToolGovernanceMarketplace />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "sqlmap" })).toBeInTheDocument();
    });

    for (const name of [
      "sqlmap",
      "SharpHound",
      "Atomic Red Team",
      "MITRE Caldera",
      "Metasploit Framework"
    ]) {
      const card = screen.getByRole("heading", { name }).closest("section");
      expect(card, name).not.toBeNull();
      expect(
        within(card as HTMLElement).queryByRole("button", {
          name: "Accept license & install"
        })
      ).not.toBeInTheDocument();
      expect(
        within(card as HTMLElement).queryByRole("button", {
          name: "Review license"
        })
      ).not.toBeInTheDocument();
      expect(
        within(card as HTMLElement).queryByRole("button", {
          name: /install/i
        })
      ).not.toBeInTheDocument();
      expect(
        within(card as HTMLElement).queryByRole("button", {
          name: "Enable for tenant"
        })
      ).not.toBeInTheDocument();
    }

    const semgrepCard = screen
      .getByRole("heading", { name: "Semgrep" })
      .closest("section");
    expect(semgrepCard).not.toBeNull();
    expect(
      within(semgrepCard as HTMLElement).getByRole("button", {
        name: "Accept license & install"
      })
    ).toBeInTheDocument();
  });
});
