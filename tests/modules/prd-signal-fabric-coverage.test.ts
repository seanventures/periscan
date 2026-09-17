import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  getConnectorCatalog,
  type ConnectorCatalogEntry
} from "../../packages/connectors/src/index.js";
import { listModuleManifests } from "../../packages/modules/src/index.js";
import {
  AIApplicationSchema,
  ScopeTypeSchema
} from "../../packages/shared/src/domain.js";

type CoverageContext = {
  catalog: ConnectorCatalogEntry[];
  connectorKeys: Set<string>;
  moduleIds: Set<string>;
  scopeTypes: Set<string>;
};

type CoverageRule = {
  expectation: string;
  matches: (context: CoverageContext) => boolean;
};

async function readRepoFile(path: string) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

function sectionBetween(
  source: string,
  startHeader: string,
  nextHeader: string
) {
  const start = source.indexOf(startHeader);

  if (start === -1) {
    throw new Error(`Unable to find section header: ${startHeader}`);
  }

  const end = source.indexOf(nextHeader, start + startHeader.length);

  if (end === -1) {
    throw new Error(`Unable to find next section header: ${nextHeader}`);
  }

  return source.slice(start, end);
}

function subsectionBetween(
  source: string,
  startHeader: string,
  nextHeader: string | null
) {
  const start = source.indexOf(startHeader);

  if (start === -1) {
    throw new Error(`Unable to find subsection header: ${startHeader}`);
  }

  const end = nextHeader
    ? source.indexOf(nextHeader, start + startHeader.length)
    : source.length;

  if (end === -1) {
    throw new Error(`Unable to find next subsection header: ${nextHeader}`);
  }

  return source.slice(start, end);
}

function parseCategoryItems(signalFabricSection: string) {
  const categories = [
    "Cloud",
    "Identity",
    "Code / DevSecOps",
    "Security Controls",
    "Vulnerability / Exposure",
    "Ticketing",
    "AI Stack",
    "MSSP / PSA / RMM"
  ];
  const lines = subsectionBetween(
    signalFabricSection,
    "### 8.1 Integration Categories",
    "### 8.2 Minimum MVP Integrations"
  )
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const result = new Map<string, string[]>();

  for (const category of categories) {
    const index = lines.indexOf(category);
    const itemLine = index === -1 ? "" : (lines[index + 1] ?? "");

    result.set(
      category,
      itemLine
        .replace(/\.$/u, "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    );
  }

  return result;
}

function parseBullets(signalFabricSection: string, startHeader: string) {
  const nextHeaderMatch = signalFabricSection
    .slice(signalFabricSection.indexOf(startHeader) + startHeader.length)
    .match(/\n###\s+/u);
  const nextHeader = nextHeaderMatch
    ? signalFabricSection.indexOf(
        nextHeaderMatch[0],
        signalFabricSection.indexOf(startHeader) + startHeader.length
      )
    : signalFabricSection.length;

  return signalFabricSection
    .slice(signalFabricSection.indexOf(startHeader), nextHeader)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim());
}

function hasConnectorKey(...keys: string[]): CoverageRule {
  return {
    expectation: `connector key ${keys.join(" or ")}`,
    matches: ({ connectorKeys }) => keys.some((key) => connectorKeys.has(key))
  };
}

function hasMarketplaceCategory(...categories: string[]): CoverageRule {
  return {
    expectation: `marketplace category ${categories.join(" or ")}`,
    matches: ({ catalog }) =>
      categories.some((category) =>
        catalog.some((entry) => entry.marketplaceCategory === category)
      )
  };
}

function hasVendorOrProduct(pattern: RegExp): CoverageRule {
  return {
    expectation: `vendor/product matching ${pattern}`,
    matches: ({ catalog }) =>
      catalog.some(
        (entry) => pattern.test(entry.vendor) || pattern.test(entry.product)
      )
  };
}

const CATEGORY_ITEM_COVERAGE: Record<string, CoverageRule[]> = {
  "Active Directory": [hasConnectorKey("active-directory")],
  Anthropic: [hasConnectorKey("anthropic")],
  ASM: [hasMarketplaceCategory("VM/EAP/ASM/CNAPP")],
  AWS: [hasConnectorKey("aws")],
  "Azure OpenAI": [hasConnectorKey("azure-openai")],
  Azure: [hasConnectorKey("azure")],
  Bedrock: [hasConnectorKey("aws-bedrock")],
  Bitbucket: [hasConnectorKey("bitbucket")],
  CAASM: [hasMarketplaceCategory("VM/EAP/ASM/CNAPP")],
  "CI/CD": [
    hasConnectorKey("azure-devops", "buildkite", "circleci", "jenkins")
  ],
  CNAPP: [hasMarketplaceCategory("VM/EAP/ASM/CNAPP")],
  Cloudflare: [hasConnectorKey("cloudflare")],
  ConnectWise: [hasVendorOrProduct(/ConnectWise/iu)],
  CSPM: [hasMarketplaceCategory("VM/EAP/ASM/CNAPP")],
  Datto: [hasConnectorKey("datto-rmm")],
  EAP: [hasMarketplaceCategory("VM/EAP/ASM/CNAPP")],
  EDR: [hasMarketplaceCategory("EDR/XDR")],
  "email security": [hasMarketplaceCategory("Email Security")],
  "agent frameworks": [hasConnectorKey("langchain", "llamaindex")],
  "Entra ID": [hasConnectorKey("microsoft-entra-id")],
  firewall: [hasMarketplaceCategory("WAF/Firewall")],
  GCP: [hasConnectorKey("gcp")],
  GitHub: [hasConnectorKey("github")],
  GitLab: [hasConnectorKey("gitlab")],
  "GitHub Issues": [hasConnectorKey("github-issues")],
  "Google Workspace": [hasConnectorKey("google-workspace")],
  guardrails: [hasConnectorKey("guardrails-ai", "lakera")],
  HaloPSA: [hasConnectorKey("halopsa")],
  Jira: [hasConnectorKey("jira")],
  Kaseya: [hasVendorOrProduct(/Kaseya|VSA/iu)],
  Kubernetes: [hasConnectorKey("kubernetes")],
  Linear: [hasConnectorKey("linear")],
  MDR: [hasMarketplaceCategory("EDR/XDR", "NDR")],
  MFA: [hasConnectorKey("duo", "okta", "rsa-securid")],
  "N-able": [hasConnectorKey("n-able-ncentral")],
  NinjaOne: [hasConnectorKey("ninjaone")],
  Okta: [hasConnectorKey("okta")],
  OpenAI: [hasConnectorKey("openai")],
  "RAG systems": [
    hasConnectorKey("pinecone", "weaviate", "azure-ai-search", "chroma")
  ],
  SaaS: [hasMarketplaceCategory("Data Security")],
  SIEM: [hasMarketplaceCategory("SIEM")],
  Slack: [hasConnectorKey("slack")],
  SOAR: [hasMarketplaceCategory("SOAR/ITSM")],
  ServiceNow: [hasConnectorKey("servicenow")],
  Teams: [hasConnectorKey("microsoft-teams")],
  Vertex: [hasConnectorKey("vertex-ai")],
  VM: [hasMarketplaceCategory("VM/EAP/ASM/CNAPP")],
  WAF: [hasMarketplaceCategory("WAF/Firewall")],
  XDR: [hasMarketplaceCategory("EDR/XDR")],
  "container registries": [
    hasConnectorKey("docker-hub", "github-container-registry", "aws-ecr")
  ],
  "vector DBs": [hasConnectorKey("pinecone", "weaviate", "chroma")]
};

const BULLET_COVERAGE: Record<string, CoverageRule[]> = {
  AWS: [hasConnectorKey("aws")],
  GitHub: [hasConnectorKey("github")],
  "verified domain / external validation": [
    {
      expectation: "Domain/Subdomain scopes plus safe external module",
      matches: ({ moduleIds, scopeTypes }) =>
        scopeTypes.has("Domain") &&
        scopeTypes.has("Subdomain") &&
        moduleIds.has("nuclei.external_exposure_safe")
    }
  ],
  "Slack or email": [hasConnectorKey("slack")],
  Jira: [hasConnectorKey("jira")],
  "one AI app endpoint registration": [
    {
      expectation: "AIApplicationEndpoint scope and AI app contract",
      matches: ({ scopeTypes }) =>
        scopeTypes.has("AIApplicationEndpoint") &&
        AIApplicationSchema.safeParse({
          aiAppId: "11111111-1111-4111-8111-111111111111",
          authMethod: "test-account",
          createdAt: "2026-06-28T00:00:00.000Z",
          dataSourcesDescription: "Fixture RAG index",
          endpointUrl: "https://ai.example.test/chat",
          guardrailsDescription: "Tenant test guardrails",
          lastValidatedAt: null,
          name: "Tenant AI Assistant",
          owner: "Security",
          ragEnabled: true,
          scopeId: "22222222-2222-4222-8222-222222222222",
          tenantId: "33333333-3333-4333-8333-333333333333",
          toolsEnabled: true,
          updatedAt: "2026-06-28T00:00:00.000Z",
          appType: "RAG"
        }).success
    }
  ],
  "mock EDR": [
    {
      expectation: "mock-supported EDR/XDR control observer",
      matches: ({ catalog }) =>
        catalog.some(
          (entry) =>
            entry.marketplaceCategory === "EDR/XDR" &&
            entry.mockSupported &&
            entry.controlObservationCapabilities.length > 0
        )
    }
  ],
  "mock SIEM": [
    {
      expectation: "mock-supported SIEM control observer",
      matches: ({ catalog }) =>
        catalog.some(
          (entry) =>
            entry.marketplaceCategory === "SIEM" &&
            entry.mockSupported &&
            entry.controlObservationCapabilities.length > 0
        )
    }
  ],
  Azure: [hasConnectorKey("azure")],
  GCP: [hasConnectorKey("gcp")],
  "Entra ID": [hasConnectorKey("microsoft-entra-id")],
  Okta: [hasConnectorKey("okta")],
  "Google Workspace": [hasConnectorKey("google-workspace")],
  GitLab: [hasConnectorKey("gitlab")],
  "CrowdStrike mock/real": [hasConnectorKey("crowdstrike")],
  "Splunk mock/real": [hasConnectorKey("splunk")],
  "Microsoft Sentinel": [hasConnectorKey("microsoft-sentinel")],
  ServiceNow: [hasConnectorKey("servicenow")],
  Cloudflare: [hasConnectorKey("cloudflare")],
  "OpenAI / Azure OpenAI": [
    hasConnectorKey("openai"),
    hasConnectorKey("azure-openai")
  ],
  "AWS Bedrock": [hasConnectorKey("aws-bedrock")]
};

function assertCovered(
  sourceLabel: string,
  rules: CoverageRule[] | undefined,
  context: CoverageContext
) {
  expect(
    rules,
    `${sourceLabel} is listed in PRD section 8 but has no explicit coverage mapping in this regression.`
  ).toBeDefined();

  const failures = (rules ?? [])
    .filter((rule) => !rule.matches(context))
    .map((rule) => rule.expectation);

  expect(
    failures,
    `${sourceLabel} coverage failures: ${failures.join(", ")}`
  ).toEqual([]);
}

describe("PRD section 8 Signal Fabric coverage", () => {
  it("maps every PRD integration category item to connector catalog or platform surface evidence", async () => {
    const prd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const signalFabricSection = sectionBetween(
      prd,
      "## 8. Integration Signal Fabric",
      "## 9. Module Registry"
    );
    const catalog = getConnectorCatalog();
    const context: CoverageContext = {
      catalog,
      connectorKeys: new Set(catalog.map((entry) => entry.connectorKey)),
      moduleIds: new Set(
        listModuleManifests().map((manifest) => manifest.moduleId)
      ),
      scopeTypes: new Set(ScopeTypeSchema.options)
    };
    const categoryItems = parseCategoryItems(signalFabricSection);

    for (const [category, items] of categoryItems.entries()) {
      expect(
        items.length,
        `${category} should parse PRD items`
      ).toBeGreaterThan(0);

      for (const item of items) {
        assertCovered(item, CATEGORY_ITEM_COVERAGE[item], context);
      }
    }
  });

  it("keeps PRD MVP and V1 integration lists represented in the API-first catalog", async () => {
    const prd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const signalFabricSection = sectionBetween(
      prd,
      "## 8. Integration Signal Fabric",
      "## 9. Module Registry"
    );
    const catalog = getConnectorCatalog();
    const context: CoverageContext = {
      catalog,
      connectorKeys: new Set(catalog.map((entry) => entry.connectorKey)),
      moduleIds: new Set(
        listModuleManifests().map((manifest) => manifest.moduleId)
      ),
      scopeTypes: new Set(ScopeTypeSchema.options)
    };
    const requiredBullets = [
      ...parseBullets(signalFabricSection, "### 8.2 Minimum MVP Integrations"),
      ...parseBullets(signalFabricSection, "### 8.3 V1 Integrations")
    ];

    expect(requiredBullets.length).toBeGreaterThan(0);

    for (const item of requiredBullets) {
      assertCovered(item, BULLET_COVERAGE[item], context);
    }
  });

  it("preserves Signal Fabric connector roles required by the PRD", () => {
    const catalog = getConnectorCatalog();

    expect(catalog.some((entry) => entry.signalCategories.length > 0)).toBe(
      true
    );
    expect(
      catalog.some((entry) => entry.controlObservationCapabilities.length > 0)
    ).toBe(true);
    expect(
      catalog.some((entry) => entry.validationCapabilities.length > 0)
    ).toBe(true);
    expect(catalog.some((entry) => entry.workflowCapabilities.length > 0)).toBe(
      true
    );
    expect(
      catalog.every((entry) => entry.dataSensitivity && entry.healthCheckMethod)
    ).toBe(true);
  });
});
