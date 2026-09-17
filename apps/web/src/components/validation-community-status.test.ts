import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  COMMUNITY_VALIDATE_SCOPE_TYPES,
  VALIDATE_EMPTY_SCOPE_COPY,
  buildCommunityAddScopeInput,
  communityAddScopePlaceholder,
  communityScopeAllowsOperatorAttestation,
  communityStartNowCopy,
  communityStartRequestModuleIds,
  communityVerifyFailureCopy,
  communityVerifyScopeRequest,
  communityVerifyTokenHint,
  computeValidationStageStatus,
  deferredModuleAction,
  nothingStartableCopy,
  nucleiStartCopy,
  parsePinnedCommunityModuleIds,
  resolveCommunityAddScopeType,
  resolveCommunityStartNowModuleIds
} from "./validation-community-status";

describe("computeValidationStageStatus", () => {
  it("starts on Scope when nothing is selected", () => {
    expect(
      computeValidationStageStatus({
        hasScope: false,
        verified: false,
        communityStarted: false,
        snapshotReady: false
      })
    ).toEqual({
      done: {
        Scope: false,
        Verify: false,
        Readiness: false,
        Run: false,
        Results: false
      },
      active: "Scope"
    });
  });

  it("keeps Run pending after verify until Community start or snapshot", () => {
    expect(
      computeValidationStageStatus({
        hasScope: true,
        verified: true,
        communityStarted: false,
        snapshotReady: false
      }).done.Run
    ).toBe(false);
  });

  it("counts a Community start as Run even without a snapshot report", () => {
    const status = computeValidationStageStatus({
      hasScope: true,
      verified: true,
      communityStarted: true,
      snapshotReady: false
    });
    expect(status.done.Run).toBe(true);
    expect(status.done.Results).toBe(false);
    expect(status.active).toBe("Results");
  });

  it("does not treat a snapshot report as the only way to complete Run", () => {
    const snapshotOnly = computeValidationStageStatus({
      hasScope: true,
      verified: true,
      communityStarted: false,
      snapshotReady: true
    });
    expect(snapshotOnly.done.Run).toBe(true);
    expect(snapshotOnly.done.Results).toBe(true);
    expect(snapshotOnly.active).toBeUndefined();
  });
});

describe("deferredModuleAction", () => {
  it("sends runner-missing engines to enroll a runner", () => {
    expect(
      deferredModuleAction("Enroll an internal runner to start this engine.")
    ).toEqual({ href: "/runners", label: "Enroll a runner" });
  });

  it("sends AWS-missing engines to connect AWS", () => {
    expect(
      deferredModuleAction("Connect an AWS integration to start Prowler.")
    ).toEqual({ href: "/integrations", label: "Connect AWS" });
  });

  it("does not invent a setup path for Nuclei second-mission deferral", () => {
    expect(
      deferredModuleAction(
        "Started as a second mission so a PoA deny cannot block the rest of the pack."
      )
    ).toBeNull();
  });
});

describe("honest Community engine start count", () => {
  const startable38 = [
    "gitleaks.repo_secrets",
    ...Array.from({ length: 37 }, (_, index) => `community.engine_${index + 2}`)
  ];
  const deferredProwler = {
    moduleId: "prowler.aws_posture",
    reason: "Connect an AWS integration to start Prowler.",
    title: "Prowler AWS posture"
  };
  const deferredRunner = {
    moduleId: "syft.repo_sbom",
    reason: "Enroll an internal runner to start this engine.",
    title: "Syft SBOM"
  };

  it("does not count deferred Prowler as an engine that will start now", () => {
    expect(
      resolveCommunityStartNowModuleIds({
        startableModuleIds: startable38,
        pinnedModuleIds: ["gitleaks.repo_secrets", "prowler.aws_posture"]
      })
    ).toEqual(["gitleaks.repo_secrets"]);
    expect(
      communityStartNowCopy({
        cloudAwsAvailable: false,
        deferredModules: [deferredProwler],
        pinnedModuleIds: ["prowler.aws_posture"],
        runnerAvailable: true,
        startableModuleIds: startable38
      })
    ).toBe("0 engines start now · AWS needed for Prowler.");
    expect(
      communityStartNowCopy({
        cloudAwsAvailable: false,
        deferredModules: [deferredProwler],
        runnerAvailable: true,
        startableModuleIds: startable38
      })
    ).toBe("1 engine start now.");
    expect(
      communityStartNowCopy({
        cloudAwsAvailable: false,
        deferredModules: [deferredProwler],
        pack: "full",
        runnerAvailable: true,
        startableModuleIds: startable38
      })
    ).toBe("38 engines start now · AWS needed for Prowler.");
    expect(
      communityStartNowCopy({
        cloudAwsAvailable: false,
        deferredModules: [deferredProwler],
        pack: "full",
        runnerAvailable: true,
        startableModuleIds: startable38
      })
    ).not.toMatch(/39 engines start now/);
  });

  it("names 1 engine when a first-hour helper pins gitleaks.repo_secrets", () => {
    expect(
      parsePinnedCommunityModuleIds("?moduleIds=gitleaks.repo_secrets")
    ).toEqual(["gitleaks.repo_secrets"]);
    expect(
      resolveCommunityStartNowModuleIds({
        pinnedModuleIds: ["gitleaks.repo_secrets"],
        startableModuleIds: startable38
      })
    ).toEqual(["gitleaks.repo_secrets"]);
    expect(
      communityStartNowCopy({
        cloudAwsAvailable: false,
        deferredModules: [deferredRunner],
        pinnedModuleIds: ["gitleaks.repo_secrets"],
        runnerAvailable: false,
        startableModuleIds: startable38
      })
    ).toBe("1 engine start now.");
    expect(
      communityStartRequestModuleIds({
        pinnedModuleIds: ["gitleaks.repo_secrets"],
        startableModuleIds: startable38
      })
    ).toEqual(["gitleaks.repo_secrets"]);
  });

  it("defaults unpinned Repository start to Gitleaks, not the 38-engine pack", () => {
    expect(
      resolveCommunityStartNowModuleIds({
        startableModuleIds: startable38
      })
    ).toEqual(["gitleaks.repo_secrets"]);
    expect(
      communityStartNowCopy({
        cloudAwsAvailable: false,
        deferredModules: [deferredRunner],
        runnerAvailable: false,
        startableModuleIds: startable38
      })
    ).toBe("1 engine start now.");
    expect(
      communityStartRequestModuleIds({
        startableModuleIds: startable38
      })
    ).toEqual(["gitleaks.repo_secrets"]);
  });

  it("still names 38 engines for the full Community pack control", () => {
    expect(
      resolveCommunityStartNowModuleIds({
        pack: "full",
        startableModuleIds: startable38
      })
    ).toEqual(startable38);
    expect(
      communityStartNowCopy({
        cloudAwsAvailable: false,
        deferredModules: [deferredRunner],
        pack: "full",
        runnerAvailable: false,
        startableModuleIds: startable38
      })
    ).toBe("38 engines start now · runner needed.");
    expect(
      communityStartRequestModuleIds({
        pack: "full",
        startableModuleIds: startable38
      })
    ).toEqual(startable38);
  });

  it("does not advertise AWS for Prowler on a first-hour Repository start", () => {
    expect(
      communityStartNowCopy({
        cloudAwsAvailable: false,
        deferredModules: [deferredRunner],
        runnerAvailable: false,
        startableModuleIds: startable38
      })
    ).not.toMatch(/AWS needed for Prowler/);
  });

  it("parses repeated or comma-separated moduleIds pins and ignores blanks", () => {
    expect(
      parsePinnedCommunityModuleIds(
        "moduleIds=gitleaks.repo_secrets,trivy.repo_dependency_scan&moduleIds="
      )
    ).toEqual(["gitleaks.repo_secrets", "trivy.repo_dependency_scan"]);
    expect(parsePinnedCommunityModuleIds(new URLSearchParams())).toEqual([]);
  });
});

describe("nothingStartableCopy", () => {
  it("names runner and AWS gaps when both are missing", () => {
    expect(
      nothingStartableCopy({
        cloudAwsAvailable: false,
        runnerAvailable: false
      })
    ).toBe("No engines can start yet — enroll a runner or connect AWS.");
  });

  it("names only the missing lane", () => {
    expect(
      nothingStartableCopy({
        cloudAwsAvailable: true,
        runnerAvailable: false
      })
    ).toBe("No engines can start yet — enroll a runner.");
  });
});

describe("nucleiStartCopy", () => {
  it("reports Nuclei started when a second mission id is present", () => {
    expect(
      nucleiStartCopy({
        nucleiMissionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        nucleiSkipReason: null
      })
    ).toEqual({
      kind: "started",
      text: "Nuclei started as a second mission (aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa)."
    });
  });

  it("reports Nuclei skipped with the server reason", () => {
    expect(
      nucleiStartCopy({
        nucleiMissionId: null,
        nucleiSkipReason:
          "Nuclei External PoA was denied (kill switch, rate, or hostname guard). The rest of the Community pack still queued."
      })
    ).toEqual({
      kind: "skipped",
      text: "Nuclei External PoA was denied (kill switch, rate, or hostname guard). The rest of the Community pack still queued."
    });
  });

  it("stays quiet when Nuclei was not part of the start", () => {
    expect(
      nucleiStartCopy({
        nucleiMissionId: null,
        nucleiSkipReason: null
      })
    ).toEqual({ kind: "not-started", text: null });
  });
});

describe("Validate policy preview honesty", () => {
  it("previews the live Community start set instead of a hardcoded ControlPlane worker", () => {
    const source = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "validation-snapshot-flow.tsx"
      ),
      "utf8"
    );
    expect(source).toContain("communityPolicyPreviewRequest");
    expect(source).toContain("runnerAvailable: suite.data.runnerAvailable");
    expect(source).toContain("cloudAwsAvailable: suite.data.cloudAwsAvailable");
    expect(source).not.toMatch(/executionEnvironment:\s*"ControlPlane"/);
  });
});

describe("resolveCommunityAddScopeType", () => {
  it("switches type for CIDR, repository path, and 12-digit AWS pastes", () => {
    expect(resolveCommunityAddScopeType("10.0.0.0/24", "Domain")).toBe(
      "IPRange"
    );
    expect(resolveCommunityAddScopeType("/opt/customer/repo", "Domain")).toBe(
      "Repository"
    );
    expect(
      resolveCommunityAddScopeType(
        "https://github.com/acme/payments-api",
        "Domain"
      )
    ).toBe("Repository");
    expect(resolveCommunityAddScopeType("123456789012", "Domain")).toBe(
      "CloudAccount"
    );
    expect(
      resolveCommunityAddScopeType("arn:aws:iam::123456789012:root", "Domain")
    ).toBe("CloudAccount");
  });

  it("does not overwrite Subdomain when the user typed a hostname", () => {
    expect(resolveCommunityAddScopeType("app.example.com", "Subdomain")).toBe(
      "Subdomain"
    );
    expect(
      resolveCommunityAddScopeType("https://app.example.com/login", "Subdomain")
    ).toBe("Subdomain");
  });

  it("keeps Domain when the paste is a hostname and Domain is selected", () => {
    expect(resolveCommunityAddScopeType("example.com", "Domain")).toBe(
      "Domain"
    );
  });

  it("keeps the selected type when the value is ambiguous", () => {
    expect(resolveCommunityAddScopeType("not a scope", "Repository")).toBe(
      "Repository"
    );
  });
});

describe("community add/verify helpers", () => {
  it("exposes Domain, Subdomain, Repository, CloudAccount, and IPRange", () => {
    expect([...COMMUNITY_VALIDATE_SCOPE_TYPES]).toEqual([
      "Domain",
      "Subdomain",
      "Repository",
      "CloudAccount",
      "IPRange"
    ]);
  });

  it("uses honest placeholders per type", () => {
    expect(communityAddScopePlaceholder("Domain")).toBe("example.com");
    expect(communityAddScopePlaceholder("Subdomain")).toBe("app.example.com");
    expect(communityAddScopePlaceholder("Repository")).toBe(
      "/opt/customer/repo"
    );
    expect(communityAddScopePlaceholder("CloudAccount")).toBe("123456789012");
    expect(communityAddScopePlaceholder("IPRange")).toBe("10.0.0.0/24");
  });

  it("builds create-scope input with inferred type and asset class", () => {
    expect(buildCommunityAddScopeInput("/opt/customer/repo", "Domain")).toEqual(
      {
        assetClass: "Code",
        scopeType: "Repository",
        value: "/opt/customer/repo"
      }
    );
    expect(buildCommunityAddScopeInput("10.0.0.0/24", "Domain")).toEqual({
      assetClass: "Network",
      scopeType: "IPRange",
      value: "10.0.0.0/24"
    });
    expect(buildCommunityAddScopeInput("123456789012", "Domain")).toEqual({
      assetClass: "Cloud",
      scopeType: "CloudAccount",
      value: "123456789012"
    });
    expect(buildCommunityAddScopeInput("app.example.com", "Subdomain")).toEqual(
      {
        assetClass: "BusinessApplication",
        scopeType: "Subdomain",
        value: "app.example.com"
      }
    );
  });

  it("allows operator attestation only for non-DNS types", () => {
    expect(communityScopeAllowsOperatorAttestation("Domain")).toBe(false);
    expect(communityScopeAllowsOperatorAttestation("Subdomain")).toBe(false);
    expect(communityScopeAllowsOperatorAttestation("Repository")).toBe(true);
    expect(communityScopeAllowsOperatorAttestation("CloudAccount")).toBe(true);
    expect(communityScopeAllowsOperatorAttestation("IPRange")).toBe(true);
  });

  it("sends operatorAttestation only when attesting", () => {
    expect(communityVerifyScopeRequest(false)).toEqual({});
    expect(communityVerifyScopeRequest(true)).toEqual({
      operatorAttestation: true
    });
  });

  it("hints DNS vs token file vs generic verification", () => {
    expect(communityVerifyTokenHint("Domain")).toBe("DNS TXT _periscan.");
    expect(communityVerifyTokenHint("Repository")).toBe(
      ".periscan-authorization"
    );
    expect(communityVerifyTokenHint("CloudAccount")).toBe("");
    expect(communityVerifyFailureCopy("Domain")).toMatch(/DNS/);
    expect(communityVerifyFailureCopy("IPRange")).not.toMatch(/DNS/);
  });

  it("mentions domain, repo path, AWS account, or CIDR in empty-state copy", () => {
    expect(VALIDATE_EMPTY_SCOPE_COPY).toMatch(/domain/i);
    expect(VALIDATE_EMPTY_SCOPE_COPY).toMatch(/repository path/i);
    expect(VALIDATE_EMPTY_SCOPE_COPY).toMatch(/AWS account/i);
    expect(VALIDATE_EMPTY_SCOPE_COPY).toMatch(/CIDR/i);
  });
});

describe("Validate add-scope surface", () => {
  const flowSource = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "validation-snapshot-flow.tsx"
    ),
    "utf8"
  );

  it("names the engines that will queue, not the raw startable catalog count", () => {
    expect(flowSource).toContain("communityStartNowCopy");
    expect(flowSource).toContain("parsePinnedCommunityModuleIds");
    expect(flowSource).toContain("communityStartRequestModuleIds");
    expect(flowSource).not.toMatch(
      /startableModuleIds\.length\}{" "\}[\s\S]{0,80}start\s+now/
    );
  });

  it("lets Community start from Domain, repo, AWS, and CIDR without leaving the page", () => {
    expect(flowSource).toContain("COMMUNITY_VALIDATE_SCOPE_TYPES");
    expect(flowSource).toContain("buildCommunityAddScopeInput");
    expect(flowSource).toContain("communityScopeAllowsOperatorAttestation");
    expect(flowSource).toContain("communityVerifyScopeRequest");
    expect(flowSource).toContain("VALIDATE_EMPTY_SCOPE_COPY");
    expect(flowSource).toContain("Attest authorization");
    expect(flowSource).toContain("Run Community validation");
    expect(flowSource).toMatch(
      /api\.verifyScope\([^,]+,\s*communityVerifyScopeRequest/
    );
    expect(flowSource).not.toMatch(/Add domain/);
  });

  it("underlines in-paragraph Community links and rings the scope value field", () => {
    expect(flowSource).toMatch(
      /aria-label="Scope value"\s+className="[^"]*focus-visible:ring-2 focus-visible:ring-brand/
    );
    expect(flowSource).toMatch(/href="\/schedules"[\s\S]{0,160}underline/);
    expect(flowSource).toMatch(/href="\/trust-safety"[\s\S]{0,120}underline/);
  });

  it("does not lead Validate with design-partner or Wave GTM copy", () => {
    expect(flowSource).toMatch(
      /Authorize a verified scope, preview policy, then Run Community/
    );
    expect(flowSource).not.toContain("Path to first design partner");
    expect(flowSource).not.toContain("REFERENCE_FACTORY");
    expect(flowSource).not.toMatch(/Wave market[- ]presence/i);
    expect(flowSource).not.toContain("validate-path-to-first-design-partner");
    expect(flowSource).not.toContain("design-partner");
    expect(flowSource).not.toContain("REFERENCE_FACTORY.md");
  });

  it("is authorize (if needed) → preview policy → Run Community, without leftover density", () => {
    expect(flowSource).toContain("selectedScope && !gateOk");
    expect(flowSource).toContain("Preview policy decision");
    expect(flowSource).toContain('data-testid="run-community-validation"');
    expect(flowSource).toContain("PageShell");
    expect(flowSource).toContain("PageHeader");
    expect(flowSource).not.toContain("ProofLoopStepper");
    expect(flowSource).not.toContain("ReadinessTile");
    expect(flowSource).not.toContain("Signal & tool readiness");
    expect(flowSource).not.toContain("1 · Scope readiness");
    expect(flowSource).not.toContain("2 · Signal");
    expect(flowSource).not.toContain("3 · Policy gate");
    expect(flowSource).not.toContain("Governed tools");
    expect(flowSource).not.toContain("listIntegrations");
    expect(flowSource).not.toContain("listThirdPartyTools");
    expect(flowSource).not.toMatch(/VALIDATION_PROOF_STAGES/);
  });

  it("keeps Community as the primary run and collapses compose snapshot", () => {
    expect(flowSource).toContain('data-testid="run-community-validation"');
    expect(flowSource).toContain("Preview policy decision");
    expect(flowSource).toMatch(
      /<details[\s\S]*data-testid="compose-snapshot-report"/
    );
    expect(flowSource).toMatch(
      /data-testid="compose-snapshot-report"[\s\S]*Compose snapshot report/
    );
    expect(flowSource).toMatch(
      /data-testid="compose-snapshot-report"[\s\S]{0,280}focus-visible:ring-2 focus-visible:ring-brand/
    );
    const communityIdx = flowSource.indexOf(
      'data-testid="run-community-validation"'
    );
    const composeDetailsIdx = flowSource.indexOf(
      'data-testid="compose-snapshot-report"'
    );
    const policyIdx = flowSource.indexOf("Preview policy decision");
    expect(communityIdx).toBeGreaterThan(-1);
    expect(composeDetailsIdx).toBeGreaterThan(communityIdx);
    expect(policyIdx).toBeGreaterThan(-1);
    expect(policyIdx).toBeLessThan(communityIdx);
    expect(policyIdx).toBeLessThan(composeDetailsIdx);
  });

  it("keeps zero public-ref honesty in help, not a GTM strip", () => {
    expect(flowSource).toContain('label="public references"');
    expect(flowSource).toMatch(/Public customer references remain 0/);
    expect(flowSource).not.toMatch(
      /<h1[^>]*>[\s\S]{0,80}Public customer references remain 0/
    );
  });

  it("uses incumbent tokens instead of a one-off palette", () => {
    expect(flowSource).toMatch(/text-ink/);
    expect(flowSource).toMatch(/text-muted/);
    expect(flowSource).toMatch(/border-line/);
    expect(flowSource).toMatch(/bg-surface/);
    expect(flowSource).toMatch(/text-brand/);
    expect(flowSource).toMatch(/rounded-control/);
    expect(flowSource).not.toMatch(/#F4F1EA|#00ff88|font-\[Inter\]/);
  });
});
