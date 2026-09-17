import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ControlRuleCoverageSummary,
  ControlSource,
  DetectionMarkerProofResult,
  DnsExfilCanaryProofResult,
  PolicyDecision,
  RunnerRecord,
  Scope,
  ValidationStimulus,
  ValidationRun
} from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { ControlsWorkbench } from "./controls-workbench";

const now = "2026-07-14T14:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const scopeId = "22222222-2222-4222-8222-222222222222";
const integrationId = "33333333-3333-4333-8333-333333333333";
const controlSourceId = "44444444-4444-4444-8444-444444444444";
const snapshotId = "55555555-5555-4555-8555-555555555555";

describe("ControlsWorkbench", () => {
  beforeEach(() => {
    vi.spyOn(api, "listValidationStimuli").mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("runs a named dry-run scenario and exposes snapshot regressions honestly", async () => {
    const source: ControlSource = {
      controlSourceId,
      controlType: "SIEM",
      createdAt: now,
      expectedBehaviors: ["Detected", "Logged"],
      healthStatus: "Healthy",
      integrationId,
      lastValidatedAt: now,
      provider: "Splunk",
      telemetryStatus: "Healthy",
      tenantId,
      updatedAt: now
    };
    const scope = {
      assetClass: "Network",
      businessCriticality: "High",
      createdAt: now,
      createdBy: null,
      effectiveMaxSafetyLevel: "BASLite",
      externalValidationProfileId: null,
      isOperationalTechnology: false,
      lastPostureCheckAt: null,
      maxSafetyLevel: "BASLite",
      nextPostureCheckAt: null,
      purdueLevel: null,
      safetyRestrictionReason: "This scope permits validation through BASLite.",
      scopeId,
      scopeType: "ControlSource",
      segmentName: null,
      sensitivity: "Moderate",
      tags: [],
      tenantId,
      updatedAt: now,
      value: "splunk-observer",
      verificationExpiresAt: null,
      verificationMethod: "MANUAL",
      verificationStale: false,
      verificationStatus: "Verified",
      verificationToken: null,
      verifiedAt: now,
      verifiedBy: null
    } satisfies Scope;
    const runner = {
      arch: "arm64",
      certificateExpiresAt: null,
      certificateSha256: null,
      createdAt: now,
      createdBy: null,
      deploymentMode: "Docker",
      hostname: "runner.local",
      killSwitchActivatedAt: null,
      killSwitchActivatedBy: null,
      killSwitchActive: false,
      killSwitchReason: null,
      labels: ["production"],
      lastSeenAt: now,
      name: "Production runner",
      networkProfile: {
        additionalEgressNotes: null,
        dnsResolutionRequired: true,
        explicitProxyUrl: null,
        gatewayHostnames: ["runner.periscan.cloud"],
        httpConnectProxySupported: true,
        outboundHttpsPorts: [443]
      },
      os: "linux",
      revokedAt: null,
      runnerId: "66666666-6666-4666-8666-666666666666",
      status: "Active",
      tenantId,
      transportMode: "LongPollHttps",
      updatedAt: now,
      version: "0.1.0"
    } satisfies RunnerRecord;
    const coverage: ControlRuleCoverageSummary = {
      blockedTechniques: 0,
      controlSourceId: null,
      coveredTechniques: 0,
      generatedAt: now,
      history: [
        {
          blockedTechniques: 0,
          coveredTechniques: 0,
          generatedAt: now,
          improvedTechniques: 0,
          loggedOnlyTechniques: 1,
          missedTechniques: 0,
          needsTuningTechniques: 0,
          noEvidenceTechniques: 0,
          notTestedTechniques: 0,
          regressedTechniques: 1,
          snapshotId,
          staleTechniques: 0,
          totalTechniques: 1
        }
      ],
      improvedTechniques: 0,
      items: [
        {
          confidence: 0.7,
          controlSourceId,
          evidenceIds: [],
          expectedBehaviors: ["Detected"],
          lastObservedAt: now,
          observedBehaviors: ["Logged"],
          observedSources: ["Splunk"],
          previousStatus: "Covered",
          recommendation: "Route the logged event to an actionable alert.",
          scenarioId: "scenario.command",
          signalIds: [],
          status: "LoggedOnly",
          tacticName: "Execution",
          techniqueId: "T1059",
          techniqueName: "Command and Scripting Interpreter",
          title: "Command observer",
          trend: "Regressed"
        }
      ],
      loggedOnlyTechniques: 1,
      missedTechniques: 0,
      needsTuningTechniques: 0,
      noEvidenceTechniques: 0,
      notTestedTechniques: 0,
      recommendations: ["Route the logged event to an actionable alert."],
      regressedTechniques: 1,
      snapshotId,
      staleTechniques: 0,
      tenantId,
      totalTechniques: 1
    };
    const run = {
      completedAt: now,
      createdAt: now,
      errorSummary: null,
      evidenceIds: [],
      missionId: "77777777-7777-4777-8777-777777777777",
      moduleId: "atomic.control_validation_safe",
      outcome: "scenario_logged",
      policyDecisionId: "88888888-8888-4888-8888-888888888888",
      runId: "99999999-9999-4999-8999-999999999999",
      runnerId: null,
      safetyLevel: "BASLite",
      scopeId,
      startedAt: now,
      status: "Completed",
      target: {
        executionMode: "DryRun",
        injectLoopAvailable: false,
        observationMode: "telemetry_only",
        techniqueId: "T1059"
      },
      techniqueIds: ["T1059"],
      tenantId,
      updatedAt: now,
      validationState: "Logged"
    } satisfies ValidationRun;

    vi.spyOn(api, "listControlSources").mockResolvedValue([source]);
    vi.spyOn(api, "getControlRuleCoverage").mockResolvedValue(coverage);
    vi.spyOn(api, "listIntegrations").mockResolvedValue([]);
    vi.spyOn(api, "listScopes").mockResolvedValue([scope]);
    vi.spyOn(api, "listRunners").mockResolvedValue([runner]);
    const validate = vi
      .spyOn(api, "validateControlSource")
      .mockResolvedValue(run);

    render(<ControlsWorkbench />);

    expect(
      await screen.findByText(/Dry-run · telemetry-only \(no inject\)/)
    ).toBeInTheDocument();
    const injectBanner = screen.getByRole("status", {
      name: "Control inject loop availability"
    });
    expect(injectBanner).toHaveTextContent(/Inject loop not available/);
    expect(injectBanner).toHaveTextContent(/telemetry-only observations/i);
    expect(injectBanner).toHaveTextContent(/not live inject BAS/);
    expect(injectBanner).toHaveTextContent(/Next step:/);
    // P08 delight: inject-disabled is calm info (product strength), not error/amber.
    expect(injectBanner).toHaveAttribute("data-tone", "info");
    expect(injectBanner.className).toMatch(/border-brand/);
    expect(injectBanner.className).not.toMatch(/border-missed|border-approval/);
    expect(
      screen.getByText(/Verified scope ready for limited safe stimulus/)
    ).toBeInTheDocument();
    // ICP-P2-7 / P08: no residual "BASLite" product naming on Controls surface.
    expect(document.body.textContent ?? "").not.toMatch(/\bBASLite\b/);
    expect(document.body.textContent ?? "").not.toMatch(/\bBAS-Lite\b/i);
    expect(
      screen.getByText(/Inject loop not available \(control_live_execution_disabled\)/)
    ).toBeInTheDocument();
    expect(screen.getByText("Regressed from Covered")).toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: "Detection coverage snapshot history" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Observe telemetry" }));

    await waitFor(() =>
      expect(validate).toHaveBeenCalledWith(controlSourceId, {
        executionMode: "DryRun",
        techniqueId: "T1059"
      })
    );
    expect(
      await screen.findByText(
        /Last result: Logged · mode DryRun · telemetry-only \(inject loop not available\)/
      )
    ).toBeInTheDocument();
  });

  it("creates a detection-eng task from LoggedOnly control-gap rows (P06-8)", async () => {
    const source: ControlSource = {
      controlSourceId,
      controlType: "SIEM",
      createdAt: now,
      expectedBehaviors: ["Detected", "Logged"],
      healthStatus: "Healthy",
      integrationId,
      lastValidatedAt: now,
      provider: "Splunk",
      telemetryStatus: "Healthy",
      tenantId,
      updatedAt: now
    };
    const coverage: ControlRuleCoverageSummary = {
      blockedTechniques: 0,
      controlSourceId: null,
      coveredTechniques: 0,
      generatedAt: now,
      history: [],
      improvedTechniques: 0,
      items: [
        {
          confidence: 0.7,
          controlSourceId,
          evidenceIds: [],
          expectedBehaviors: ["Detected"],
          lastObservedAt: now,
          observedBehaviors: ["Logged"],
          observedSources: ["Splunk"],
          previousStatus: "Covered",
          recommendation: "Route the logged event to an actionable alert.",
          scenarioId: "scenario.command",
          signalIds: [],
          status: "LoggedOnly",
          tacticName: "Execution",
          techniqueId: "T1059",
          techniqueName: "Command and Scripting Interpreter",
          title: "Command observer",
          trend: "Regressed"
        }
      ],
      loggedOnlyTechniques: 1,
      missedTechniques: 0,
      needsTuningTechniques: 0,
      noEvidenceTechniques: 0,
      notTestedTechniques: 0,
      recommendations: [],
      regressedTechniques: 1,
      snapshotId,
      staleTechniques: 0,
      tenantId,
      totalTechniques: 1
    };

    vi.spyOn(api, "listControlSources").mockResolvedValue([source]);
    vi.spyOn(api, "getControlRuleCoverage").mockResolvedValue(coverage);
    vi.spyOn(api, "listIntegrations").mockResolvedValue([]);
    vi.spyOn(api, "listScopes").mockResolvedValue([]);
    vi.spyOn(api, "listRunners").mockResolvedValue([]);
    const createTask = vi.spyOn(api, "createControlGapRemediation").mockResolvedValue({
      remediationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      tenantId,
      title: "Detection gap: T1059",
      status: "Open",
      recommendedAction: "Tune detection",
      relatedPathId: null,
      relatedFindingFingerprint: null,
      ticketId: null,
      ticketUrl: null,
      owner: null,
      ownerId: null,
      ownerDisplay: null,
      dueAt: null,
      createdAt: now,
      updatedAt: now,
      latestVerification: null
    } as never);

    render(<ControlsWorkbench />);

    const cta = await screen.findByRole("button", {
      name: "Create detection-eng task"
    });
    fireEvent.click(cta);

    await waitFor(() =>
      expect(createTask).toHaveBeenCalledWith({
        controlSourceId,
        coverageStatus: "LoggedOnly",
        techniqueId: "T1059",
        techniqueName: "Command and Scripting Interpreter",
        note: "Route the logged event to an actionable alert."
      })
    );
    expect(
      await screen.findByRole("link", { name: /Open remediation/i })
    ).toHaveAttribute(
      "href",
      "/remediation?remediationId=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    );
  });

  it("explains and executes the governed exact-marker canary flow", async () => {
    const source: ControlSource = {
      controlSourceId,
      controlType: "SIEM",
      createdAt: now,
      expectedBehaviors: ["Detected", "Logged"],
      healthStatus: "Healthy",
      integrationId,
      lastValidatedAt: null,
      provider: "Splunk",
      telemetryStatus: "Healthy",
      tenantId,
      updatedAt: now
    };
    const scope = {
      assetClass: "Network",
      businessCriticality: "High",
      createdAt: now,
      createdBy: null,
      effectiveMaxSafetyLevel: "BASLite",
      externalValidationProfileId: null,
      isOperationalTechnology: false,
      lastPostureCheckAt: null,
      maxSafetyLevel: "BASLite",
      nextPostureCheckAt: null,
      purdueLevel: null,
      safetyRestrictionReason: "Verified domain permits safe validation.",
      scopeId,
      scopeType: "Domain",
      segmentName: null,
      sensitivity: "Moderate",
      tags: [],
      tenantId,
      updatedAt: now,
      value: "canary.example.com",
      verificationExpiresAt: null,
      verificationMethod: "MANUAL",
      verificationStale: false,
      verificationStatus: "Verified",
      verificationToken: null,
      verifiedAt: now,
      verifiedBy: null
    } satisfies Scope;
    const policyDecisionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const missionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const stimulusId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const stimulus: ValidationStimulus = {
      cleanupBehavior: "Marker expires after the observation deadline.",
      completedAt: null,
      controlSourceId,
      createdAt: now,
      createdBy: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      dispatchReceipt: null,
      dispatchedAt: null,
      errorSummary: null,
      evidenceIds: [],
      expectedControlBehaviors: ["Detected", "Logged"],
      markerFingerprint: "0123456789ab",
      maxRequestBytes: 1024,
      missionId,
      observationDeadlineAt: null,
      policyDecisionId,
      rateLimitPerMinute: 1,
      runId: null,
      safetyLevel: "ControlledValidation",
      scopeId,
      status: "RequiresApproval",
      stimulusId,
      stimulusType: "OwnedDomainUrlCanary",
      targetHost: "canary.example.com",
      techniqueId: "T1059",
      tenantId,
      ttlSeconds: 600,
      updatedAt: now,
      verdict: null
    };
    const decision: PolicyDecision = {
      approvalState: "Approved",
      approvedAt: now,
      approvedBy: stimulus.createdBy,
      createdAt: now,
      executionEnvironment: "ExternalPoA",
      expiresAt: null,
      missionType: "ControlValidation",
      outcome: "RequiresApproval",
      policyDecisionId,
      rationale: "Admin approved the controlled validation.",
      requestedAction: {
        credentialTheft: false,
        destructive: false,
        persistence: false,
        realDataExfiltration: false,
        requiresInternalRunner: false,
        requiresTimeWindow: false,
        uncontrolledExploitChaining: false
      },
      safetyLevel: "ControlledValidation",
      scopeId,
      target: {},
      tenantId,
      updatedAt: now,
      userId: stimulus.createdBy
    };

    vi.spyOn(api, "listControlSources").mockResolvedValue([source]);
    vi.spyOn(api, "getControlRuleCoverage").mockResolvedValue({
      blockedTechniques: 0,
      controlSourceId: null,
      coveredTechniques: 0,
      generatedAt: now,
      history: [],
      improvedTechniques: 0,
      items: [],
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
      totalTechniques: 0
    });
    vi.spyOn(api, "listIntegrations").mockResolvedValue([]);
    vi.spyOn(api, "listScopes").mockResolvedValue([scope]);
    vi.spyOn(api, "listRunners").mockResolvedValue([]);
    vi.mocked(api.listValidationStimuli).mockResolvedValue([stimulus]);
    const approve = vi
      .spyOn(api, "approvePolicyDecision")
      .mockResolvedValue(decision);
    const dispatch = vi
      .spyOn(api, "dispatchValidationStimulus")
      .mockResolvedValue({
        ...stimulus,
        dispatchReceipt: {
          latencyMs: 12,
          method: "GET",
          requestBytes: 256,
          responseStatus: 204,
          targetHost: stimulus.targetHost
        },
        dispatchedAt: now,
        observationDeadlineAt: now,
        runId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        status: "Observing"
      });

    render(<ControlsWorkbench />);

    expect(
      await screen.findByRole("heading", { name: "Exact-marker canary" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /nearby event, technique match, or HTTP response alone never earns/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(/one request · 1 KB cap · 10 min TTL/i)
    ).toBeInTheDocument();

    fireEvent.click(
      await screen.findByRole("button", { name: "Approve & dispatch" })
    );
    await waitFor(() => {
      expect(approve).toHaveBeenCalledWith(policyDecisionId);
      expect(dispatch).toHaveBeenCalledWith(stimulusId);
    });
  });

  it("renders coverage failures in the validation-scenarios panel", async () => {
    vi.spyOn(api, "listControlSources").mockResolvedValue([]);
    vi.spyOn(api, "getControlRuleCoverage").mockRejectedValue(
      new Error("Coverage service unavailable")
    );
    vi.spyOn(api, "listIntegrations").mockResolvedValue([]);
    vi.spyOn(api, "listScopes").mockResolvedValue([]);
    vi.spyOn(api, "listRunners").mockResolvedValue([]);

    render(<ControlsWorkbench />);

    expect(
      await screen.findByRole("heading", { name: "Validation scenarios" })
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText("Coverage service unavailable")).toHaveLength(
        2
      );
    });
    expect(
      screen.queryByText("No validation scenarios yet.")
    ).not.toBeInTheDocument();
  });

  it("runs Wave B detection marker proof CTA with honest DRV Partial copy", async () => {
    const source: ControlSource = {
      controlSourceId,
      controlType: "SIEM",
      createdAt: now,
      expectedBehaviors: ["Detected", "Logged"],
      healthStatus: "Healthy",
      integrationId,
      lastValidatedAt: now,
      provider: "Splunk",
      telemetryStatus: "Healthy",
      tenantId,
      updatedAt: now
    };
    const scope = {
      assetClass: "Network",
      businessCriticality: "High",
      createdAt: now,
      createdBy: null,
      effectiveMaxSafetyLevel: "BASLite",
      externalValidationProfileId: null,
      isOperationalTechnology: false,
      lastPostureCheckAt: null,
      maxSafetyLevel: "BASLite",
      nextPostureCheckAt: null,
      purdueLevel: null,
      safetyRestrictionReason: "This scope permits validation through BASLite.",
      scopeId,
      scopeType: "ControlSource",
      segmentName: null,
      sensitivity: "Moderate",
      tags: [],
      tenantId,
      updatedAt: now,
      value: "splunk-observer",
      verificationExpiresAt: null,
      verificationMethod: "MANUAL",
      verificationStale: false,
      verificationStatus: "Verified",
      verificationToken: null,
      verifiedAt: now,
      verifiedBy: null
    } satisfies Scope;
    const proof: DetectionMarkerProofResult = {
      closedLoop: true,
      drvClaimClass: "benign_marker_only",
      fullAttackLibrary: false,
      markerId: "periscan-ui-wave-b-9",
      mission: {
        completedAt: now,
        createdAt: now,
        evidenceIds: [],
        missionId: "77777777-7777-4777-8777-777777777777",
        missionType: "ControlValidation",
        policyDecisionId: null,
        policyProfile: null,
        requestedBy: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        safetyLevel: "BASLite",
        scopeId,
        scopeIds: [scopeId],
        startedAt: now,
        status: "Completed",
        tenantId,
        updatedAt: now
      },
      outcome: "detection_marker_emit_observe_detected",
      runs: [
        {
          completedAt: now,
          createdAt: now,
          errorSummary: null,
          evidenceIds: [],
          missionId: "77777777-7777-4777-8777-777777777777",
          moduleId: "periscan.detection_marker_emit_observe",
          outcome: "detection_marker_emit_observe_detected",
          policyDecisionId: null,
          runId: "99999999-9999-4999-8999-999999999999",
          runnerId: null,
          safetyLevel: "BASLite",
          scopeId,
          startedAt: now,
          status: "Completed",
          target: { markerId: "periscan-ui-wave-b-9" },
          techniqueIds: ["T1059"],
          tenantId,
          updatedAt: now,
          validationState: "Detected"
        }
      ],
      summary:
        "Closed benign-marker loop: periscan-ui-wave-b-9 emitted and observed (DRV marker class only — not full ATT&CK BAS).",
      validationState: "Detected"
    };

    vi.spyOn(api, "listControlSources").mockResolvedValue([source]);
    vi.spyOn(api, "getControlRuleCoverage").mockResolvedValue({
      blockedTechniques: 0,
      controlSourceId: null,
      coveredTechniques: 0,
      generatedAt: now,
      history: [],
      improvedTechniques: 0,
      items: [],
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
      totalTechniques: 0
    });
    vi.spyOn(api, "listIntegrations").mockResolvedValue([]);
    vi.spyOn(api, "listScopes").mockResolvedValue([scope]);
    vi.spyOn(api, "listRunners").mockResolvedValue([]);
    const runProof = vi
      .spyOn(api, "runDetectionMarkerProof")
      .mockResolvedValue(proof);

    render(<ControlsWorkbench />);

    const markerHeading = await screen.findByRole("heading", {
      name: "Detection marker proof"
    });
    expect(markerHeading).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Control inject loop availability" })
    ).toHaveTextContent(/DRV Partial overall/i);
    // Panel + banner both carry honesty; assert panel-specific strings.
    expect(
      screen.getByText(/benign marker only · no Atomic live/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Matrix row DRV stays/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/library-wide inject is productized \(refused today\)/i)
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Run detection marker proof" })
    );

    await waitFor(() =>
      expect(runProof).toHaveBeenCalledWith(controlSourceId, {
        performEmit: true,
        scopeId,
        techniqueId: "T1059"
      })
    );

    const resultRegion = await screen.findByRole("status", {
      name: "Detection marker proof result"
    });
    expect(resultRegion).toHaveTextContent(/Detected/);
    expect(resultRegion).toHaveTextContent(/periscan-ui-wave-b-9/);
    expect(resultRegion).toHaveTextContent(/closed loop/i);
    expect(resultRegion).toHaveTextContent(/benign_marker_only/);
    expect(resultRegion).toHaveTextContent(/full ATT&CK library: false/i);
    expect(resultRegion).toHaveTextContent(/not full ATT&CK BAS/);
    // P08: polished result receipt (structured mission/run/outcome).
    expect(screen.getByTestId("detection-marker-proof-receipt")).toBe(
      resultRegion
    );
    expect(resultRegion).toHaveTextContent(/Result receipt/i);
    expect(resultRegion).toHaveTextContent(/limited safe stimulus only/i);
    expect(resultRegion).toHaveTextContent(/mission·77777777/i);
    expect(resultRegion).toHaveTextContent(
      /periscan\.detection_marker_emit_observe/
    );
    // Customer-visible Controls copy still refuses BASLite residual naming.
    expect(resultRegion.textContent ?? "").not.toMatch(/\bBASLite\b/);
  });

  it("runs DNS-exfil canary proof with measured:false honesty pins", async () => {
    const source = {
      controlSourceId,
      controlType: "SIEM",
      createdAt: now,
      expectedBehaviors: ["Detected", "Logged"],
      healthStatus: "Healthy",
      integrationId,
      lastValidatedAt: now,
      provider: "Splunk",
      telemetryStatus: "Healthy",
      tenantId,
      updatedAt: now
    } satisfies ControlSource;
    const domainScope = {
      assetClass: "Network",
      businessCriticality: "High",
      createdAt: now,
      createdBy: null,
      effectiveMaxSafetyLevel: "BASLite",
      externalValidationProfileId: null,
      isOperationalTechnology: false,
      lastPostureCheckAt: null,
      maxSafetyLevel: "BASLite",
      nextPostureCheckAt: null,
      purdueLevel: null,
      safetyRestrictionReason: "This scope permits validation through BASLite.",
      scopeId,
      scopeType: "Domain",
      segmentName: null,
      sensitivity: "Moderate",
      tags: [],
      tenantId,
      updatedAt: now,
      value: "corp.example.com",
      verificationExpiresAt: null,
      verificationMethod: "MANUAL",
      verificationStale: false,
      verificationStatus: "Verified",
      verificationToken: null,
      verifiedAt: now,
      verifiedBy: null
    } satisfies Scope;
    const dnsProof: DnsExfilCanaryProofResult = {
      canaryFqdn: "periscan-dns-ui-1.corp.example.com",
      canaryLabel: "periscan-dns-ui-1",
      closedLoop: true,
      exfilClaimClass: "benign_marker_only",
      fullExfilLibrary: false,
      markerId: "periscan-dns-ui-1",
      measured: false,
      mission: {
        completedAt: now,
        createdAt: now,
        evidenceIds: [],
        missionId: "77777777-7777-4777-8777-777777777777",
        missionType: "ControlValidation",
        policyDecisionId: null,
        policyProfile: null,
        requestedBy: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        safetyLevel: "BASLite",
        scopeId,
        scopeIds: [scopeId],
        startedAt: now,
        status: "Completed",
        tenantId,
        updatedAt: now
      },
      outcome: "dns_exfil_detected",
      realDataExfiltrated: false,
      runs: [
        {
          completedAt: now,
          createdAt: now,
          errorSummary: null,
          evidenceIds: [],
          missionId: "77777777-7777-4777-8777-777777777777",
          moduleId: "periscan.dns_exfil_canary",
          outcome: "dns_exfil_detected",
          policyDecisionId: null,
          runId: "99999999-9999-4999-8999-999999999999",
          runnerId: null,
          safetyLevel: "BASLite",
          scopeId,
          startedAt: now,
          status: "Completed",
          target: { markerId: "periscan-dns-ui-1" },
          techniqueIds: ["T1048"],
          tenantId,
          updatedAt: now,
          validationState: "Detected"
        }
      ],
      summary:
        "DNS-exfil detection canary periscan-dns-ui-1 observed (benign marker only — no real data exfiltrated).",
      validationState: "Detected"
    };

    vi.spyOn(api, "listControlSources").mockResolvedValue([source]);
    vi.spyOn(api, "getControlRuleCoverage").mockResolvedValue({
      blockedTechniques: 0,
      controlSourceId: null,
      coveredTechniques: 0,
      generatedAt: now,
      history: [],
      improvedTechniques: 0,
      items: [],
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
      totalTechniques: 0
    });
    vi.spyOn(api, "listIntegrations").mockResolvedValue([]);
    vi.spyOn(api, "listScopes").mockResolvedValue([domainScope]);
    vi.spyOn(api, "listRunners").mockResolvedValue([]);
    const runDns = vi
      .spyOn(api, "runDnsExfilCanaryProof")
      .mockResolvedValue(dnsProof);

    render(<ControlsWorkbench />);

    const heading = await screen.findByRole("heading", {
      name: "DNS-exfil detection canary"
    });
    expect(heading).toBeInTheDocument();
    expect(
      screen.getByText(/benign marker only · no bulk tunnel/i)
    ).toBeInTheDocument();
    // Honesty aside splits measured pin across elements — assert container text.
    const dnsPanel = heading.closest("[aria-labelledby]") as HTMLElement | null;
    expect(dnsPanel?.textContent ?? "").toMatch(/measured:true/i);
    expect(dnsPanel?.textContent ?? "").toMatch(
      /real emit \+ live telemetry/i
    );
    expect(dnsPanel?.textContent ?? "").toMatch(/realDataExfiltrated/i);

    // Wait until sources hydrate so selectedSourceId is non-empty and CTA works.
    await waitFor(() => {
      const select = screen.getByLabelText("DNS exfil canary control source");
      expect(select).toHaveValue(controlSourceId);
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Run DNS-exfil canary" })
    );

    await waitFor(() =>
      expect(runDns).toHaveBeenCalledWith(controlSourceId, {
        scopeId,
        techniqueId: "T1048"
      })
    );

    const receipt = await screen.findByRole("status", {
      name: "DNS exfil canary proof result"
    });
    expect(screen.getByTestId("dns-exfil-canary-proof-receipt")).toBe(
      receipt
    );
    expect(receipt).toHaveTextContent(/periscan-dns-ui-1/);
    expect(receipt).toHaveTextContent(/measured:false/);
    expect(receipt).toHaveTextContent(/benign_marker_only/);
    expect(receipt).toHaveTextContent(/realDataExfiltrated:false/);
    expect(receipt).toHaveTextContent(/full exfil library: false/i);
    expect(receipt).toHaveTextContent(/periscan\.dns_exfil_canary/);
    expect(receipt).toHaveTextContent(/no real data exfiltrated/i);
    expect(receipt.textContent ?? "").not.toMatch(/\bBASLite\b/);
  });

  it("tunes expected behavior through the closed multi-select", async () => {
    const source = {
      controlSourceId,
      controlType: "SIEM",
      createdAt: now,
      expectedBehaviors: ["Detected", "Logged"],
      healthStatus: "Healthy",
      integrationId,
      lastValidatedAt: now,
      provider: "Splunk",
      telemetryStatus: "Healthy",
      tenantId,
      updatedAt: now
    } satisfies ControlSource;
    vi.spyOn(api, "listControlSources").mockResolvedValue([source]);
    vi.spyOn(api, "getControlRuleCoverage").mockResolvedValue({
      blockedTechniques: 0,
      controlSourceId: null,
      coveredTechniques: 0,
      generatedAt: now,
      history: [],
      improvedTechniques: 0,
      items: [],
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
      totalTechniques: 0
    });
    vi.spyOn(api, "listIntegrations").mockResolvedValue([]);
    vi.spyOn(api, "listScopes").mockResolvedValue([]);
    vi.spyOn(api, "listRunners").mockResolvedValue([]);
    const update = vi.spyOn(api, "updateControlSource").mockResolvedValue({
      ...source,
      expectedBehaviors: ["Detected", "Logged", "Routed"]
    });

    render(<ControlsWorkbench />);
    fireEvent.click(await screen.findByRole("button", { name: "Tune" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Routed" }));
    fireEvent.click(screen.getByRole("button", { name: "Save tuning" }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(controlSourceId, {
        expectedBehaviors: ["Detected", "Logged", "Routed"]
      })
    );
  });
});
