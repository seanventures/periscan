import { describe, expect, it } from "vitest";

import {
  COMMUNITY_EDITION_ID,
  COMMUNITY_EDITION_VALUE_LINE,
  COMMUNITY_PROWLER_AWS_CONNECT_REASON,
  COMMUNITY_REPOSITORY_AUTH_FILENAME,
  COMMUNITY_VALIDATION_SUITE,
  COMMUNITY_VALIDATION_TOOL_IDS,
  COPYLEFT_OPT_IN_SUITE,
  ENGINE_LAB_THEATER_TOOL_IDS,
  isCopyleftOptInModuleId,
  isCopyleftOptInToolId,
  targetHasUpstreamLicense,
  buildCommunityValidationTarget,
  classifyEngineLabHonesty,
  communityEditionExcludesOffensivePacks,
  communityPolicyCoversStartSet,
  communityPolicyPreviewRequest,
  communityScopeAuthorizationHint,
  communityScopeVerificationKind,
  communitySuiteUsesRunnerOssAllowlist,
  communityValidationSafetyLevel,
  communityValidationStartLane,
  scheduleRequestsCommunityValidation,
  extractAwsAccountId,
  inferCommunityScopeType,
  isCommunityValidationModuleId,
  isCommunityValidationToolId,
  latestCommunityActivationRun,
  resolveCommunityActivationNextAction,
  COMMUNITY_FIRST_RUN_REVIEW_EMPTY_LABEL,
  COMMUNITY_FIRST_RUN_REVIEW_LABEL,
  COMMUNITY_FIRST_RUN_START_LABEL,
  COMMUNITY_FIRST_RUN_WATCH_LABEL,
  isConnectedAwsIntegrationForProwler,
  listCommunityRunnerLaneEntries,
  listCommunityValidationDeferredModules,
  listCommunityValidationStartModules,
  listCommunityValidationSuiteForScopeType,
  selectCommunityNucleiCompanionMissionId,
  selectConnectedAwsIntegrationForProwler,
  summarizeCommunityMissionRuns
} from "./community-edition.js";
import { OpenSourceToolIdSchema } from "./open-source.js";

describe("Community edition validation suite", () => {
  it("is the community product slice, not a license flip", () => {
    expect(COMMUNITY_EDITION_ID).toBe("community");
    expect(communityEditionExcludesOffensivePacks()).toBe(true);
    expect(communitySuiteUsesRunnerOssAllowlist()).toBe(true);
  });

  it("opt-in Community schedule fire only when ValidationSnapshot sets the boolean flag", () => {
    expect(
      scheduleRequestsCommunityValidation("ValidationSnapshot", {
        communityValidation: true
      })
    ).toBe(true);
    expect(scheduleRequestsCommunityValidation("ValidationSnapshot", {})).toBe(
      false
    );
    expect(
      scheduleRequestsCommunityValidation("ValidationSnapshot", {
        communityValidation: "true"
      })
    ).toBe(false);
    expect(
      scheduleRequestsCommunityValidation("ContinuousValidation", {
        communityValidation: true
      })
    ).toBe(false);
  });

  it("selects repo engines for Repository scopes and host engines for Domain", () => {
    const repo = listCommunityValidationSuiteForScopeType("Repository");
    expect(repo.map((entry) => entry.moduleId)).toEqual(
      expect.arrayContaining([
        "gitleaks.repo_secrets",
        "trivy.repo_dependency_scan",
        "grype.repo_vulnerability_scan"
      ])
    );
    expect(
      repo.every((entry) => entry.moduleId !== "nuclei.external_exposure_safe")
    ).toBe(true);

    const domain = listCommunityValidationSuiteForScopeType("Domain");
    expect(domain.map((entry) => entry.moduleId)).toEqual(
      expect.arrayContaining([
        "periscan.dns_resolution_check",
        "periscan.tls_protocol_audit",
        "web.zap_baseline",
        "nuclei.external_exposure_safe"
      ])
    );
  });

  it("omits ExternalPoA Nuclei from the primary start set", () => {
    const started = listCommunityValidationStartModules({
      scopeType: "Domain"
    });
    expect(
      started.some(
        (entry) => entry.moduleId === "nuclei.external_exposure_safe"
      )
    ).toBe(false);
    expect(
      listCommunityValidationStartModules({
        includeExternalPoa: true,
        scopeType: "Domain"
      }).some((entry) => entry.moduleId === "nuclei.external_exposure_safe")
    ).toBe(true);
  });

  it("packs first-party DNS/TLS/HTTP depth and defers runner recon until enrolled", () => {
    const domain = listCommunityValidationSuiteForScopeType("Domain");
    expect(domain.map((entry) => entry.moduleId)).toEqual(
      expect.arrayContaining([
        "periscan.dns_email_security_check",
        "periscan.tls_certificate_check",
        "periscan.http_cookie_security",
        "recon.subdomain_enum"
      ])
    );
    const withoutRunner = listCommunityValidationStartModules({
      runnerAvailable: false,
      scopeType: "Domain"
    });
    expect(
      withoutRunner.some((entry) => entry.moduleId === "recon.subdomain_enum")
    ).toBe(false);
    const withRunner = listCommunityValidationStartModules({
      runnerAvailable: true,
      scopeType: "Domain"
    });
    expect(
      withRunner.some((entry) => entry.moduleId === "recon.subdomain_enum")
    ).toBe(true);
    expect(
      listCommunityValidationStartModules({
        cloudAwsAvailable: true,
        scopeType: "CloudAccount"
      }).map((entry) => entry.moduleId)
    ).toContain("prowler.aws_posture");
    expect(
      listCommunityValidationStartModules({
        cloudAwsAvailable: false,
        scopeType: "CloudAccount"
      }).map((entry) => entry.moduleId)
    ).not.toContain("prowler.aws_posture");
    expect(
      listCommunityValidationDeferredModules({
        cloudAwsAvailable: false,
        scopeType: "CloudAccount"
      })
    ).toEqual(
      expect.arrayContaining([
        {
          moduleId: "prowler.aws_posture",
          reason: COMMUNITY_PROWLER_AWS_CONNECT_REASON,
          title: "Prowler AWS posture"
        }
      ])
    );
    expect(
      listCommunityValidationDeferredModules({
        cloudAwsAvailable: true,
        runnerAvailable: true,
        scopeType: "CloudAccount"
      })
    ).toEqual([]);
  });

  it("treats only a Connected CloudAccount AWS integration as Prowler-ready", () => {
    expect(
      isConnectedAwsIntegrationForProwler({
        product: "AWS",
        status: "Connected",
        vendor: "AWS"
      })
    ).toBe(true);
    expect(
      isConnectedAwsIntegrationForProwler({
        product: "AWS",
        status: "Created",
        vendor: "AWS"
      })
    ).toBe(false);
    expect(
      isConnectedAwsIntegrationForProwler({
        product: "AWS Bedrock",
        status: "Connected",
        vendor: "AWS"
      })
    ).toBe(false);
    expect(
      isConnectedAwsIntegrationForProwler({
        product: "AWS WAF",
        status: "Connected",
        vendor: "AWS"
      })
    ).toBe(false);
    expect(
      isConnectedAwsIntegrationForProwler({
        product: "Elastic Container Registry",
        status: "Connected",
        vendor: "AWS"
      })
    ).toBe(false);
    expect(
      selectConnectedAwsIntegrationForProwler([
        {
          integrationId: "bedrock",
          product: "AWS Bedrock",
          status: "Connected",
          vendor: "AWS"
        },
        {
          integrationId: "account",
          product: "AWS",
          status: "Connected",
          vendor: "AWS"
        }
      ])?.integrationId
    ).toBe("account");
  });

  it("builds a hostname target that also carries url for ZAP", () => {
    const entries = listCommunityValidationStartModules({
      scopeType: "Domain"
    });
    expect(communityValidationSafetyLevel(entries)).toBe("ActiveNonInvasive");
    expect(
      buildCommunityValidationTarget({
        entries,
        scopeType: "Domain",
        scopeValue: "https://app.example.com/login"
      })
    ).toMatchObject({
      hostname: "app.example.com",
      protocol: "https",
      url: "https://app.example.com"
    });
  });

  it("maps CloudAccount scope value onto the Prowler awsIntegrationId target", () => {
    expect(
      buildCommunityValidationTarget({
        awsIntegrationId: "33333333-3333-4333-8333-333333333333",
        entries: listCommunityValidationStartModules({
          cloudAwsAvailable: true,
          scopeType: "CloudAccount"
        }),
        scopeType: "CloudAccount",
        scopeValue: "123456789012"
      })
    ).toEqual({
      awsAccountId: "123456789012",
      awsIntegrationId: "33333333-3333-4333-8333-333333333333"
    });
  });

  it("maps Repository scope value to repositoryPath", () => {
    expect(
      buildCommunityValidationTarget({
        entries: COMMUNITY_VALIDATION_SUITE.filter(
          (entry) => entry.moduleId === "gitleaks.repo_secrets"
        ),
        scopeType: "Repository",
        scopeValue: "/opt/customer/repo"
      })
    ).toEqual({
      repositoryName: "repo",
      repositoryPath: "/opt/customer/repo"
    });
  });

  it("never lists live-offensive module ids", () => {
    expect(isCommunityValidationModuleId("caldera.advanced_adversarial")).toBe(
      false
    );
    expect(isCommunityValidationModuleId("gitleaks.repo_secrets")).toBe(true);
  });

  it("picks the latest Community run by moduleId, not an edition column", () => {
    const latest = latestCommunityActivationRun([
      {
        missionId: "non-community",
        moduleId: "caldera.advanced_adversarial",
        status: "Running"
      },
      {
        missionId: "community-mission",
        moduleId: "gitleaks.repo_secrets",
        status: "Queued"
      }
    ]);
    expect(latest?.missionId).toBe("community-mission");
    expect(latestCommunityActivationRun([])).toBeNull();
  });

  it("watches an in-flight Community run and reviews a failed one", () => {
    expect(
      resolveCommunityActivationNextAction({
        missionId: "11111111-1111-4111-8111-111111111111",
        status: "Queued"
      })
    ).toMatchObject({
      href: "/missions/11111111-1111-4111-8111-111111111111",
      label: COMMUNITY_FIRST_RUN_WATCH_LABEL
    });
    expect(
      resolveCommunityActivationNextAction({
        errorSummary: "engine exited 1",
        missionId: "22222222-2222-4222-8222-222222222222",
        status: "Failed"
      })
    ).toMatchObject({
      href: "/missions/22222222-2222-4222-8222-222222222222",
      label: COMMUNITY_FIRST_RUN_REVIEW_LABEL,
      reason: "engine exited 1"
    });
    expect(
      resolveCommunityActivationNextAction({
        missionId: "33333333-3333-4333-8333-333333333333",
        status: "Completed"
      })
    ).toMatchObject({
      href: "/missions/33333333-3333-4333-8333-333333333333",
      label: COMMUNITY_FIRST_RUN_REVIEW_EMPTY_LABEL
    });
    expect(resolveCommunityActivationNextAction(null)).toMatchObject({
      href: "/missions",
      label: COMMUNITY_FIRST_RUN_START_LABEL
    });
  });

  it("infers Community scope types from pasted values", () => {
    expect(inferCommunityScopeType("app.example.com")).toBe("Domain");
    expect(inferCommunityScopeType("https://app.example.com/login")).toBe(
      "Domain"
    );
    expect(inferCommunityScopeType("10.0.0.0/24")).toBe("IPRange");
    expect(inferCommunityScopeType("123456789012")).toBe("CloudAccount");
    expect(inferCommunityScopeType("arn:aws:iam::123456789012:root")).toBe(
      "CloudAccount"
    );
    expect(inferCommunityScopeType("/opt/customer/repo")).toBe("Repository");
    expect(inferCommunityScopeType("not a scope")).toBeNull();
    expect(extractAwsAccountId("aws account 123456789012")).toBe(
      "123456789012"
    );
    expect(communityScopeVerificationKind("Repository")).toBe(
      "repository_token_file"
    );
    expect(communityScopeAuthorizationHint("Repository")).toContain(
      COMMUNITY_REPOSITORY_AUTH_FILENAME
    );
  });

  it("previews ControlPlane for worker-only start sets and InternalRunner when a runner lane will start", () => {
    const domainWorker = communityPolicyPreviewRequest({
      runnerAvailable: false,
      scopeType: "Domain"
    });
    expect(domainWorker).toEqual({
      executionEnvironment: "ControlPlane",
      requestedAction: {
        credentialTheft: false,
        destructive: false,
        persistence: false,
        realDataExfiltration: false,
        requiresInternalRunner: false,
        requiresTimeWindow: false,
        uncontrolledExploitChaining: false
      },
      safetyLevel: "ActiveNonInvasive"
    });

    const domainWithRunner = communityPolicyPreviewRequest({
      includeExternalPoa: true,
      runnerAvailable: true,
      scopeType: "Domain"
    });
    expect(domainWithRunner.executionEnvironment).toBe("InternalRunner");
    expect(domainWithRunner.requestedAction.requiresInternalRunner).toBe(true);
    expect(domainWithRunner.safetyLevel).toBe("ActiveNonInvasive");

    const repoWorker = communityPolicyPreviewRequest({
      runnerAvailable: false,
      scopeType: "Repository"
    });
    expect(repoWorker.executionEnvironment).toBe("ControlPlane");
    expect(repoWorker.requestedAction.requiresInternalRunner).toBe(false);
    expect(repoWorker.safetyLevel).toBe("PassiveReadOnly");

    const repoWithRunner = communityPolicyPreviewRequest({
      runnerAvailable: true,
      scopeType: "Repository"
    });
    expect(repoWithRunner.executionEnvironment).toBe("InternalRunner");
    expect(repoWithRunner.requestedAction.requiresInternalRunner).toBe(true);
    expect(repoWithRunner.safetyLevel).toBe("PassiveReadOnly");

    const cloud = communityPolicyPreviewRequest({
      cloudAwsAvailable: true,
      scopeType: "CloudAccount"
    });
    expect(cloud.executionEnvironment).toBe("ControlPlane");
    expect(cloud.requestedAction.requiresInternalRunner).toBe(false);
    expect(cloud.safetyLevel).toBe("PassiveReadOnly");
  });

  it("never lets Nuclei ExternalPoA become the primary Community policy preview", () => {
    const preview = communityPolicyPreviewRequest({
      includeExternalPoa: true,
      runnerAvailable: false,
      scopeType: "Domain"
    });
    expect(preview.executionEnvironment).toBe("ControlPlane");
    expect(preview.executionEnvironment).not.toBe("ExternalPoA");
  });

  it("rejects a ControlPlane policy when the start set includes InternalRunner modules", () => {
    const runnerSet = listCommunityValidationStartModules({
      runnerAvailable: true,
      scopeType: "Domain"
    });
    const workerSet = listCommunityValidationStartModules({
      runnerAvailable: false,
      scopeType: "Domain"
    });
    expect(communityPolicyCoversStartSet("ControlPlane", runnerSet)).toBe(
      false
    );
    expect(communityPolicyCoversStartSet("InternalRunner", runnerSet)).toBe(
      true
    );
    expect(communityPolicyCoversStartSet("ControlPlane", workerSet)).toBe(true);
    expect(communityPolicyCoversStartSet("InternalRunner", workerSet)).toBe(
      true
    );
    expect(communityPolicyCoversStartSet("ExternalPoA", workerSet)).toBe(false);
    expect(communityPolicyCoversStartSet("ExternalPoA", runnerSet)).toBe(false);
  });

  it("limits the runner lane to OSS/recon engines, not first-party ControlPlane checks", () => {
    expect(
      listCommunityRunnerLaneEntries().map((entry) => entry.moduleId)
    ).toEqual(
      expect.arrayContaining([
        "syft.sbom_generate",
        "recon.subdomain_enum",
        "recon.http_probe",
        "recon.dns_probe",
        "recon.host_discovery",
        "recon.service_inventory",
        "tlsx.tls_probe",
        "naabu.port_inventory",
        "amass.passive_enum",
        "cdxgen.sbom_generate"
      ])
    );
    expect(
      COMMUNITY_VALIDATION_SUITE.some(
        (entry) =>
          entry.moduleId.startsWith("periscan.") &&
          communityValidationStartLane(entry) === "runner"
      )
    ).toBe(false);
    expect(
      communityValidationStartLane(
        COMMUNITY_VALIDATION_SUITE.find(
          (entry) => entry.moduleId === "web.zap_baseline"
        )!
      )
    ).toBe("worker");
  });

  it("derives Community tool ids from the suite so marketplace lists cannot drift", () => {
    const fromSuite = [
      ...new Set(
        COMMUNITY_VALIDATION_SUITE.flatMap((entry) =>
          entry.toolId ? [entry.toolId] : []
        )
      )
    ];
    expect(COMMUNITY_VALIDATION_TOOL_IDS).toEqual(fromSuite);
    expect(isCommunityValidationToolId("gitleaks")).toBe(true);
    expect(isCommunityValidationToolId("zaproxy")).toBe(true);
    expect(isCommunityValidationToolId("osv-scanner")).toBe(true);
    expect(isCommunityValidationToolId("nmap")).toBe(true);
    expect(isCommunityValidationToolId("nuclei")).toBe(true);
    expect(isCommunityValidationToolId("atomic-red-team")).toBe(false);
    expect(isCommunityValidationToolId("caldera")).toBe(false);
    expect(isCommunityValidationToolId("sharphound")).toBe(false);
    expect(isCommunityValidationToolId("sqlmap")).toBe(false);
    expect(isCommunityValidationToolId("metasploit")).toBe(false);
    expect(isCommunityValidationToolId("semgrep")).toBe(false);
    expect(isCommunityValidationToolId("checkov")).toBe(true);
    expect(isCommunityValidationToolId("cfn-lint")).toBe(true);
    expect(isCommunityValidationToolId("parliament")).toBe(true);
    expect(isCommunityValidationToolId("gosec")).toBe(true);
    expect(isCommunityValidationToolId("yara")).toBe(true);
    expect(isCommunityValidationToolId("amass")).toBe(true);
    expect(isCommunityValidationToolId("trufflehog")).toBe(false);
    expect(isCommunityValidationToolId("testssl")).toBe(false);
    expect(isCommunityValidationToolId("nikto")).toBe(false);
    expect(
      ENGINE_LAB_THEATER_TOOL_IDS.every(
        (toolId) => OpenSourceToolIdSchema.safeParse(toolId).success
      )
    ).toBe(true);
    expect(
      ENGINE_LAB_THEATER_TOOL_IDS.some((toolId) =>
        (COMMUNITY_VALIDATION_TOOL_IDS as readonly string[]).includes(toolId)
      )
    ).toBe(false);
  });

  it("classifies Engine Lab rows as Community, legal-review, or catalog theater", () => {
    expect(
      classifyEngineLabHonesty({
        toolId: "gitleaks",
        moduleIds: ["gitleaks.repo_secrets"],
        policyStatus: "Enabled"
      })
    ).toMatchObject({
      class: "community",
      communityStartable: true,
      legalReview: false,
      label: "Community"
    });

    expect(
      classifyEngineLabHonesty({
        toolId: "nuclei",
        moduleIds: ["nuclei.external_exposure_safe"],
        policyStatus: "Enabled"
      })
    ).toMatchObject({
      class: "community",
      communityStartable: true,
      secondMission: true
    });

    expect(
      classifyEngineLabHonesty({
        toolId: "semgrep",
        moduleIds: ["semgrep.code_exploit_scan"],
        policyStatus: "RequiresLegalReview",
        governanceStatus: "LegalReviewRequired"
      })
    ).toMatchObject({
      class: "legal_review",
      communityStartable: false,
      legalReview: true,
      label: "Legal review"
    });

    expect(
      classifyEngineLabHonesty({
        toolId: "metasploit",
        moduleIds: ["exploit.metasploit_check"],
        policyStatus: "Enabled"
      })
    ).toMatchObject({
      class: "theater",
      communityStartable: false,
      label: "Catalog only"
    });

    for (const toolId of [
      "atomic-red-team",
      "caldera",
      "sharphound",
      "sqlmap",
      "metasploit"
    ]) {
      const honesty = classifyEngineLabHonesty({
        toolId,
        policyStatus:
          toolId === "sqlmap" || toolId === "sharphound"
            ? "RequiresLegalReview"
            : "Enabled"
      });
      expect(honesty.communityStartable).toBe(false);
      expect(honesty.class).not.toBe("community");
      expect(honesty.label).not.toBe("Community");
    }

    expect(
      classifyEngineLabHonesty({
        toolId: "sqlmap",
        moduleIds: ["web.sqli_probe"],
        policyStatus: "RequiresLegalReview"
      })
    ).toMatchObject({
      class: "theater",
      legalReview: true,
      communityStartable: false
    });
  });

  it("packs popular permissive blue/red-adjacent engines and keeps GPL/offensive out", () => {
    const repo = listCommunityValidationSuiteForScopeType("Repository").map(
      (entry) => entry.moduleId
    );
    expect(repo).toEqual(
      expect.arrayContaining([
        "detect_secrets.repo_secrets",
        "bandit.python_sast",
        "checkov.iac_posture",
        "gosec.go_sast",
        "terrascan.iac_posture",
        "kics.iac_posture",
        "cfn_lint.cloudformation",
        "parliament.iam_policy",
        "kube_linter.manifest_posture",
        "yara.repo_rules",
        "falco.rules_validate",
        "cdxgen.sbom_generate"
      ])
    );
    // A Repository scope target is {repositoryPath, repositoryName} only — it
    // can never satisfy ContainerImageTargetSchema.imageRef, so the container
    // image scan must not be queued for Repository missions (P11 wave E2E).
    expect(repo).not.toContain("trivy.container_scan");
    expect(
      listCommunityValidationSuiteForScopeType("CloudAccount").map(
        (entry) => entry.moduleId
      )
    ).not.toContain("parliament.iam_policy");
    const domain = listCommunityValidationSuiteForScopeType("Domain").map(
      (entry) => entry.moduleId
    );
    expect(domain).toEqual(
      expect.arrayContaining([
        "sslyze.tls_posture",
        "tlsx.tls_probe",
        "amass.passive_enum"
      ])
    );
    expect(
      COMMUNITY_VALIDATION_SUITE.some((entry) =>
        [
          "atomic.control_validation_safe",
          "caldera.advanced_adversarial",
          "web.sqli_probe",
          "exploit.metasploit_check",
          "web.nikto_scan",
          "web.fingerprint",
          "cloud.scoutsuite_posture",
          "semgrep.code_exploit_scan"
        ].includes(entry.moduleId)
      )
    ).toBe(false);
    expect(communitySuiteUsesRunnerOssAllowlist()).toBe(true);
  });

  it("keeps copyleft opt-in tools out of Community start and theater", () => {
    expect(isCopyleftOptInToolId("semgrep")).toBe(true);
    expect(isCopyleftOptInToolId("testssl")).toBe(true);
    expect(isCopyleftOptInToolId("nikto")).toBe(true);
    expect(isCopyleftOptInToolId("sqlmap")).toBe(false);
    expect(isCopyleftOptInToolId("gitleaks")).toBe(false);
    expect(isCommunityValidationToolId("semgrep")).toBe(false);
    expect(isCopyleftOptInModuleId("semgrep.repo_sast")).toBe(true);
    expect(
      COPYLEFT_OPT_IN_SUITE.some((entry) =>
        ENGINE_LAB_THEATER_TOOL_IDS.includes(entry.toolId as never)
      )
    ).toBe(false);
    expect(
      targetHasUpstreamLicense(
        { upstreamLicenseAcceptedToolIds: ["semgrep"] },
        "semgrep"
      )
    ).toBe(true);
    expect(targetHasUpstreamLicense({}, "semgrep")).toBe(false);
  });
});

describe("summarizeCommunityMissionRuns", () => {
  it("names Community engines from live run module ids, including second-mission Nuclei", () => {
    expect(
      summarizeCommunityMissionRuns([
        {
          errorSummary: null,
          moduleId: "gitleaks.repo_secrets",
          status: "Completed"
        },
        {
          errorSummary: null,
          moduleId: "nuclei.external_exposure_safe",
          status: "Queued"
        }
      ])
    ).toEqual({
      engines: [
        {
          errorSummary: null,
          moduleId: "gitleaks.repo_secrets",
          secondMission: false,
          status: "Completed",
          title: "Repository secret scan"
        },
        {
          errorSummary: null,
          moduleId: "nuclei.external_exposure_safe",
          secondMission: true,
          status: "Queued",
          title: "Nuclei safe external exposure"
        }
      ],
      failedErrors: [],
      hasCommunityPack: true,
      mixed: false,
      valueLine: COMMUNITY_EDITION_VALUE_LINE
    });
  });

  it("marks a mixed mission when Community and non-Community runs share it", () => {
    const summary = summarizeCommunityMissionRuns([
      {
        errorSummary: null,
        moduleId: "periscan.dns_resolution_check",
        status: "Completed"
      },
      {
        errorSummary: null,
        moduleId: "caldera.advanced_adversarial",
        status: "Completed"
      }
    ]);
    expect(summary.hasCommunityPack).toBe(true);
    expect(summary.mixed).toBe(true);
    expect(summary.engines).toEqual([
      {
        errorSummary: null,
        moduleId: "periscan.dns_resolution_check",
        secondMission: false,
        status: "Completed",
        title: "DNS resolution"
      }
    ]);
  });

  it("collects honest Failed Community error summaries", () => {
    expect(
      summarizeCommunityMissionRuns([
        {
          errorSummary: "ZAP baseline refused the unauthorized host.",
          moduleId: "web.zap_baseline",
          status: "Failed"
        }
      ]).failedErrors
    ).toEqual(["ZAP baseline refused the unauthorized host."]);
  });

  it("stays quiet when no run is in the Community suite", () => {
    expect(
      summarizeCommunityMissionRuns([
        {
          errorSummary: null,
          moduleId: "caldera.advanced_adversarial",
          status: "Completed"
        }
      ])
    ).toEqual({
      engines: [],
      failedErrors: [],
      hasCommunityPack: false,
      mixed: false,
      valueLine: null
    });
  });
});

describe("selectCommunityNucleiCompanionMissionId", () => {
  const primaryMissionId = "11111111-1111-4111-8111-111111111111";
  const nucleiMissionId = "22222222-2222-4222-8222-222222222222";
  const otherNucleiMissionId = "33333333-3333-4333-8333-333333333333";
  const primaryCreatedAt = "2026-08-15T12:00:00.000Z";

  it("picks the closest later Nuclei sibling and ignores the primary", () => {
    expect(
      selectCommunityNucleiCompanionMissionId({
        candidates: [
          {
            createdAt: "2026-08-15T12:00:04.000Z",
            missionId: nucleiMissionId
          },
          {
            createdAt: "2026-08-15T12:10:00.000Z",
            missionId: otherNucleiMissionId
          },
          {
            createdAt: primaryCreatedAt,
            missionId: primaryMissionId
          }
        ],
        primaryCreatedAt,
        primaryMissionId
      })
    ).toBe(nucleiMissionId);
  });

  it("accepts a Nuclei sibling created a few minutes before the primary", () => {
    expect(
      selectCommunityNucleiCompanionMissionId({
        candidates: [
          {
            createdAt: "2026-08-15T11:57:00.000Z",
            missionId: nucleiMissionId
          }
        ],
        primaryCreatedAt,
        primaryMissionId
      })
    ).toBe(nucleiMissionId);
  });

  it("does not attach an old Nuclei run from an earlier Community start", () => {
    expect(
      selectCommunityNucleiCompanionMissionId({
        candidates: [
          {
            createdAt: "2026-08-15T11:50:00.000Z",
            missionId: nucleiMissionId
          }
        ],
        primaryCreatedAt,
        primaryMissionId
      })
    ).toBeNull();
  });
});
