import { access, readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

async function readRepoFile(path: string) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

async function expectRepoPath(path: string) {
  await expect(
    access(new URL(`../../${path}`, import.meta.url))
  ).resolves.toBeUndefined();
}

function sectionBetween(
  source: string,
  startHeader: string,
  endHeader: string
) {
  const start = source.indexOf(startHeader);
  const end = source.indexOf(endHeader, start + startHeader.length);

  if (start === -1 || end === -1) {
    throw new Error(
      `Unable to find section between ${startHeader} and ${endHeader}`
    );
  }

  return source.slice(start, end);
}

describe("PRD section 4 System Architecture coverage", () => {
  it("keeps every section 4 architecture component and responsibility explicit", async () => {
    const prd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const section = sectionBetween(
      prd,
      "## 4. System Architecture",
      "## 5. Recommended Tech Stack"
    );

    for (const requiredSourceText of [
      "SaaS Control Plane",
      "tenant management",
      "user management",
      "integrations",
      "validation missions",
      "evidence graph",
      "attack paths",
      "control validation",
      "AI app validation",
      "remediation",
      "fix verification",
      "reporting",
      "billing/metering",
      "audit logs",
      "API Connectors",
      "cloud",
      "identity",
      "SaaS",
      "code repositories",
      "EDR/XDR",
      "SIEM",
      "SOAR",
      "WAF/firewall",
      "ticketing",
      "AI apps",
      "VM/EAP/ASM/CNAPP tools",
      "External Point of Attack",
      "external exposure validation",
      "WAF validation",
      "firewall validation",
      "internet-facing service checks",
      "domain / DNS / TLS checks",
      "outside-in attack-path initiation",
      "Internal Runner",
      "outbound-only runner",
      "internal reachability",
      "segmentation validation",
      "control testing",
      "internal attack paths",
      "fix verification",
      "internal AI app validation",
      "Evidence Graph",
      "assets",
      "identities",
      "permissions",
      "controls",
      "exposures",
      "signals",
      "validation runs",
      "attack paths",
      "remediation tasks",
      "verification events",
      "evidence artifacts",
      "reports"
    ]) {
      expect(section).toContain(requiredSourceText);
    }
  });

  it("maps SaaS control-plane responsibilities to API routes, services, and persistence", async () => {
    const [apiSource, schema, authService, tenantService, validationService] =
      await Promise.all([
        readRepoFile("apps/api/src/app.ts"),
        readRepoFile("packages/db/prisma/schema.prisma"),
        readRepoFile("apps/api/src/services/auth.ts"),
        readRepoFile("apps/api/src/services/tenant.ts"),
        readRepoFile("apps/api/src/services/validation.ts")
      ]);

    for (const path of [
      "apps/api/src/services/integrations.ts",
      "apps/api/src/services/snapshots.ts",
      "apps/api/src/services/findings.ts",
      "apps/api/src/services/control-ai.ts",
      "apps/api/src/services/remediation.ts",
      "packages/evidence/src/graph.ts",
      "packages/reports/src/index.ts"
    ]) {
      await expectRepoPath(path);
    }

    for (const routeToken of [
      '"/api/v1/tenants/current"',
      '"/api/v1/tenants/current/invite"',
      '"/api/v1/integrations"',
      '"/api/v1/missions"',
      '"/api/v1/snapshots"',
      '"/api/v1/attack-paths"',
      '"/api/v1/control-sources"',
      '"/api/v1/ai-apps"',
      '"/api/v1/remediations"',
      '"/api/v1/remediations/:id/verify"',
      '"/api/v1/reports"',
      '"/api/v1/billing/usage"',
      '"/api/v1/audit-events"'
    ]) {
      expect(apiSource).toContain(routeToken);
    }

    for (const modelName of [
      "model Tenant",
      "model User",
      "model Membership",
      "model Integration",
      "model ValidationMission",
      "model ValidationRun",
      "model EvidenceArtifact",
      "model AttackPath",
      "model ControlSource",
      "model AIApplication",
      "model RemediationTask",
      "model VerificationEvent",
      "model EvidencePack",
      "model AuditEvent"
    ]) {
      expect(schema).toContain(modelName);
    }

    expect(authService).toContain("audit");
    expect(tenantService).toContain("billing");
    expect(validationService).toContain("PolicyDecision");
  });

  it("maps API connector categories to the connector marketplace and capability metadata", async () => {
    const connectorSource = await readRepoFile(
      "packages/connectors/src/index.ts"
    );

    for (const marketplaceCategory of [
      '"Cloud"',
      '"Identity"',
      '"SIEM"',
      '"EDR/XDR"',
      '"SOAR/ITSM"',
      '"WAF/Firewall"',
      '"Code/DevSecOps"',
      '"AI Stack"',
      '"VM/EAP/ASM/CNAPP"',
      '"Ticketing"',
      '"MSSP/PSA/RMM"'
    ]) {
      expect(connectorSource).toContain(marketplaceCategory);
    }

    for (const connectorFactory of [
      "createAwsConnector",
      "createMicrosoftEntraConnector",
      "createServiceNowConnector",
      "createGitHubConnector",
      "createCrowdStrikeConnector",
      "createSplunkConnector",
      "createJiraConnector",
      "createOpenAIConnector",
      "createTenableConnector",
      "createConnectWiseManageConnector"
    ]) {
      expect(connectorSource).toContain(connectorFactory);
    }

    for (const manifestField of [
      "requiredPermissions",
      "signalCategories",
      "validationCapabilities",
      "controlObservationCapabilities",
      "workflowCapabilities",
      "healthCheckMethod",
      "supportedMissionTypes"
    ]) {
      expect(connectorSource).toContain(manifestField);
    }
  });

  it("maps the external point of attack to verified-scope safe modules and abuse boundaries", async () => {
    const [modules, scopesService, policySource, ossDocs] = await Promise.all([
      readRepoFile("packages/modules/src/index.ts"),
      readRepoFile("apps/api/src/services/scopes.ts"),
      readRepoFile("packages/policy/src/index.ts"),
      readRepoFile("docs/OPEN_SOURCE_VALIDATION_ENGINES.md")
    ]);

    for (const externalModuleToken of [
      "nuclei.external_exposure_safe",
      "DNS Resolution & Dangling CNAME Check",
      "DNS CAA Issuance-Control Check",
      "TLS Certificate Posture Check",
      "TLS Protocol-Version Audit",
      "HTTP Health & Security Header Check"
    ]) {
      expect(modules).toContain(externalModuleToken);
    }

    expect(modules).toContain("templateProfile");
    expect(modules).toContain("safe-baseline");
    expect(modules).toContain("rateLimit");
    expect(modules).toContain("maxNetworkRequests");
    expect(scopesService).toContain("verificationStatus");
    expect(scopesService).toContain("nextPostureCheckAt");
    expect(policySource).toContain("RequiresVerifiedScope");
    expect(policySource).toContain("ActiveNonInvasive");
    expect(ossDocs).toContain("external-PoA modules");
    expect(ossDocs).toContain("DNS resolution");
    expect(ossDocs).toContain("TLS certificate inspection");
  });

  it("maps the internal runner to outbound signed-task polling, scope enforcement, and evidence upload", async () => {
    const [apiRoutes, runnerService, runnerCode, runnerReadme, runnerSpec] =
      await Promise.all([
        readRepoFile("apps/api/src/app.ts"),
        readRepoFile("apps/api/src/services/runner.ts"),
        readRepoFile("apps/runner/main.go"),
        readRepoFile("apps/runner/README.md"),
        readRepoFile("docs/RUNNER_SPEC.md")
      ]);

    for (const routeToken of [
      '"/api/v1/runners/register"',
      '"/api/v1/runners/:id/heartbeat"',
      '"/api/v1/runners/:id/poll"',
      '"/api/v1/runners/:id/tasks/reachability"',
      '"/api/v1/runners/:id/tasks/check"',
      '"/api/v1/runners/:id/tasks/:taskId/result"',
      '"/api/v1/runners/:id/evidence"',
      '"/api/v1/runners/:id/kill-switch"'
    ]) {
      expect(apiRoutes).toContain(routeToken);
    }

    expect(runnerService).toContain("createRunnerReachabilityTask");
    expect(runnerService).toContain("signRunnerTaskEnvelope");
    expect(runnerService).toContain("Runner tasks require verified scope");
    expect(runnerCode).toContain("func verifyTask");
    expect(runnerCode).toContain("func enforceScope");
    expect(runnerCode).toContain("uploadTaskEvidence");
    expect(runnerCode).toContain("killSwitchEnabled");
    expect(runnerReadme).toContain("outbound HTTPS");
    expect(runnerReadme).toContain("signed task envelopes");
    expect(runnerReadme).toContain("normalized evidence");
    expect(runnerSpec).toContain("NO reverse SSH");
    expect(runnerSpec).toContain("NO arbitrary shell");
  });

  it("maps the Evidence Graph system of record to shared schemas, Prisma models, and graph services", async () => {
    const [domain, schema, graphService, correlation, reports] =
      await Promise.all([
        readRepoFile("packages/shared/src/domain.ts"),
        readRepoFile("packages/db/prisma/schema.prisma"),
        readRepoFile("packages/evidence/src/graph.ts"),
        readRepoFile("packages/evidence/src/correlation.ts"),
        readRepoFile("packages/reports/src/index.ts")
      ]);

    for (const schemaToken of [
      "AssetSchema",
      "IdentitySchema",
      "ControlSourceSchema",
      "ExposureSchema",
      "SignalEnvelopeSchema",
      "ValidationRunSchema",
      "AttackPathSchema",
      "RemediationTaskSchema",
      "VerificationEventSchema",
      "EvidenceArtifactSchema",
      "EvidencePackSchema",
      "GraphNodeSchema",
      "GraphEdgeSchema"
    ]) {
      expect(domain).toContain(schemaToken);
    }

    for (const modelName of [
      "model Asset",
      "model Identity",
      "model ControlSource",
      "model Exposure",
      "model SignalEnvelope",
      "model ValidationRun",
      "model AttackPath",
      "model RemediationTask",
      "model VerificationEvent",
      "model EvidenceArtifact",
      "model EvidencePack",
      "model GraphNode",
      "model GraphEdge"
    ]) {
      expect(schema).toContain(modelName);
    }

    expect(domain).toContain("permissionsSummary");
    expect(domain).toContain("roles");
    expect(domain).toContain("groups");
    expect(graphService).toContain("upsertNode");
    expect(graphService).toContain("upsertEdge");
    expect(graphService).toContain("findPaths");
    expect(graphService).toContain("createAttackPath");
    expect(graphService).toContain("linkEvidence");
    expect(correlation).toContain("correlateAttackPaths");
    expect(reports).toContain("evidenceIds");
  });
});
