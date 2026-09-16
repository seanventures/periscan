import { generateKeyPairSync } from "node:crypto";

import {
  BedrockClient,
  ListFoundationModelsCommand
} from "@aws-sdk/client-bedrock";
import {
  DescribeImagesCommand,
  DescribeRepositoriesCommand,
  ECRClient
} from "@aws-sdk/client-ecr";
import { WAFV2Client } from "@aws-sdk/client-wafv2";
import { Client as LdapClient } from "ldapts";
import type { SearchResult } from "ldapts";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getConnectorByKey,
  getConnectorCatalog,
  getConnectorCatalogEntryByKey,
  normalizeSignalEnvelope
} from "./index.js";

describe("connectors registry", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns the required mock connector catalog entries", () => {
    const catalog = getConnectorCatalog();
    const connectorKeys = catalog.map((manifest) => manifest.connectorKey);

    expect(connectorKeys).toEqual(
      expect.arrayContaining([
        "aws",
        "azure",
        "gcp",
        "cloudflare",
        "github",
        "gitlab",
        "bitbucket",
        "azure-devops",
        "buildkite",
        "circleci",
        "jenkins",
        "docker-hub",
        "github-container-registry",
        "aws-ecr",
        "tenable",
        "rapid7-insightvm",
        "wiz",
        "prisma-cloud",
        "lacework",
        "orca-security",
        "qualys",
        "runzero",
        "assetnote",
        "axonius",
        "armis",
        "cortex-xpanse",
        "okta",
        "duo",
        "onelogin",
        "ping-identity",
        "auth0",
        "jumpcloud",
        "cyberark",
        "active-directory",
        "microsoft-entra-id",
        "google-workspace",
        "salesforce",
        "jira",
        "github-issues",
        "linear",
        "pagerduty",
        "opsgenie",
        "servicenow",
        "connectwise-manage",
        "ninjaone",
        "halopsa",
        "autotask",
        "syncro",
        "datto-rmm",
        "kaseya-vsa",
        "n-able-ncentral",
        "slack",
        "microsoft-teams",
        "crowdstrike",
        "microsoft-sentinel",
        "splunk",
        "elastic-security",
        "datadog-siem",
        "google-chronicle",
        "abuseipdb",
        "virus-total",
        "greynoise",
        "alienvault-otx",
        "recorded-future",
        "mandiant-advantage",
        "openai",
        "anthropic",
        "azure-openai",
        "vertex-ai",
        "pinecone",
        "weaviate",
        "azure-ai-search",
        "chroma",
        "langchain",
        "llamaindex",
        "guardrails-ai",
        "lakera",
        "aws-bedrock",
        "aws-waf",
        "azure-front-door-waf",
        "kubernetes",
        "vmware-vcenter",
        "digitalocean",
        "heroku",
        "databricks",
        "snowflake",
        "alibaba-cloud",
        "oracle-cloud",
        "microsoft-defender-email",
        "google-gmail-security",
        "proofpoint",
        "mimecast",
        "abnormal-security",
        "microsoft-defender-xdr",
        "sentinelone",
        "vmware-carbon-black",
        "sophos-intercept-x",
        "trend-vision-one",
        "palo-cortex-xdr",
        "palo-cortex-xsiam",
        "fastly-next-gen-waf",
        "akamai-kona",
        "imperva",
        "palo-panorama",
        "fortinet-fortigate",
        "zscaler-zia"
      ])
    );
    expect(catalog.length).toBeGreaterThanOrEqual(75);
    const dedicated = catalog.filter(
      (manifest) => manifest.implementationTier === "DedicatedClient"
    );
    const standardized = catalog.filter(
      (manifest) => manifest.implementationTier === "StandardizedCatalog"
    );
    expect(dedicated.length).toBeGreaterThan(0);
    expect(standardized.length).toBeGreaterThan(0);
    expect(catalog.filter((manifest) => manifest.dedicatedClient)).toEqual(
      dedicated
    );
    expect(catalog.filter((manifest) => manifest.live)).toEqual(dedicated);
    expect(
      catalog.filter(
        (manifest) => manifest.executionReadiness === "ReadyForCredentials"
      ).length
    ).toBe(catalog.filter((manifest) => manifest.connectable).length);
    expect(
      standardized.every(
        (manifest) =>
          manifest.availability === "Planned" &&
          manifest.connectable === false &&
          manifest.dedicatedClient === false &&
          manifest.executionReadiness === "NotConnectable" &&
          manifest.live === false &&
          manifest.executionReadinessReason.includes(
            "vendor-specific live client"
          )
      )
    ).toBe(true);
    expect(catalog.map((manifest) => manifest.marketplaceCategory)).toEqual(
      expect.arrayContaining([
        "Cloud",
        "Identity",
        "Code/DevSecOps",
        "SIEM",
        "EDR/XDR",
        "SOAR/ITSM",
        "WAF/Firewall",
        "Email Security",
        "VM/EAP/ASM/CNAPP",
        "Threat Intelligence",
        "AI Stack",
        "MSSP/PSA/RMM"
      ])
    );
  });

  it("returns enriched catalog entries by connector key", () => {
    expect(getConnectorCatalogEntryByKey("oracle-cloud")).toMatchObject({
      connectorKey: "oracle-cloud",
      dedicatedClient: true,
      executionReadiness: "ReadyForCredentials",
      implementationTier: "DedicatedClient",
      live: true
    });
    expect(getConnectorCatalogEntryByKey("darktrace")).toMatchObject({
      availability: "Planned",
      connectable: false,
      connectorKey: "darktrace",
      dedicatedClient: false,
      executionReadiness: "NotConnectable",
      implementationTier: "StandardizedCatalog",
      live: false
    });
    expect(
      getConnectorCatalogEntryByKey("darktrace")?.executionReadinessReason
    ).toContain("vendor-specific live client");
    expect(getConnectorCatalogEntryByKey("missing-connector")).toBeNull();
  });

  it("marks any planned marketplace connectors as visible but not connectable", async () => {
    const catalog = getConnectorCatalog();
    const planned = catalog.filter(
      (manifest) => manifest.availability === "Planned"
    );

    expect(planned.every((manifest) => manifest.connectable === false)).toBe(
      true
    );

    for (const manifest of planned) {
      const connector = getConnectorByKey(manifest.connectorKey);

      expect(connector).toBeDefined();
      await expect(
        connector!.sync({
          authType: "planned",
          config: {},
          integrationId: "10101010-1010-4010-8010-101010101010",
          mockMode: false,
          tenantId: "20202020-2020-4020-8020-202020202020"
        })
      ).rejects.toThrow("planned and not connectable");
    }
  });

  it("normalizes connector signals into shared SignalEnvelope records", () => {
    const connector = getConnectorByKey("github");

    expect(connector).toBeDefined();

    const signal = normalizeSignalEnvelope(
      connector!.manifest,
      {
        authType: "mock",
        config: {
          connectorKey: "github",
          mockMode: true
        },
        integrationId: "11111111-1111-4111-8111-111111111111",
        mockMode: true,
        tenantId: "22222222-2222-4222-8222-222222222222"
      },
      {
        confidence: 0.9,
        freshness: "Fresh",
        rawPayloadPointer: null,
        redactionStatus: "Redacted",
        relatedAssetIds: [],
        relatedControlIds: [],
        relatedEvidenceIds: [],
        relatedIdentityIds: [],
        relatedPathIds: [],
        sensitivityLevel: "Moderate",
        signalCategory: "Repository",
        signalSubcategory: "SecretScanCandidate",
        sourceType: "connector.sync",
        timestampObserved: "2026-06-01T00:00:00.000Z"
      }
    );

    expect(signal.sourceVendor).toBe("GitHub");
    expect(signal.signalCategory).toBe("Repository");
    expect(signal.sourceIntegrationId).toBe(
      "11111111-1111-4111-8111-111111111111"
    );
  });

  it("runs mock health and sync for a registered connector", async () => {
    const connector = getConnectorByKey("github");

    expect(connector).toBeDefined();

    const result = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "github",
        mockMode: true
      },
      integrationId: "33333333-3333-4333-8333-333333333333",
      mockMode: true,
      tenantId: "44444444-4444-4444-8444-444444444444"
    });

    expect(result.health.status).toBe("Healthy");
    expect(result.assets).toHaveLength(2);
    expect(result.assets[0]?.assetType).toBe("Repository");
    expect(result.signals.map((signal) => signal.signalSubcategory)).toEqual(
      expect.arrayContaining([
        "BranchProtection",
        "CodeOwner",
        "RepoPermission",
        "SecretScanCandidate"
      ])
    );
  });

  it("runs GitLab sync without fetching repository content", async () => {
    const connector = getConnectorByKey("gitlab");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "pat"]));

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "gitlab",
        mockMode: true
      },
      integrationId: "12121212-1212-4121-8121-121212121212",
      mockMode: true,
      tenantId: "23232323-2323-4232-8232-232323232323"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets[0]?.assetType).toBe("Repository");
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "Repository",
        "BranchProtection",
        "RepoPermission"
      ])
    );

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);

      if (url.endsWith("/user")) {
        return new Response(
          JSON.stringify({
            username: "periscan-bot"
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }

      if (url.includes("/protected_branches")) {
        return new Response(
          JSON.stringify([
            {
              name: "main"
            }
          ]),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }

      return new Response(
        JSON.stringify([
          {
            archived: false,
            default_branch: "main",
            id: 42,
            namespace: {
              full_path: "periscan-fixtures"
            },
            path_with_namespace: "periscan-fixtures/gitlab-api",
            visibility: "private"
          }
        ]),
        {
          headers: {
            "content-type": "application/json"
          },
          status: 200
        }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "pat",
      config: {
        accessToken: "gitlab-secret-token",
        connectorKey: "gitlab",
        groupPath: "periscan-fixtures"
      },
      integrationId: "34343434-3434-4343-8343-343434343434",
      mockMode: false,
      tenantId: "45454545-4545-4454-8454-454545454545"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets).toHaveLength(1);
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "Repository",
        "BranchProtection",
        "RepoPermission"
      ])
    );
    expect(
      fetchMock.mock.calls
        .map((call) => String(call[0]))
        .some((url) => url.includes("/repository/"))
    ).toBe(false);
    expect(JSON.stringify(liveResult)).not.toContain("gitlab-secret-token");
  });

  it("runs Bitbucket Cloud sync without fetching repository content", async () => {
    const connector = getConnectorByKey("bitbucket");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "appPassword"]));

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "bitbucket",
        mockMode: true
      },
      integrationId: "14141414-1414-4141-8141-141414141414",
      mockMode: true,
      tenantId: "24242424-2424-4242-8242-242424242424"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets[0]?.assetType).toBe("Repository");
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "Repository",
        "BranchProtection",
        "RepoPermission"
      ])
    );

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        void init;
        const url = String(input);
        const authorization = (
          init?.headers as Record<string, string> | undefined
        )?.authorization;

        expect(authorization).toMatch(/^Basic /u);

        if (url.endsWith("/user")) {
          return new Response(
            JSON.stringify({
              display_name: "Periscan Bitbucket",
              nickname: "periscan-bot"
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (url.includes("/branch-restrictions")) {
          return new Response(
            JSON.stringify({
              values: [
                {
                  branch_match_kind: "glob",
                  id: 1,
                  kind: "push",
                  pattern: "main"
                }
              ]
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (url.includes("/repositories/periscan-fixtures?")) {
          return new Response(
            JSON.stringify({
              values: [
                {
                  full_name: "periscan-fixtures/bitbucket-live",
                  is_private: true,
                  mainbranch: {
                    name: "main"
                  },
                  name: "bitbucket-live",
                  owner: {
                    nickname: "periscan-fixtures"
                  },
                  project: {
                    key: "PERI",
                    name: "Periscan"
                  },
                  scm: "git",
                  slug: "bitbucket-live",
                  uuid: "{bitbucket-live-repo}"
                }
              ]
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        return new Response(JSON.stringify({ error: "not found" }), {
          status: 404
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "appPassword",
      config: {
        appPassword: "bitbucket-secret-password",
        connectorKey: "bitbucket",
        username: "periscan-bot",
        workspace: "periscan-fixtures"
      },
      integrationId: "34343434-3434-4343-8343-343434343434",
      mockMode: false,
      tenantId: "45454545-4545-4454-8454-454545454545"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets.map((asset) => asset.name)).toEqual([
      "periscan-fixtures/bitbucket-live"
    ]);
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "Repository",
        "BranchProtection",
        "RepoPermission"
      ])
    );
    expect(
      fetchMock.mock.calls.every((call) => (call[1]?.method ?? "GET") === "GET")
    ).toBe(true);
    expect(JSON.stringify(liveResult)).not.toContain(
      "bitbucket-secret-password"
    );
  });

  it("runs Azure DevOps sync without fetching repository content", async () => {
    const connector = getConnectorByKey("azure-devops");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "pat"]));

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "azure-devops",
        mockMode: true
      },
      integrationId: "25252525-2525-4252-8252-252525252525",
      mockMode: true,
      tenantId: "26262626-2626-4262-8262-262626262626"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets[0]?.assetType).toBe("Repository");
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "Repository",
        "BranchProtection",
        "RepoPermission"
      ])
    );

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        void init;
        const url = String(input);
        const authorization = (
          init?.headers as Record<string, string> | undefined
        )?.authorization;

        expect(authorization).toMatch(/^Basic /u);

        if (url.includes("/_apis/projects")) {
          return new Response(
            JSON.stringify({
              value: [
                {
                  id: "project-live-id",
                  name: "Periscan",
                  state: "wellFormed"
                }
              ]
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (url.includes("/_apis/git/repositories")) {
          return new Response(
            JSON.stringify({
              value: [
                {
                  defaultBranch: "refs/heads/main",
                  id: "repo-live-id",
                  isDisabled: false,
                  isFork: false,
                  name: "periscan-api",
                  project: {
                    id: "project-live-id",
                    name: "Periscan",
                    state: "wellFormed"
                  },
                  remoteUrl:
                    "https://dev.azure.com/periscan-fixtures/Periscan/_git/periscan-api",
                  webUrl:
                    "https://dev.azure.com/periscan-fixtures/Periscan/_git/periscan-api"
                }
              ]
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (url.includes("/_apis/git/policy/configurations")) {
          return new Response(
            JSON.stringify({
              value: [
                {
                  id: 1,
                  isBlocking: true,
                  isEnabled: true,
                  type: {
                    displayName: "Minimum number of reviewers"
                  }
                }
              ]
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        return new Response(JSON.stringify({ error: "not found" }), {
          status: 404
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "pat",
      config: {
        connectorKey: "azure-devops",
        organization: "periscan-fixtures",
        pat: "azure-devops-secret-pat"
      },
      integrationId: "27272727-2727-4272-8272-272727272727",
      mockMode: false,
      tenantId: "28282828-2828-4282-8282-282828282828"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets.map((asset) => asset.name)).toEqual([
      "Periscan/periscan-api"
    ]);
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "Repository",
        "BranchProtection",
        "RepoPermission"
      ])
    );
    expect(
      fetchMock.mock.calls
        .map((call) => String(call[0]))
        .some((url) => url.includes("/items"))
    ).toBe(false);
    expect(JSON.stringify(liveResult)).not.toContain("azure-devops-secret-pat");
  });

  it("runs Buildkite read-only pipeline sync without reading logs or artifacts", async () => {
    const connector = getConnectorByKey("buildkite");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiToken"]));

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "buildkite",
        mockMode: true
      },
      integrationId: "29292929-2929-4292-8292-292929292929",
      mockMode: true,
      tenantId: "30303030-3030-4303-8303-303030303030"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets[0]?.assetType).toBe("Application");
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "CICDPipeline",
        "PipelineRepositoryLinked",
        "PipelineControlContext"
      ])
    );

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);

        expect(
          (init?.headers as Record<string, string> | undefined)?.authorization
        ).toBe("Bearer buildkite-secret-token");

        if (url.endsWith("/user")) {
          return new Response(
            JSON.stringify({
              email: "buildkite@example.com",
              name: "Buildkite Bot",
              uuid: "buildkite-user"
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (url.includes("/pipelines?")) {
          return new Response(
            JSON.stringify([
              {
                archived_at: null,
                default_branch: "main",
                name: "Periscan API",
                repository: "git@github.com:periscan-fixtures/api.git",
                slug: "periscan-api",
                visibility: "private",
                web_url: "https://buildkite.com/periscan-fixtures/periscan-api"
              }
            ]),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        return new Response(JSON.stringify({ error: "not found" }), {
          status: 404
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "apiToken",
      config: {
        connectorKey: "buildkite",
        organization: "periscan-fixtures",
        token: "buildkite-secret-token"
      },
      integrationId: "31313131-3131-4313-8313-313131313131",
      mockMode: false,
      tenantId: "32323232-3232-4323-8323-323232323232"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets.map((asset) => asset.name)).toEqual([
      "buildkite/periscan-api"
    ]);
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "CICDPipeline",
        "PipelineRepositoryLinked",
        "PipelineControlContext"
      ])
    );
    expect(
      fetchMock.mock.calls
        .map((call) => String(call[0]))
        .some((url) => /\/(builds|artifacts|logs)\b/u.test(url))
    ).toBe(false);
    expect(JSON.stringify(liveResult)).not.toContain("buildkite-secret-token");
  });

  it("runs CircleCI read-only pipeline sync without reading jobs logs or artifacts", async () => {
    const connector = getConnectorByKey("circleci");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiToken"]));

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "circleci",
        mockMode: true
      },
      integrationId: "33333333-3333-4333-8333-333333333333",
      mockMode: true,
      tenantId: "34343434-3434-4343-8343-343434343434"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets[0]?.assetType).toBe("Application");
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "CICDPipeline",
        "PipelineRepositoryLinked",
        "PipelineControlContext"
      ])
    );

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);

        expect(
          (init?.headers as Record<string, string> | undefined)?.[
            "circle-token"
          ]
        ).toBe("circleci-secret-token");

        if (url.endsWith("/me")) {
          return new Response(
            JSON.stringify({
              id: "circleci-user",
              login: "periscan-bot",
              name: "CircleCI Bot"
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (url.includes("/project/gh/periscan-fixtures/api/pipeline")) {
          return new Response(
            JSON.stringify({
              items: [
                {
                  created_at: "2026-06-01T00:00:00Z",
                  id: "circleci-live-pipeline",
                  number: 42,
                  project_slug: "gh/periscan-fixtures/api",
                  state: "created",
                  trigger: {
                    type: "webhook"
                  },
                  vcs: {
                    branch: "main",
                    revision: "abc123"
                  }
                }
              ],
              next_page_token: null
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        return new Response(JSON.stringify({ error: "not found" }), {
          status: 404
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "apiToken",
      config: {
        connectorKey: "circleci",
        projectSlugs: ["gh/periscan-fixtures/api"],
        token: "circleci-secret-token"
      },
      integrationId: "35353535-3535-4353-8353-353535353535",
      mockMode: false,
      tenantId: "36363636-3636-4363-8363-363636363636"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets.map((asset) => asset.name)).toEqual([
      "circleci/periscan-fixtures/api"
    ]);
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "CICDPipeline",
        "PipelineRepositoryLinked",
        "PipelineControlContext"
      ])
    );
    expect(
      fetchMock.mock.calls
        .map((call) => String(call[0]))
        .some((url) => /\/(job|jobs|artifact|artifacts|logs)\b/u.test(url))
    ).toBe(false);
    expect(JSON.stringify(liveResult)).not.toContain("circleci-secret-token");
  });

  it("runs Jenkins read-only job sync without triggering builds or reading logs/artifacts", async () => {
    const connector = getConnectorByKey("jenkins");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiToken"]));

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "jenkins",
        mockMode: true
      },
      integrationId: "39393939-3939-4393-8393-393939393939",
      mockMode: true,
      tenantId: "40404040-4040-4404-8404-404040404040"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets[0]?.assetType).toBe("Application");
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "CICDPipeline",
        "PipelineRepositoryMissing",
        "PipelineLastBuildSucceeded",
        "PipelineControlContext"
      ])
    );

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);

        expect(
          (init?.headers as Record<string, string> | undefined)?.authorization
        ).toBe(
          `Basic ${Buffer.from("jenkins-bot:jenkins-secret-token").toString(
            "base64"
          )}`
        );

        if (url.endsWith("/me/api/json?tree=id,fullName,absoluteUrl")) {
          return new Response(
            JSON.stringify({
              absoluteUrl: "https://jenkins.example.com/user/jenkins-bot",
              fullName: "Jenkins Bot",
              id: "jenkins-bot"
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (
          url.endsWith(
            "/api/json?tree=jobs[name,fullName,url,color,buildable,disabled,inQueue,lastBuild[number,url]]"
          )
        ) {
          return new Response(
            JSON.stringify({
              jobs: [
                {
                  buildable: true,
                  color: "blue",
                  disabled: false,
                  fullName: "periscan-api",
                  inQueue: false,
                  lastBuild: {
                    number: 104,
                    url: "https://jenkins.example.com/job/periscan-api/104/"
                  },
                  name: "periscan-api",
                  url: "https://jenkins.example.com/job/periscan-api/"
                }
              ]
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (
          url.endsWith(
            "/job/periscan-api/lastBuild/api/json?tree=number,id,result,building,duration,estimatedDuration,timestamp,fullDisplayName,url"
          )
        ) {
          return new Response(
            JSON.stringify({
              building: false,
              duration: 420000,
              estimatedDuration: 420000,
              fullDisplayName: "Periscan API #104",
              id: "104",
              number: 104,
              result: "SUCCESS",
              timestamp: 1781024000000,
              url: "https://jenkins.example.com/job/periscan-api/104/"
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        return new Response(JSON.stringify({ error: "not found" }), {
          status: 404
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "apiToken",
      config: {
        apiBaseUrl: "https://jenkins.example.com",
        apiToken: "jenkins-secret-token",
        connectorKey: "jenkins",
        includeLastBuild: true,
        maxJobs: 10,
        username: "jenkins-bot"
      },
      integrationId: "41414141-4141-4414-8414-414141414141",
      mockMode: false,
      tenantId: "42424242-4242-4424-8424-424242424242"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets.map((asset) => asset.name)).toEqual([
      "jenkins/periscan-api"
    ]);
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "CICDPipeline",
        "PipelineRepositoryMissing",
        "PipelineLastBuildSucceeded",
        "PipelineControlContext"
      ])
    );
    expect(
      fetchMock.mock.calls
        .map((call) => String(call[0]))
        .some((url) =>
          /\/(build|buildWithParameters|console|consoleText|artifact|artifacts|config\.xml|credentials|script)\b/u.test(
            url
          )
        )
    ).toBe(false);
    expect(JSON.stringify(liveResult)).not.toContain("jenkins-secret-token");
  });

  it("runs Docker Hub read-only registry sync without pulling image layers", async () => {
    const connector = getConnectorByKey("docker-hub");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "accessToken"]));

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "docker-hub",
        mockMode: true
      },
      integrationId: "37373737-3737-4373-8373-373737373737",
      mockMode: true,
      tenantId: "38383838-3838-4383-8383-383838383838"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets[0]?.assetType).toBe("Container");
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "ContainerImageRepository",
        "PrivateContainerRepository",
        "ContainerImageTag"
      ])
    );

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);

        expect(
          (init?.headers as Record<string, string> | undefined)?.authorization
        ).toBe("Bearer docker-hub-secret-token");

        if (url.endsWith("/repositories/periscan-fixtures/periscan-api/")) {
          return new Response(
            JSON.stringify({
              description: "Periscan API image",
              is_private: false,
              name: "periscan-api",
              namespace: "periscan-fixtures",
              pull_count: 5000,
              repository_type: "image",
              status: 1,
              user: "periscan-fixtures"
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (url.includes("/repositories/periscan-fixtures/periscan-api/tags")) {
          return new Response(
            JSON.stringify({
              next: null,
              results: [
                {
                  full_size: 120000000,
                  last_pushed: "2026-06-01T00:00:00Z",
                  name: "latest"
                }
              ]
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        return new Response(JSON.stringify({ error: "not found" }), {
          status: 404
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "accessToken",
      config: {
        connectorKey: "docker-hub",
        namespace: "periscan-fixtures",
        repositories: ["periscan-api"],
        token: "docker-hub-secret-token"
      },
      integrationId: "39393939-3939-4393-8393-393939393939",
      mockMode: false,
      tenantId: "40404040-4040-4404-8404-404040404040"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets.map((asset) => asset.name)).toEqual([
      "docker-hub/periscan-fixtures/periscan-api"
    ]);
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "ContainerImageRepository",
        "PublicContainerRepository",
        "ContainerImageTag"
      ])
    );
    expect(
      fetchMock.mock.calls
        .map((call) => String(call[0]))
        .some((url) => /\/(manifests|blobs|layers)\b/u.test(url))
    ).toBe(false);
    expect(JSON.stringify(liveResult)).not.toContain("docker-hub-secret-token");
  });

  it("runs GitHub Container Registry read-only package sync without pulling images", async () => {
    const connector = getConnectorByKey("github-container-registry");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "pat"]));

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "github-container-registry",
        mockMode: true
      },
      integrationId: "41414141-4141-4414-8414-414141414141",
      mockMode: true,
      tenantId: "42424242-4242-4424-8424-424242424242"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets[0]?.assetType).toBe("Container");
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "ContainerImageRepository",
        "PrivateContainerRepository",
        "PublicContainerRepository",
        "ContainerImageVersion",
        "ContainerImageTag"
      ])
    );

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        const headers = init?.headers as Record<string, string> | undefined;

        expect(headers?.authorization).toBe("Bearer ghcr-secret-token");
        expect(headers?.accept).toBe("application/vnd.github+json");

        if (
          url.endsWith(
            "/orgs/periscan-fixtures/packages/container/periscan-api"
          )
        ) {
          return new Response(
            JSON.stringify({
              created_at: "2026-06-01T00:00:00Z",
              html_url:
                "https://github.com/orgs/periscan-fixtures/packages/container/package/periscan-api",
              id: 7001,
              name: "periscan-api",
              owner: {
                login: "periscan-fixtures"
              },
              package_type: "container",
              repository: {
                full_name: "periscan-fixtures/periscan-api",
                html_url: "https://github.com/periscan-fixtures/periscan-api",
                private: true
              },
              updated_at: "2026-06-02T00:00:00Z",
              url: "https://api.github.com/orgs/periscan-fixtures/packages/container/periscan-api",
              version_count: 1,
              visibility: "private"
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (
          url.includes(
            "/orgs/periscan-fixtures/packages/container/periscan-api/versions"
          )
        ) {
          return new Response(
            JSON.stringify([
              {
                created_at: "2026-06-02T00:00:00Z",
                html_url:
                  "https://github.com/orgs/periscan-fixtures/packages/container/periscan-api/versions/9001",
                id: 9001,
                metadata: {
                  container: {
                    tags: ["latest"]
                  }
                },
                name: "sha256:abc123",
                updated_at: "2026-06-02T00:00:00Z",
                url: "https://api.github.com/orgs/periscan-fixtures/packages/container/periscan-api/versions/9001"
              }
            ]),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        return new Response(JSON.stringify({ message: "not found" }), {
          status: 404
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "pat",
      config: {
        connectorKey: "github-container-registry",
        owner: "periscan-fixtures",
        ownerType: "org",
        packages: ["periscan-api"],
        token: "ghcr-secret-token"
      },
      integrationId: "43434343-4343-4434-8434-434343434343",
      mockMode: false,
      tenantId: "44444444-4444-4444-8444-444444444444"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets.map((asset) => asset.name)).toEqual([
      "ghcr/periscan-fixtures/periscan-api"
    ]);
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "ContainerImageRepository",
        "PrivateContainerRepository",
        "ContainerImageVersion",
        "ContainerImageTag"
      ])
    );
    expect(
      fetchMock.mock.calls
        .map((call) => String(call[0]))
        .some((url) => /\/(v2|manifests|blobs|layers)\b/u.test(url))
    ).toBe(false);
    expect(JSON.stringify(liveResult)).not.toContain("ghcr-secret-token");
  });

  it("runs AWS ECR read-only repository and image metadata sync", async () => {
    const connector = getConnectorByKey("aws-ecr");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(
      expect.arrayContaining(["mock", "staticCredentials", "assumeRole"])
    );
    expect(connector!.manifest.requiredPermissions).toEqual(
      expect.arrayContaining(["ecr:DescribeRepositories", "ecr:DescribeImages"])
    );

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "aws-ecr",
        mockMode: true
      },
      integrationId: "45454545-4545-4454-8454-454545454545",
      mockMode: true,
      tenantId: "46464646-4646-4464-8464-464646464646"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets[0]?.assetType).toBe("Container");
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "ContainerImageRepository",
        "PrivateContainerRepository",
        "ContainerImageScanOnPushEnabled",
        "ContainerImageScanOnPushDisabled",
        "ContainerImageImmutableTags",
        "ContainerImageMutableTags",
        "ContainerImageDigest",
        "ContainerImageTag"
      ])
    );

    const observedCommandNames: string[] = [];
    const sendSpy = vi
      .spyOn(ECRClient.prototype, "send")
      .mockImplementation(async (command) => {
        const commandName = command.constructor.name;
        observedCommandNames.push(commandName);

        if (commandName === "DescribeRepositoriesCommand") {
          return {
            repositories: [
              {
                createdAt: new Date("2026-06-02T00:00:00Z"),
                encryptionConfiguration: {
                  encryptionType: "AES256"
                },
                imageScanningConfiguration: {
                  scanOnPush: true
                },
                imageTagMutability: "IMMUTABLE",
                registryId: "123456789012",
                repositoryArn:
                  "arn:aws:ecr:us-east-1:123456789012:repository/periscan-api",
                repositoryName: "periscan-api",
                repositoryUri:
                  "123456789012.dkr.ecr.us-east-1.amazonaws.com/periscan-api"
              }
            ]
          } as never;
        }

        if (commandName === "DescribeImagesCommand") {
          return {
            imageDetails: [
              {
                imageDigest: "sha256:live",
                imagePushedAt: new Date("2026-06-02T00:00:00Z"),
                imageScanStatus: {
                  status: "COMPLETE"
                },
                imageSizeInBytes: 125000000,
                imageTags: ["latest"]
              }
            ]
          } as never;
        }

        return {} as never;
      });

    const liveResult = await connector!.sync({
      authType: "staticCredentials",
      config: {
        accessKeyId: "AKIA1234567890ECR",
        connectorKey: "aws-ecr",
        region: "us-east-1",
        repositories: ["periscan-api"],
        secretAccessKey: "aws-ecr-secret-key"
      },
      integrationId: "47474747-4747-4474-8474-474747474747",
      mockMode: false,
      tenantId: "48484848-4848-4484-8484-484848484848"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets.map((asset) => asset.name)).toEqual([
      "aws-ecr/123456789012.dkr.ecr.us-east-1.amazonaws.com/periscan-api"
    ]);
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "ContainerImageRepository",
        "PrivateContainerRepository",
        "ContainerImageScanOnPushEnabled",
        "ContainerImageImmutableTags",
        "ContainerImageDigest",
        "ContainerImageTag"
      ])
    );
    expect(sendSpy).toHaveBeenCalledWith(
      expect.any(DescribeRepositoriesCommand)
    );
    expect(sendSpy).toHaveBeenCalledWith(expect.any(DescribeImagesCommand));
    expect(observedCommandNames).not.toEqual(
      expect.arrayContaining([
        "GetAuthorizationTokenCommand",
        "BatchGetImageCommand",
        "GetDownloadUrlForLayerCommand",
        "PutImageCommand",
        "DeleteRepositoryCommand"
      ])
    );
    expect(JSON.stringify(liveResult)).not.toContain("aws-ecr-secret-key");

    sendSpy.mockRestore();
  });

  it("runs Tenable read-only vulnerability management sync", async () => {
    const connector = getConnectorByKey("tenable");

    expect(connector).toBeDefined();
    expect(connector!.manifest).toMatchObject({
      availability: "Beta",
      connectable: true,
      marketplaceCategory: "VM/EAP/ASM/CNAPP",
      product: "Tenable Vulnerability Management"
    });
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiKeys"]));
    expect(connector!.manifest.requiredPermissions).toEqual(
      expect.arrayContaining([
        "workbenches:read",
        "assets:read",
        "vulnerabilities:read"
      ])
    );

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "tenable",
        mockMode: true
      },
      integrationId: "51515151-5151-4515-8515-515151515151",
      mockMode: true,
      tenantId: "52525252-5252-4525-8525-525252525252"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets[0]?.assetType).toBe("Host");
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "VulnerabilityManagedAsset",
        "CriticalVulnerability",
        "HighVulnerability",
        "CveObserved"
      ])
    );

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);

      if (url.includes("/workbenches/assets")) {
        return new Response(
          JSON.stringify({
            assets: [
              {
                acr_score: 8.1,
                asset_uuid: "live-tenable-asset",
                fqdn: ["live.example.com"],
                hostname: ["live-host-01"],
                ipv4: ["198.51.100.22"],
                last_seen: "2026-06-02T00:00:00Z",
                operating_systems: ["Ubuntu 24.04"],
                severity_counts: {
                  critical: 1,
                  high: 2
                }
              }
            ]
          }),
          {
            status: 200
          }
        );
      }

      if (url.includes("/workbenches/vulnerabilities")) {
        return new Response(
          JSON.stringify({
            vulnerabilities: [
              {
                count: 1,
                cve: ["CVE-2026-51515"],
                plugin_id: 51515,
                plugin_name: "Live Tenable critical vulnerability",
                severity: "critical",
                vpr_score: 9.1,
                vulnerability_state: "Open"
              }
            ]
          }),
          {
            status: 200
          }
        );
      }

      return new Response("not found", {
        status: 404
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "apiKeys",
      config: {
        accessKey: "tenable-secret-access-key",
        apiBaseUrl: "https://cloud.tenable.example",
        assetLimit: 10,
        connectorKey: "tenable",
        secretKey: "tenable-secret-key",
        vulnerabilityLimit: 20
      },
      integrationId: "53535353-5353-4535-8535-535353535353",
      mockMode: false,
      tenantId: "54545454-5454-4545-8545-545454545454"
    });
    const requestedUrls = fetchMock.mock.calls.map((call) => String(call[0]));

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets.map((asset) => asset.name)).toEqual([
      "tenable/live-host-01"
    ]);
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "VulnerabilityManagedAsset",
        "CriticalVulnerability",
        "CveObserved"
      ])
    );
    expect(requestedUrls).toEqual(
      expect.arrayContaining([
        "https://cloud.tenable.example/workbenches/assets?limit=10",
        "https://cloud.tenable.example/workbenches/vulnerabilities?limit=20"
      ])
    );
    expect(
      requestedUrls.some((url) => /\/(?:scans|exports|policies)\b/u.test(url))
    ).toBe(false);
    expect(JSON.stringify(liveResult)).not.toContain("tenable-secret-key");
    expect(JSON.stringify(liveResult)).not.toContain(
      "tenable-secret-access-key"
    );
  });

  it("runs Rapid7 InsightVM read-only vulnerability management sync", async () => {
    const connector = getConnectorByKey("rapid7-insightvm");

    expect(connector).toBeDefined();
    expect(connector!.manifest).toMatchObject({
      availability: "Beta",
      connectable: true,
      marketplaceCategory: "VM/EAP/ASM/CNAPP",
      product: "InsightVM",
      vendor: "Rapid7"
    });
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "basicAuth"]));
    expect(connector!.manifest.requiredPermissions).toEqual(
      expect.arrayContaining(["assets:read", "vulnerabilities:read"])
    );

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "rapid7-insightvm",
        mockMode: true
      },
      integrationId: "55555555-5555-4555-8555-555555555555",
      mockMode: true,
      tenantId: "56565656-5656-4565-8565-565656565656"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets[0]?.assetType).toBe("Host");
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "VulnerabilityManagedAsset",
        "CriticalVulnerability",
        "CveObserved"
      ])
    );

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);

      if (url.includes("/assets")) {
        return new Response(
          JSON.stringify({
            resources: [
              {
                addresses: ["198.51.100.44"],
                criticality: "Very High",
                hostName: "rapid7-live-host-01",
                id: 9901,
                lastScanTime: "2026-06-02T00:00:00Z",
                os: "Ubuntu Linux",
                riskScore: 910,
                vulnerabilities: {
                  critical: 1,
                  severe: 2,
                  total: 3
                }
              }
            ]
          }),
          {
            status: 200
          }
        );
      }

      if (url.includes("/vulnerabilities")) {
        return new Response(
          JSON.stringify({
            resources: [
              {
                added: "2026-06-01T00:00:00Z",
                cves: ["CVE-2026-56565"],
                cvssScore: 9.3,
                id: "rapid7-live-critical",
                severity: "Critical",
                title: "Rapid7 live critical vulnerability"
              }
            ]
          }),
          {
            status: 200
          }
        );
      }

      return new Response("not found", {
        status: 404
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "basicAuth",
      config: {
        apiBaseUrl: "https://insightvm.example.com/api/3",
        assetLimit: 10,
        connectorKey: "rapid7-insightvm",
        password: "rapid7-secret-password",
        username: "periscan-readonly",
        vulnerabilityLimit: 20
      },
      integrationId: "57575757-5757-4575-8575-575757575757",
      mockMode: false,
      tenantId: "58585858-5858-4585-8585-585858585858"
    });
    const requestedUrls = fetchMock.mock.calls.map((call) => String(call[0]));

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets.map((asset) => asset.name)).toEqual([
      "rapid7-insightvm/rapid7-live-host-01"
    ]);
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "VulnerabilityManagedAsset",
        "CriticalVulnerability",
        "CveObserved"
      ])
    );
    expect(requestedUrls).toEqual(
      expect.arrayContaining([
        "https://insightvm.example.com/api/3/assets?size=10",
        "https://insightvm.example.com/api/3/vulnerabilities?size=20"
      ])
    );
    expect(
      requestedUrls.some((url) =>
        /\/(?:scans|scan_engines|reports|exports|policies|remediation_projects)\b/u.test(
          url
        )
      )
    ).toBe(false);
    expect(JSON.stringify(liveResult)).not.toContain("rapid7-secret-password");
  });

  it("runs Wiz read-only CNAPP issue and resource sync", async () => {
    const connector = getConnectorByKey("wiz");

    expect(connector).toBeDefined();
    expect(connector!.manifest).toMatchObject({
      availability: "Beta",
      connectable: true,
      marketplaceCategory: "VM/EAP/ASM/CNAPP",
      product: "Wiz"
    });
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "oauth2ClientCredentials"]));
    expect(connector!.manifest.requiredPermissions).toEqual(
      expect.arrayContaining([
        "read:cloud_resources",
        "read:issues",
        "read:vulnerabilities"
      ])
    );

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "wiz",
        mockMode: true
      },
      integrationId: "59595959-5959-4595-8595-595959595959",
      mockMode: true,
      tenantId: "60606060-6060-4606-8606-606060606060"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets[0]?.assetType).toBe("CloudResource");
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "CnappCloudResource",
        "CloudResourceInternetExposed",
        "CriticalCnappIssue",
        "HighCnappIssue",
        "CveObserved"
      ])
    );

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);

        if (url === "https://auth.wiz.example/oauth/token") {
          return new Response(
            JSON.stringify({
              access_token: "wiz-access-token"
            }),
            {
              status: 200
            }
          );
        }

        if (url === "https://api.wiz.example/graphql") {
          const body = JSON.parse(String(init?.body ?? "{}")) as {
            query?: string;
          };

          if (body.query?.includes("PeriscanWizIssues")) {
            return new Response(
              JSON.stringify({
                data: {
                  issues: {
                    nodes: [
                      {
                        createdAt: "2026-06-02T00:00:00Z",
                        cves: ["CVE-2026-60606"],
                        entitySnapshot: {
                          id: "wiz-live-resource",
                          name: "live-wiz-alb",
                          nativeType:
                            "AWS::ElasticLoadBalancingV2::LoadBalancer",
                          providerUniqueId:
                            "arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/live",
                          type: "LOAD_BALANCER"
                        },
                        id: "wiz-live-critical",
                        severity: "CRITICAL",
                        status: "OPEN",
                        title: "Critical Wiz issue",
                        type: "VULNERABILITY"
                      }
                    ]
                  }
                }
              }),
              {
                status: 200
              }
            );
          }

          if (body.query?.includes("PeriscanWizCloudResources")) {
            return new Response(
              JSON.stringify({
                data: {
                  cloudResources: {
                    nodes: [
                      {
                        cloudPlatform: "AWS",
                        id: "wiz-live-resource",
                        internetExposure: true,
                        name: "live-wiz-alb",
                        nativeType: "AWS::ElasticLoadBalancingV2::LoadBalancer",
                        providerUniqueId:
                          "arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/live",
                        region: "us-east-1",
                        status: "Active",
                        subscriptionExternalId: "123456789012",
                        type: "LOAD_BALANCER"
                      }
                    ]
                  }
                }
              }),
              {
                status: 200
              }
            );
          }
        }

        return new Response("not found", {
          status: 404
        });
      }
    );

    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "oauth2ClientCredentials",
      config: {
        clientId: "wiz-client-id",
        clientSecret: "wiz-client-secret",
        connectorKey: "wiz",
        graphqlUrl: "https://api.wiz.example/graphql",
        issueLimit: 10,
        projectIds: ["project-1"],
        resourceLimit: 20,
        tokenUrl: "https://auth.wiz.example/oauth/token"
      },
      integrationId: "61616161-6161-4616-8616-616161616161",
      mockMode: false,
      tenantId: "62626262-6262-4626-8626-626262626262"
    });
    const requestedUrls = fetchMock.mock.calls.map((call) => String(call[0]));

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets.map((asset) => asset.name)).toEqual([
      "wiz/live-wiz-alb"
    ]);
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "CnappCloudResource",
        "CloudResourceInternetExposed",
        "CriticalCnappIssue",
        "CveObserved"
      ])
    );
    expect(requestedUrls).toEqual(
      expect.arrayContaining([
        "https://auth.wiz.example/oauth/token",
        "https://api.wiz.example/graphql"
      ])
    );
    expect(JSON.stringify(liveResult)).not.toContain("wiz-client-secret");
    expect(JSON.stringify(liveResult)).not.toContain("wiz-access-token");
  });

  it("runs Prisma Cloud read-only CNAPP alert sync", async () => {
    const connector = getConnectorByKey("prisma-cloud");

    expect(connector).toBeDefined();
    expect(connector!.manifest).toMatchObject({
      availability: "Beta",
      connectable: true,
      marketplaceCategory: "VM/EAP/ASM/CNAPP",
      product: "Prisma Cloud",
      vendor: "Palo Alto Networks"
    });
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "accessKey"]));
    expect(connector!.manifest.requiredPermissions).toEqual(
      expect.arrayContaining(["alert:read"])
    );

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "prisma-cloud",
        mockMode: true
      },
      integrationId: "63636363-6363-4636-8636-636363636363",
      mockMode: true,
      tenantId: "64646464-6464-4646-8646-646464646464"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets[0]?.assetType).toBe("CloudResource");
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "CnappCloudResource",
        "CloudResourceInternetExposed",
        "CriticalCnappIssue",
        "HighCnappIssue",
        "CveObserved"
      ])
    );

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        const headers = init?.headers as Record<string, string> | undefined;

        if (url === "https://api.prismacloud.example.test/login") {
          expect(init?.method).toBe("POST");
          expect(String(init?.body)).toContain(
            '"username":"prisma-access-key"'
          );
          expect(String(init?.body)).toContain(
            '"password":"prisma-secret-key"'
          );

          return new Response(
            JSON.stringify({
              token: "prisma-jwt-token"
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        expect(init?.method ?? "GET").toBe("GET");
        expect(url).toContain("https://api.prismacloud.example.test/v2/alert");
        expect(url).toContain("timeType=relative");
        expect(url).toContain("timeAmount=7");
        expect(url).toContain("timeUnit=day");
        expect(url).toContain("limit=10");
        expect(headers?.["x-redlock-auth"]).toBe("prisma-jwt-token");
        expect(url).not.toMatch(
          /\/(alert\/dismiss|alert\/snooze|alert\/reopen|remediation|access_keys|alert\/rule|policy|policies|cloud|resource\/scan)(\/|\?|$)/iu
        );

        return new Response(
          JSON.stringify({
            items: [
              {
                alertId: "prisma-live-alert",
                policy: {
                  name: "Critical public workload vulnerability",
                  severity: "critical",
                  type: "vulnerability"
                },
                reason: "CVE-2026-71717 observed on internet exposed workload",
                resource: {
                  account: "Production AWS",
                  cloudAccountId: "123456789012",
                  cloudType: "aws",
                  id: "i-prisma-live",
                  name: "prisma-live-api",
                  regionId: "us-east-1",
                  rrn: "rrn::instance:prisma-live-api"
                },
                severity: "critical",
                status: "open",
                time: "2026-06-01T12:00:00.000Z"
              }
            ]
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "accessKey",
      config: {
        accessKeyId: "prisma-access-key",
        alertLimit: 10,
        apiBaseUrl: "https://api.prismacloud.example.test",
        connectorKey: "prisma-cloud",
        secretKey: "prisma-secret-key"
      },
      integrationId: "65656565-6565-4656-8656-656565656565",
      mockMode: false,
      tenantId: "66666666-6666-4666-8666-666666666666"
    });
    const requestedUrls = fetchMock.mock.calls.map((call) => String(call[0]));

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets.map((asset) => asset.name)).toEqual([
      "prisma-cloud/prisma-live-api"
    ]);
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "CnappCloudResource",
        "CloudResourceInternetExposed",
        "CriticalCnappIssue",
        "CveObserved"
      ])
    );
    expect(requestedUrls).toEqual(
      expect.arrayContaining(["https://api.prismacloud.example.test/login"])
    );
    expect(requestedUrls.some((url) => url.includes("/v2/alert"))).toBe(true);
    expect(JSON.stringify(liveResult)).not.toContain("prisma-secret-key");
    expect(JSON.stringify(liveResult)).not.toContain("prisma-jwt-token");
  });

  it("runs Lacework read-only host vulnerability observation sync", async () => {
    const connector = getConnectorByKey("lacework");

    expect(connector).toBeDefined();
    expect(connector!.manifest).toMatchObject({
      availability: "Beta",
      connectable: true,
      marketplaceCategory: "VM/EAP/ASM/CNAPP",
      product: "FortiCNAPP",
      vendor: "Fortinet"
    });
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "bearerToken"]));
    expect(connector!.manifest.requiredPermissions).toEqual(
      expect.arrayContaining(["vulnerability_observations:host:read"])
    );

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "lacework",
        mockMode: true
      },
      integrationId: "67676767-6767-4676-8676-676767676767",
      mockMode: true,
      tenantId: "68686868-6868-4686-8686-686868686868"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets[0]?.assetType).toBe("Host");
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "VulnerabilityManagedHost",
        "CriticalHostVulnerability",
        "HighHostVulnerability",
        "CveObserved"
      ])
    );

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        const headers = init?.headers as Record<string, string> | undefined;

        expect(init?.method).toBe("POST");
        expect(url).toBe(
          "https://customer.lacework.example.test/api/v2/VulnerabilityObservations/Hosts/search"
        );
        expect(String(init?.body)).toContain('"limit":10');
        expect(headers?.authorization).toBe("Bearer lacework-api-token");
        expect(url).not.toMatch(
          /\/(Vulnerabilities\/Containers\/scan|VulnerabilityExceptions|VulnerabilityPolicies|Alerts\/[^/]+\/(?:close|comment)|AlertChannels|Webhooks|ServerTokens)(\/|\?|$)/u
        );

        return new Response(
          JSON.stringify({
            data: [
              {
                cveId: "CVE-2026-78787",
                hostname: "lacework-live-api-01",
                machineId: "lacework-live-machine",
                packageName: "openssl",
                severity: "Critical",
                status: "Active",
                updatedTime: "2026-06-01T12:00:00.000Z"
              }
            ]
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "bearerToken",
      config: {
        accountUrl: "https://customer.lacework.example.test",
        apiToken: "lacework-api-token",
        connectorKey: "lacework",
        vulnerabilityLimit: 10
      },
      integrationId: "69696969-6969-4696-8696-696969696969",
      mockMode: false,
      tenantId: "70707070-7070-4707-8707-707070707070"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets.map((asset) => asset.name)).toEqual([
      "lacework/lacework-live-api-01"
    ]);
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "VulnerabilityManagedHost",
        "CriticalHostVulnerability",
        "CveObserved"
      ])
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(liveResult)).not.toContain("lacework-api-token");
  });

  it("runs Orca Security read-only CNAPP alert sync", async () => {
    const connector = getConnectorByKey("orca-security");

    expect(connector).toBeDefined();
    expect(connector!.manifest).toMatchObject({
      availability: "Beta",
      connectable: true,
      marketplaceCategory: "VM/EAP/ASM/CNAPP",
      product: "Orca",
      vendor: "Orca Security"
    });
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiToken"]));
    expect(connector!.manifest.requiredPermissions).toEqual(
      expect.arrayContaining(["alerts:read", "assets:read"])
    );

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "orca-security",
        mockMode: true
      },
      integrationId: "71717171-7171-4717-8717-717171717171",
      mockMode: true,
      tenantId: "72727272-7272-4727-8727-727272727272"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets[0]?.assetType).toBe("CloudResource");
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "CnappCloudResource",
        "CloudResourceInternetExposed",
        "CriticalCnappIssue",
        "HighCnappIssue",
        "CveObserved"
      ])
    );

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        const headers = init?.headers as Record<string, string> | undefined;

        expect(init?.method ?? "GET").toBe("GET");
        expect(url).toContain(
          "https://app.us.orcasecurity.example.test/api/alerts"
        );
        expect(url).toContain("limit=10");
        expect(headers?.authorization).toBe("Token orca-api-token");
        expect(url).not.toMatch(
          /\/(alerts\/[^/]+\/(?:acknowledge|dismiss|close|suppress)|remediation|webhooks|integrations|settings|users|cloud-accounts)(\/|\?|$)/iu
        );

        return new Response(
          JSON.stringify({
            alerts: [
              {
                alert_id: "orca-live-alert",
                asset_name: "orca-live-api-01",
                asset_type: "vm",
                cloud_account_id: "123456789012",
                cloud_provider: "aws",
                cve_id: "CVE-2026-80808",
                is_public: true,
                risk_level: "critical",
                severity: "critical",
                status: "open",
                title: "Critical vulnerability on public VM",
                updated_at: "2026-06-01T12:00:00.000Z"
              }
            ]
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "apiToken",
      config: {
        alertLimit: 10,
        apiBaseUrl: "https://app.us.orcasecurity.example.test/api",
        apiToken: "orca-api-token",
        connectorKey: "orca-security"
      },
      integrationId: "73737373-7373-4737-8737-737373737373",
      mockMode: false,
      tenantId: "74747474-7474-4747-8747-747474747474"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets.map((asset) => asset.name)).toEqual([
      "orca/orca-live-api-01"
    ]);
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "CnappCloudResource",
        "CloudResourceInternetExposed",
        "CriticalCnappIssue",
        "CveObserved"
      ])
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(liveResult)).not.toContain("orca-api-token");
  });

  it("runs Qualys VMDR read-only vulnerability management sync", async () => {
    const connector = getConnectorByKey("qualys");

    expect(connector).toBeDefined();
    expect(connector!.manifest).toMatchObject({
      availability: "Beta",
      connectable: true,
      marketplaceCategory: "VM/EAP/ASM/CNAPP",
      product: "Qualys VMDR",
      vendor: "Qualys"
    });
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "basicAuth"]));
    expect(connector!.manifest.requiredPermissions).toEqual(
      expect.arrayContaining([
        "host:read",
        "knowledgebase:read",
        "vm_detection:read"
      ])
    );

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "qualys",
        mockMode: true
      },
      integrationId: "63636363-6363-4636-8636-636363636363",
      mockMode: true,
      tenantId: "64646464-6464-4646-8646-646464646464"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets[0]?.assetType).toBe("Host");
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "VulnerabilityManagedAsset",
        "CriticalVulnerability",
        "HighVulnerability",
        "CveObserved"
      ])
    );

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);

      if (url.includes("/api/2.0/fo/asset/host/?action=list")) {
        return new Response(
          JSON.stringify({
            assets: [
              {
                hostname: "qualys-live-host-01",
                id: "live-qualys-host",
                ip: "198.51.100.61",
                ips: ["198.51.100.61"],
                lastScanDate: "2026-06-02T00:00:00Z",
                os: "Ubuntu 24.04",
                severityCounts: {
                  critical: 1,
                  high: 2
                }
              }
            ]
          }),
          {
            status: 200
          }
        );
      }

      if (url.includes("/api/2.0/fo/asset/host/vm/detection")) {
        return new Response(
          JSON.stringify({
            detections: [
              {
                cves: ["CVE-2026-62626"],
                cvssScore: 9.2,
                hostId: "live-qualys-host",
                lastFoundDate: "2026-06-02T00:00:00Z",
                qid: 62626,
                severity: 5,
                status: "Active",
                title: "Qualys live critical vulnerability"
              }
            ]
          }),
          {
            status: 200
          }
        );
      }

      return new Response("not found", {
        status: 404
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "basicAuth",
      config: {
        apiBaseUrl: "https://qualys.example.com",
        assetLimit: 10,
        connectorKey: "qualys",
        detectionLimit: 20,
        password: "qualys-secret-password",
        username: "periscan-readonly"
      },
      integrationId: "65656565-6565-4656-8656-656565656565",
      mockMode: false,
      tenantId: "66666666-6666-4666-8666-666666666666"
    });
    const requestedUrls = fetchMock.mock.calls.map((call) => String(call[0]));

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets.map((asset) => asset.name)).toEqual([
      "qualys/qualys-live-host-01"
    ]);
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "VulnerabilityManagedAsset",
        "CriticalVulnerability",
        "CveObserved"
      ])
    );
    expect(requestedUrls).toEqual(
      expect.arrayContaining([
        "https://qualys.example.com/api/2.0/fo/asset/host/?action=list&truncation_limit=10",
        "https://qualys.example.com/api/2.0/fo/asset/host/vm/detection/?action=list&truncation_limit=20"
      ])
    );
    expect(
      requestedUrls.some((url) =>
        /\/(?:scans?|reports?|remediation|launch|cancel|configuration)\b/u.test(
          url
        )
      )
    ).toBe(false);
    expect(JSON.stringify(liveResult)).not.toContain("qualys-secret-password");
  });

  it("runs runZero read-only asset export sync", async () => {
    const connector = getConnectorByKey("runzero");

    expect(connector).toBeDefined();
    expect(connector!.manifest).toMatchObject({
      availability: "Beta",
      connectable: true,
      marketplaceCategory: "VM/EAP/ASM/CNAPP",
      product: "runZero",
      vendor: "runZero"
    });
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiToken"]));
    expect(connector!.manifest.requiredPermissions).toEqual(
      expect.arrayContaining(["export:assets:read"])
    );

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "runzero",
        mockMode: true
      },
      integrationId: "67676767-6767-4676-8676-676767676767",
      mockMode: true,
      tenantId: "68686868-6868-4686-8686-686868686868"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets[0]?.assetType).toBe("Host");
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "AssetInventoryObserved",
        "ServiceObservation",
        "PublicExposure"
      ])
    );

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);

      if (
        url ===
        "https://console.runzero.example/api/v1.0/export/org/assets.json?search=alive%3Atrue"
      ) {
        return new Response(
          JSON.stringify([
            {
              address: "203.0.113.72",
              alive: true,
              hostname: "runzero-live-edge-01.example.com",
              id: "live-runzero-edge-01",
              last_seen: "2026-06-02T12:00:00Z",
              os: "Linux",
              protocols: ["http", "https"],
              service_count: 2,
              services: [
                {
                  port: 80,
                  protocol: "http"
                },
                {
                  port: 443,
                  protocol: "https"
                }
              ],
              site_id: "site-live",
              site_name: "Live External Surface",
              type: "server"
            }
          ]),
          {
            status: 200
          }
        );
      }

      return new Response("not found", {
        status: 404
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "apiToken",
      config: {
        apiBaseUrl: "https://console.runzero.example",
        assetLimit: 10,
        connectorKey: "runzero",
        exportToken: "runzero-export-token",
        search: "alive:true"
      },
      integrationId: "69696969-6969-4696-8696-696969696969",
      mockMode: false,
      tenantId: "70707070-7070-4707-8707-707070707070"
    });
    const requestedUrls = fetchMock.mock.calls.map((call) => String(call[0]));

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets.map((asset) => asset.name)).toEqual([
      "runzero/runzero-live-edge-01.example.com"
    ]);
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "AssetInventoryObserved",
        "ServiceObservation",
        "PublicExposure"
      ])
    );
    expect(requestedUrls).toEqual([
      "https://console.runzero.example/api/v1.0/export/org/assets.json?search=alive%3Atrue"
    ]);
    expect(
      requestedUrls.some((url) =>
        /\/api\/v1\.0\/org\/|\/(?:scans?|sites?|tasks?|explorers?)\b/u.test(url)
      )
    ).toBe(false);
    expect(JSON.stringify(liveResult)).not.toContain("runzero-export-token");
  });

  it("runs Assetnote read-only ASM asset sync", async () => {
    const connector = getConnectorByKey("assetnote");

    expect(connector).toBeDefined();
    expect(connector!.manifest).toMatchObject({
      availability: "Beta",
      connectable: true,
      marketplaceCategory: "VM/EAP/ASM/CNAPP",
      product: "Attack Surface Management",
      vendor: "Assetnote"
    });
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiToken"]));
    expect(connector!.manifest.requiredPermissions).toEqual(
      expect.arrayContaining(["assets:read", "exposures:read"])
    );

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "assetnote",
        mockMode: true
      },
      integrationId: "71717171-7171-4717-8717-717171717171",
      mockMode: true,
      tenantId: "72727272-7272-4727-8727-727272727272"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets[0]?.assetType).toBe("Host");
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "AttackSurfaceAssetObserved",
        "ExternalServiceObservation",
        "ExternalExposure",
        "HighAttackSurfaceRisk",
        "CveObserved"
      ])
    );

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        const headers = init?.headers as Record<string, string> | undefined;

        expect(init?.method ?? "GET").toBe("GET");
        expect(url).toBe(
          "https://api.assetnote.example.test/v1/assets?limit=10"
        );
        expect(headers?.authorization).toBe("Bearer assetnote-api-token");
        expect(url).not.toMatch(
          /\/(?:scans?|targets?|assets\/[^/]+\/(?:rescan|delete|update)|monitors?|config|settings)(\/|\?|$)/iu
        );

        return new Response(
          JSON.stringify({
            results: [
              {
                asset_id: "assetnote-live-edge",
                cves: ["CVE-2026-82828"],
                hostname: "live.edge.assetnote.example.com",
                ip: "198.51.100.82",
                last_seen: "2026-06-03T12:00:00.000Z",
                ports: [80, 443],
                risk_level: "high",
                status: "active",
                technologies: ["nginx"],
                type: "host"
              }
            ]
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "apiToken",
      config: {
        apiBaseUrl: "https://api.assetnote.example.test",
        apiToken: "assetnote-api-token",
        assetLimit: 10,
        assetsPath: "/v1/assets",
        connectorKey: "assetnote"
      },
      integrationId: "73737373-7373-4737-8737-737373737373",
      mockMode: false,
      tenantId: "74747474-7474-4747-8747-747474747474"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets.map((asset) => asset.name)).toEqual([
      "assetnote/live.edge.assetnote.example.com"
    ]);
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "AttackSurfaceAssetObserved",
        "ExternalServiceObservation",
        "ExternalExposure",
        "HighAttackSurfaceRisk",
        "CveObserved"
      ])
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(liveResult)).not.toContain("assetnote-api-token");
  });

  it("runs Axonius read-only CAASM asset sync", async () => {
    const connector = getConnectorByKey("axonius");

    expect(connector).toBeDefined();
    expect(connector!.manifest).toMatchObject({
      availability: "Beta",
      connectable: true,
      marketplaceCategory: "VM/EAP/ASM/CNAPP",
      product: "CAASM",
      vendor: "Axonius"
    });
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiKeySecret"]));
    expect(connector!.manifest.requiredPermissions).toEqual(
      expect.arrayContaining(["assets:read", "devices:read"])
    );

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "axonius",
        mockMode: true
      },
      integrationId: "75757575-7575-4757-8757-757575757575",
      mockMode: true,
      tenantId: "76767676-7676-4767-8767-767676767676"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets[0]?.assetType).toBe("CloudResource");
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "CaasmAssetObserved",
        "CaasmAdapterCoverage",
        "CoverageGapObserved",
        "InternetExposure",
        "HighCaasmRisk",
        "CveObserved"
      ])
    );

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        const headers = init?.headers as Record<string, string> | undefined;

        expect(init?.method ?? "GET").toBe("GET");
        expect(url).toBe(
          "https://api.axonius.example.test/api/devices?limit=10"
        );
        expect(headers?.["api-key"]).toBe("axonius-api-key");
        expect(headers?.["api-secret"]).toBe("axonius-api-secret");
        expect(url).not.toMatch(
          /\/(?:queries?|enforcements?|actions?|devices\/[^/]+\/(?:update|delete|remediate)|adapters?|settings|users)(\/|\?|$)/iu
        );

        return new Response(
          JSON.stringify({
            devices: [
              {
                adapters: ["aws", "crowdstrike"],
                asset_id: "axonius-live-edge",
                cves: ["CVE-2026-84848"],
                hostname: "axonius-live-edge-01.example.com",
                internet_exposed: true,
                ip_addresses: ["198.51.100.84"],
                last_seen: "2026-06-04T12:00:00.000Z",
                missing_controls: ["edr_policy"],
                os: "Linux",
                risk_level: "high",
                type: "device"
              }
            ]
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "apiKeySecret",
      config: {
        apiBaseUrl: "https://api.axonius.example.test",
        apiKey: "axonius-api-key",
        apiSecret: "axonius-api-secret",
        assetLimit: 10,
        assetsPath: "/api/devices",
        connectorKey: "axonius"
      },
      integrationId: "77777777-7777-4777-8777-777777777777",
      mockMode: false,
      tenantId: "78787878-7878-4787-8787-787878787878"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets.map((asset) => asset.name)).toEqual([
      "axonius/axonius-live-edge-01.example.com"
    ]);
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "CaasmAssetObserved",
        "CaasmAdapterCoverage",
        "CoverageGapObserved",
        "InternetExposure",
        "HighCaasmRisk",
        "CveObserved"
      ])
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(liveResult)).not.toContain("axonius-api-key");
    expect(JSON.stringify(liveResult)).not.toContain("axonius-api-secret");
  });

  it("runs Armis read-only asset and exposure sync", async () => {
    const connector = getConnectorByKey("armis");

    expect(connector).toBeDefined();
    expect(connector!.manifest).toMatchObject({
      availability: "Beta",
      connectable: true,
      marketplaceCategory: "VM/EAP/ASM/CNAPP",
      product: "Armis",
      vendor: "Armis"
    });
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiToken"]));
    expect(connector!.manifest.requiredPermissions).toEqual(
      expect.arrayContaining(["assets:read", "devices:read"])
    );

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "armis",
        mockMode: true
      },
      integrationId: "79797979-7979-4797-8797-797979797979",
      mockMode: true,
      tenantId: "80808080-8080-4808-8808-808080808080"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets[0]?.assetType).toBe("Host");
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "AssetInventoryObserved",
        "UnmanagedAssetObserved",
        "InternetExposure",
        "CoverageGapObserved",
        "CveObserved"
      ])
    );

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        const headers = init?.headers as Record<string, string> | undefined;

        expect(init?.method ?? "GET").toBe("GET");
        expect(url).toBe(
          "https://api.armis.example.test/api/v1/devices?limit=10"
        );
        expect(headers?.authorization).toBe("Bearer armis-api-token");
        expect(url).not.toMatch(
          /\/(?:enforcements?|quarantine|polic(?:y|ies)|devices\/[^/]+\/(?:update|delete|remediate)|assets\/[^/]+\/(?:update|delete|remediate)|remediation|integrations?|settings|users)(\/|\?|$)/iu
        );

        return new Response(
          JSON.stringify({
            devices: [
              {
                cves: ["CVE-2026-85858"],
                hostname: "armis-live-edge-01.example.com",
                id: "armis-live-device",
                internet_exposed: true,
                ip_addresses: ["198.51.100.85"],
                last_seen: "2026-06-04T12:00:00.000Z",
                missing_controls: ["edr"],
                risk_level: "high",
                type: "device",
                unmanaged: true
              }
            ]
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "apiToken",
      config: {
        apiBaseUrl: "https://api.armis.example.test",
        apiToken: "armis-api-token",
        assetLimit: 10,
        assetsPath: "/api/v1/devices",
        connectorKey: "armis"
      },
      integrationId: "81818181-8181-4818-8818-818181818181",
      mockMode: false,
      tenantId: "82828282-8282-4828-8828-828282828282"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets.map((asset) => asset.name)).toEqual([
      "armis/armis-live-edge-01.example.com"
    ]);
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "AssetInventoryObserved",
        "UnmanagedAssetObserved",
        "InternetExposure",
        "CoverageGapObserved",
        "HighAssetRisk",
        "CveObserved"
      ])
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(liveResult)).not.toContain("armis-api-token");
  });

  it("runs Cortex Xpanse read-only external attack surface sync", async () => {
    const connector = getConnectorByKey("cortex-xpanse");

    expect(connector).toBeDefined();
    expect(connector!.manifest).toMatchObject({
      availability: "Beta",
      connectable: true,
      marketplaceCategory: "VM/EAP/ASM/CNAPP",
      product: "Cortex Xpanse",
      vendor: "Palo Alto Networks"
    });
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiToken"]));
    expect(connector!.manifest.requiredPermissions).toEqual(
      expect.arrayContaining(["assets:read", "exposures:read"])
    );

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "cortex-xpanse",
        mockMode: true
      },
      integrationId: "83838383-8383-4838-8838-838383838383",
      mockMode: true,
      tenantId: "84848484-8484-4848-8848-848484848484"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets[0]?.assetType).toBe("Service");
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "AttackSurfaceAssetObserved",
        "ExternalServiceObservation",
        "ExternalExposure",
        "HighAttackSurfaceRisk",
        "CveObserved"
      ])
    );

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        const headers = init?.headers as Record<string, string> | undefined;

        expect(init?.method ?? "GET").toBe("GET");
        expect(url).toBe(
          "https://api-cortex.paloaltonetworks.example.test/public_api/v1/assets?limit=10"
        );
        expect(headers?.authorization).toBe("Bearer cortex-xpanse-token");
        expect(url).not.toMatch(
          /\/(?:scans?|assets\/[^/]+\/(?:update|delete|remediate)|exceptions?|remediation|polic(?:y|ies)|incidents?|integrations?|settings)(\/|\?|$)/iu
        );

        return new Response(
          JSON.stringify({
            assets: [
              {
                asset_id: "xpanse-live-service",
                cves: ["CVE-2026-86868"],
                domain: "api.xpanse-demo.example.com",
                ip: "198.51.100.86",
                last_seen: "2026-06-04T12:00:00.000Z",
                ports: [443],
                risk_level: "high",
                technologies: ["nginx"],
                type: "service"
              }
            ]
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "apiToken",
      config: {
        apiBaseUrl: "https://api-cortex.paloaltonetworks.example.test",
        apiToken: "cortex-xpanse-token",
        assetLimit: 10,
        assetsPath: "/public_api/v1/assets",
        connectorKey: "cortex-xpanse"
      },
      integrationId: "85858585-8585-4858-8858-858585858585",
      mockMode: false,
      tenantId: "86868686-8686-4868-8868-868686868686"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets.map((asset) => asset.name)).toEqual([
      "cortex-xpanse/api.xpanse-demo.example.com"
    ]);
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "AttackSurfaceAssetObserved",
        "ExternalServiceObservation",
        "ExternalExposure",
        "HighAttackSurfaceRisk",
        "CveObserved"
      ])
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(liveResult)).not.toContain("cortex-xpanse-token");
  });

  it("runs AbuseIPDB read-only IP reputation checks", async () => {
    const connector = getConnectorByKey("abuseipdb");

    expect(connector).toBeDefined();
    expect(connector!.manifest).toMatchObject({
      availability: "Beta",
      connectable: true,
      marketplaceCategory: "Threat Intelligence",
      product: "AbuseIPDB",
      vendor: "AbuseIPDB"
    });
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiToken"]));
    expect(connector!.manifest.requiredPermissions).toEqual(
      expect.arrayContaining(["check:read"])
    );

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "abuseipdb",
        mockMode: true
      },
      integrationId: "71717171-7171-4717-8717-717171717171",
      mockMode: true,
      tenantId: "72727272-7272-4727-8727-727272727272"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets).toEqual([]);
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "ThreatIntelObservation",
        "HighConfidenceMaliciousIp"
      ])
    );

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        void init;
        const url = String(input);

        if (
          url ===
          "https://api.abuseipdb.example/api/v2/check?ipAddress=203.0.113.44&maxAgeInDays=90"
        ) {
          return new Response(
            JSON.stringify({
              data: {
                abuseConfidenceScore: 88,
                countryCode: "US",
                domain: "example-hosting.invalid",
                hostnames: ["scanner.example.invalid"],
                ipAddress: "203.0.113.44",
                ipVersion: 4,
                isPublic: true,
                isWhitelisted: false,
                lastReportedAt: "2026-06-01T00:00:00Z",
                numDistinctUsers: 12,
                totalReports: 31,
                usageType: "Data Center/Web Hosting/Transit"
              }
            }),
            {
              status: 200
            }
          );
        }

        return new Response("not found", {
          status: 404
        });
      }
    );

    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "apiToken",
      config: {
        apiBaseUrl: "https://api.abuseipdb.example/api/v2",
        apiKey: "abuseipdb-api-key",
        connectorKey: "abuseipdb",
        ipAddresses: ["203.0.113.44"],
        maxAgeInDays: 90,
        queryLimit: 1
      },
      integrationId: "73737373-7373-4737-8737-737373737373",
      mockMode: false,
      tenantId: "74747474-7474-4747-8747-747474747474"
    });
    const requestedUrls = fetchMock.mock.calls.map((call) => String(call[0]));
    const requestedMethods = fetchMock.mock.calls.map(
      (call) => call[1]?.method ?? "GET"
    );

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets).toEqual([]);
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "ThreatIntelObservation",
        "HighConfidenceMaliciousIp"
      ])
    );
    expect(requestedUrls).toEqual([
      "https://api.abuseipdb.example/api/v2/check?ipAddress=203.0.113.44&maxAgeInDays=90"
    ]);
    expect(requestedMethods).toEqual(["GET"]);
    expect(
      requestedUrls.some((url) =>
        /\/(?:report|clear-address|blacklist|bulk-report)\b/u.test(url)
      )
    ).toBe(false);
    expect(JSON.stringify(liveResult)).not.toContain("abuseipdb-api-key");
  });

  it("runs VirusTotal read-only IoC reputation searches", async () => {
    const connector = getConnectorByKey("virus-total");

    expect(connector).toBeDefined();
    expect(connector!.manifest).toMatchObject({
      availability: "Beta",
      connectable: true,
      marketplaceCategory: "Threat Intelligence",
      product: "VirusTotal",
      vendor: "Google"
    });
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiToken"]));
    expect(connector!.manifest.requiredPermissions).toEqual(
      expect.arrayContaining(["search:read"])
    );

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "virus-total",
        mockMode: true
      },
      integrationId: "75757575-7575-4757-8757-757575757575",
      mockMode: true,
      tenantId: "76767676-7676-4767-8767-767676767676"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets).toEqual([]);
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "ThreatIntelObservation",
        "HighConfidenceMaliciousIndicator",
        "SuspiciousIndicatorReputation"
      ])
    );

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        void init;
        const url = String(input);

        if (
          url ===
          "https://www.virustotal.example/api/v3/search?query=203.0.113.44"
        ) {
          return new Response(
            JSON.stringify({
              data: [
                {
                  attributes: {
                    last_analysis_stats: {
                      harmless: 20,
                      malicious: 11,
                      suspicious: 1,
                      undetected: 55
                    },
                    reputation: -30
                  },
                  id: "203.0.113.44",
                  type: "ip_address"
                }
              ]
            }),
            {
              status: 200
            }
          );
        }

        if (
          url ===
          "https://www.virustotal.example/api/v3/search?query=example-malware.invalid"
        ) {
          return new Response(
            JSON.stringify({
              data: [
                {
                  attributes: {
                    last_analysis_stats: {
                      harmless: 50,
                      malicious: 2,
                      suspicious: 1,
                      undetected: 42
                    },
                    reputation: -4
                  },
                  id: "example-malware.invalid",
                  type: "domain"
                }
              ]
            }),
            {
              status: 200
            }
          );
        }

        return new Response("not found", {
          status: 404
        });
      }
    );

    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "apiToken",
      config: {
        apiBaseUrl: "https://www.virustotal.example/api/v3",
        apiKey: "virustotal-api-key",
        connectorKey: "virus-total",
        indicators: ["203.0.113.44", "example-malware.invalid"],
        queryLimit: 2
      },
      integrationId: "77777777-7777-4777-8777-777777777777",
      mockMode: false,
      tenantId: "78787878-7878-4787-8787-787878787878"
    });
    const requestedUrls = fetchMock.mock.calls.map((call) => String(call[0]));
    const requestedMethods = fetchMock.mock.calls.map(
      (call) => call[1]?.method ?? "GET"
    );

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets).toEqual([]);
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "ThreatIntelObservation",
        "HighConfidenceMaliciousIndicator",
        "SuspiciousIndicatorReputation"
      ])
    );
    expect(requestedUrls).toEqual([
      "https://www.virustotal.example/api/v3/search?query=203.0.113.44",
      "https://www.virustotal.example/api/v3/search?query=example-malware.invalid"
    ]);
    expect(requestedMethods).toEqual(["GET", "GET"]);
    expect(
      requestedUrls.some((url) =>
        /\/(?:files|urls|comments|votes|analyses|download|upload_url)\b/u.test(
          url
        )
      )
    ).toBe(false);
    expect(JSON.stringify(liveResult)).not.toContain("virustotal-api-key");
  });

  it("runs GreyNoise read-only community IP context lookups", async () => {
    const connector = getConnectorByKey("greynoise");

    expect(connector).toBeDefined();
    expect(connector!.manifest).toMatchObject({
      availability: "Beta",
      connectable: true,
      marketplaceCategory: "Threat Intelligence",
      product: "GreyNoise",
      vendor: "GreyNoise"
    });
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiToken"]));
    expect(connector!.manifest.requiredPermissions).toEqual(
      expect.arrayContaining(["community:ip:read"])
    );

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "greynoise",
        mockMode: true
      },
      integrationId: "79797979-7979-4797-8797-797979797979",
      mockMode: true,
      tenantId: "80808080-8080-4808-8808-808080808080"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets).toEqual([]);
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "ThreatIntelObservation",
        "MaliciousInternetScanner",
        "BenignRiotService"
      ])
    );

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        void init;
        const url = String(input);

        if (url === "https://api.greynoise.example/v3/community/203.0.113.44") {
          return new Response(
            JSON.stringify({
              classification: "malicious",
              ip: "203.0.113.44",
              last_seen: "2026-06-01",
              link: "https://viz.greynoise.io/ip/203.0.113.44",
              message: "Success",
              name: "Live Scanner",
              noise: true,
              riot: false
            }),
            {
              status: 200
            }
          );
        }

        if (
          url === "https://api.greynoise.example/v3/community/198.51.100.22"
        ) {
          return new Response(
            JSON.stringify({
              classification: "benign",
              ip: "198.51.100.22",
              last_seen: "2026-06-01",
              link: "https://viz.greynoise.io/riot/198.51.100.22",
              message: "Success",
              name: "Known CDN",
              noise: false,
              riot: true
            }),
            {
              status: 200
            }
          );
        }

        return new Response("not found", {
          status: 404
        });
      }
    );

    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "apiToken",
      config: {
        apiBaseUrl: "https://api.greynoise.example/v3/community",
        apiKey: "greynoise-api-key",
        connectorKey: "greynoise",
        ipAddresses: ["203.0.113.44", "198.51.100.22"],
        queryLimit: 2
      },
      integrationId: "81818181-8181-4818-8818-818181818181",
      mockMode: false,
      tenantId: "82828282-8282-4828-8828-828282828282"
    });
    const requestedUrls = fetchMock.mock.calls.map((call) => String(call[0]));
    const requestedMethods = fetchMock.mock.calls.map(
      (call) => call[1]?.method ?? "GET"
    );

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets).toEqual([]);
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "ThreatIntelObservation",
        "MaliciousInternetScanner",
        "BenignRiotService"
      ])
    );
    expect(requestedUrls).toEqual([
      "https://api.greynoise.example/v3/community/203.0.113.44",
      "https://api.greynoise.example/v3/community/198.51.100.22"
    ]);
    expect(requestedMethods).toEqual(["GET", "GET"]);
    expect(
      requestedUrls.some((url) =>
        /\/(?:gnql|alerts?|tags?|ip\/?$|multi|riot|noise)\b/u.test(url)
      )
    ).toBe(false);
    expect(JSON.stringify(liveResult)).not.toContain("greynoise-api-key");
  });

  it("runs AlienVault OTX read-only indicator detail lookups", async () => {
    const connector = getConnectorByKey("alienvault-otx");

    expect(connector).toBeDefined();
    expect(connector!.manifest).toMatchObject({
      availability: "Beta",
      connectable: true,
      marketplaceCategory: "Threat Intelligence",
      product: "Open Threat Exchange",
      vendor: "AlienVault"
    });
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiToken"]));
    expect(connector!.manifest.requiredPermissions).toEqual(
      expect.arrayContaining(["indicator:general:read"])
    );

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "alienvault-otx",
        mockMode: true
      },
      integrationId: "83838383-8383-4838-8838-838383838383",
      mockMode: true,
      tenantId: "84848484-8484-4848-8848-848484848484"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets).toEqual([]);
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "ThreatIntelObservation",
        "HighConfidenceMaliciousIndicator",
        "OtxPulseAssociation"
      ])
    );

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        void init;
        const url = String(input);

        if (
          url ===
          "https://otx.example/api/v1/indicators/IPv4/203.0.113.44/general"
        ) {
          return new Response(
            JSON.stringify({
              indicator: "203.0.113.44",
              pulse_info: {
                count: 4,
                pulses: [
                  {
                    created: "2026-06-01T00:00:00Z",
                    id: "otx-live-pulse-1",
                    modified: "2026-06-02T00:00:00Z",
                    name: "Live malicious scanner",
                    tags: ["scanner"]
                  }
                ]
              },
              reputation: -15,
              sections: ["general", "reputation"],
              type: "IPv4"
            }),
            {
              status: 200
            }
          );
        }

        if (
          url ===
          "https://otx.example/api/v1/indicators/domain/example-malware.invalid/general"
        ) {
          return new Response(
            JSON.stringify({
              indicator: "example-malware.invalid",
              pulse_info: {
                count: 1,
                pulses: [
                  {
                    created: "2026-06-01T00:00:00Z",
                    id: "otx-live-pulse-2",
                    modified: "2026-06-01T12:00:00Z",
                    name: "Live phishing infrastructure",
                    tags: ["phishing"]
                  }
                ]
              },
              reputation: null,
              sections: ["general"],
              type: "domain"
            }),
            {
              status: 200
            }
          );
        }

        return new Response("not found", {
          status: 404
        });
      }
    );

    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "apiToken",
      config: {
        apiBaseUrl: "https://otx.example/api/v1",
        apiKey: "alienvault-otx-api-key",
        connectorKey: "alienvault-otx",
        indicators: ["203.0.113.44", "example-malware.invalid"],
        queryLimit: 2
      },
      integrationId: "85858585-8585-4858-8858-858585858585",
      mockMode: false,
      tenantId: "86868686-8686-4868-8868-868686868686"
    });
    const requestedUrls = fetchMock.mock.calls.map((call) => String(call[0]));
    const requestedMethods = fetchMock.mock.calls.map(
      (call) => call[1]?.method ?? "GET"
    );

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets).toEqual([]);
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "ThreatIntelObservation",
        "HighConfidenceMaliciousIndicator",
        "OtxPulseAssociation"
      ])
    );
    expect(requestedUrls).toEqual([
      "https://otx.example/api/v1/indicators/IPv4/203.0.113.44/general",
      "https://otx.example/api/v1/indicators/domain/example-malware.invalid/general"
    ]);
    expect(requestedMethods).toEqual(["GET", "GET"]);
    expect(
      requestedUrls.some((url) =>
        /\/(?:pulses?|subscribe|unsubscribe|export|search|users?|follow|indicators\/export)\b/u.test(
          url
        )
      )
    ).toBe(false);
    expect(JSON.stringify(liveResult)).not.toContain("alienvault-otx-api-key");
  });

  it("runs Recorded Future read-only vulnerability and entity enrichment", async () => {
    const connector = getConnectorByKey("recorded-future");

    expect(connector).toBeDefined();
    expect(connector!.manifest).toMatchObject({
      availability: "Beta",
      connectable: true,
      marketplaceCategory: "Threat Intelligence",
      product: "Recorded Future",
      vendor: "Recorded Future"
    });
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiToken"]));
    expect(connector!.manifest.requiredPermissions).toEqual(
      expect.arrayContaining(["vulnerability:search:read", "entity-match:read"])
    );

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "recorded-future",
        mockMode: true
      },
      integrationId: "87878787-8787-4878-8878-878787878787",
      mockMode: true,
      tenantId: "88888888-8888-4888-8888-888888888888"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets).toEqual([]);
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "ThreatIntelObservation",
        "HighRiskVulnerability",
        "ElevatedCveRisk",
        "RecordedFutureEntityMatch"
      ])
    );

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);

        if (
          url ===
          "https://api.recordedfuture.example/v2/vulnerability/search?freetext=CVE-2026-12345&fields=risk&metadata=false&limit=1"
        ) {
          return new Response(
            JSON.stringify({
              data: [
                {
                  entity: {
                    id: "rf-live-vuln-1",
                    name: "CVE-2026-12345"
                  },
                  id: "rf-live-vuln-1",
                  risk: {
                    score: 91
                  }
                }
              ]
            }),
            {
              status: 200
            }
          );
        }

        if (
          url === "https://api.recordedfuture.example/entity-match/match" &&
          init?.method === "POST"
        ) {
          expect(JSON.parse(String(init.body))).toEqual({
            limit: 5,
            name: "Fancy Bear"
          });

          return new Response(
            JSON.stringify({
              data: [
                {
                  entity: {
                    id: "rf-live-actor-1",
                    name: "Fancy Bear",
                    type: "Threat Actor"
                  }
                }
              ]
            }),
            {
              status: 200
            }
          );
        }

        return new Response("not found", {
          status: 404
        });
      }
    );

    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "apiToken",
      config: {
        apiBaseUrl: "https://api.recordedfuture.example",
        apiToken: "recorded-future-api-token",
        connectorKey: "recorded-future",
        cveIds: ["CVE-2026-12345"],
        entityNames: ["Fancy Bear"],
        queryLimit: 2
      },
      integrationId: "89898989-8989-4898-8898-898989898989",
      mockMode: false,
      tenantId: "90909090-9090-4909-8909-909090909090"
    });
    const requestedUrls = fetchMock.mock.calls.map((call) => String(call[0]));
    const requestedMethods = fetchMock.mock.calls.map(
      (call) => call[1]?.method ?? "GET"
    );

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets).toEqual([]);
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "ThreatIntelObservation",
        "HighRiskVulnerability",
        "RecordedFutureEntityMatch"
      ])
    );
    expect(requestedUrls).toEqual([
      "https://api.recordedfuture.example/v2/vulnerability/search?freetext=CVE-2026-12345&fields=risk&metadata=false&limit=1",
      "https://api.recordedfuture.example/entity-match/match"
    ]);
    expect(requestedMethods).toEqual(["GET", "POST"]);
    expect(
      requestedUrls.some((url) =>
        /\/(?:list|alert|playbook-alert|export|feeds?|watchlists?|subscribe|bulk)\b/u.test(
          url
        )
      )
    ).toBe(false);
    expect(JSON.stringify(liveResult)).not.toContain(
      "recorded-future-api-token"
    );
  });

  it("runs Mandiant Advantage read-only indicator, vulnerability, and actor enrichment", async () => {
    const connector = getConnectorByKey("mandiant-advantage");

    expect(connector).toBeDefined();
    expect(connector!.manifest).toMatchObject({
      availability: "Beta",
      connectable: true,
      marketplaceCategory: "Threat Intelligence",
      product: "Mandiant Advantage",
      vendor: "Google"
    });
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "keySecret"]));
    expect(connector!.manifest.requiredPermissions).toEqual(
      expect.arrayContaining([
        "indicator:read",
        "vulnerability:read",
        "threat-actor:read"
      ])
    );

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "mandiant-advantage",
        mockMode: true
      },
      integrationId: "91919191-9191-4919-8919-919191919191",
      mockMode: true,
      tenantId: "92929292-9292-4929-8929-929292929292"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets).toEqual([]);
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "ThreatIntelObservation",
        "HighMandiantMScore",
        "ElevatedMandiantMScore",
        "MandiantAttributedAssociation",
        "MandiantExploitationObserved",
        "MandiantThreatActorContext"
      ])
    );

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);

        expect(init?.headers).toMatchObject({
          accept: "application/json"
        });

        if (
          url ===
          "https://api.mandiant.example/v4/indicator?value=203.0.113.44&minimum_mscore=40"
        ) {
          return new Response(
            JSON.stringify({
              indicators: [
                {
                  attributed_associations: [
                    {
                      id: "threat-actor--live",
                      name: "Live Threat Actor",
                      type: "threat-actor"
                    }
                  ],
                  first_seen: "2026-05-01T00:00:00Z",
                  id: "ipv4--live",
                  last_seen: "2026-06-01T00:00:00Z",
                  mscore: 83,
                  type: "ipv4",
                  value: "203.0.113.44",
                  verdict_simple: "malicious"
                }
              ]
            }),
            {
              status: 200
            }
          );
        }

        if (
          url === "https://api.mandiant.example/v4/vulnerability/CVE-2026-12345"
        ) {
          return new Response(
            JSON.stringify({
              vulnerability: [
                {
                  cve: [
                    {
                      id: "CVE-2026-12345",
                      name: "CVE-2026-12345"
                    }
                  ],
                  exploitation_state: "Exploited in the Wild",
                  id: "vulnerability--live",
                  name: "CVE-2026-12345",
                  risk_rating: "Critical",
                  threat_rating: {
                    threat_score: 90
                  }
                }
              ]
            }),
            {
              status: 200
            }
          );
        }

        if (url === "https://api.mandiant.example/v4/actor/UNC3782") {
          return new Response(
            JSON.stringify({
              "threat-actors": [
                {
                  aliases: ["Live Intrusion Set"],
                  id: "threat-actor--unc3782",
                  name: "UNC3782",
                  primary_motivation: "Espionage",
                  type: "threat-actor"
                }
              ]
            }),
            {
              status: 200
            }
          );
        }

        return new Response("not found", {
          status: 404
        });
      }
    );

    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "keySecret",
      config: {
        actorNames: ["UNC3782"],
        apiBaseUrl: "https://api.mandiant.example",
        connectorKey: "mandiant-advantage",
        cveIds: ["CVE-2026-12345"],
        indicators: ["203.0.113.44"],
        minimumMscore: 40,
        privateKey: "mandiant-private-key",
        publicKey: "mandiant-public-key",
        queryLimit: 3
      },
      integrationId: "93939393-9393-4939-8939-939393939393",
      mockMode: false,
      tenantId: "94949494-9494-4949-8949-949494949494"
    });
    const requestedUrls = fetchMock.mock.calls.map((call) => String(call[0]));
    const requestedMethods = fetchMock.mock.calls.map(
      (call) => call[1]?.method ?? "GET"
    );

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets).toEqual([]);
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "ThreatIntelObservation",
        "HighMandiantMScore",
        "MandiantAttributedAssociation",
        "MandiantExploitationObserved",
        "MandiantThreatActorContext"
      ])
    );
    expect(requestedUrls).toEqual([
      "https://api.mandiant.example/v4/indicator?value=203.0.113.44&minimum_mscore=40",
      "https://api.mandiant.example/v4/vulnerability/CVE-2026-12345",
      "https://api.mandiant.example/v4/actor/UNC3782"
    ]);
    expect(requestedMethods).toEqual(["GET", "GET", "GET"]);
    expect(
      requestedUrls.some((url) =>
        /\/(?:feed|feeds|collections?|reports?|exports?|submit|publish|watchlists?)\b/u.test(
          url
        )
      )
    ).toBe(false);
    expect(JSON.stringify(liveResult)).not.toContain("mandiant-private-key");
    expect(JSON.stringify(liveResult)).not.toContain("mandiant-public-key");
  });

  it("runs Okta read-only identity inventory sync", async () => {
    const connector = getConnectorByKey("okta");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiToken"]));

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "okta",
        mockMode: true
      },
      integrationId: "56565656-5656-4565-8565-565656565656",
      mockMode: true,
      tenantId: "67676767-6767-4676-8676-676767676767"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets.map((asset) => asset.assetType)).toEqual(
      expect.arrayContaining(["IdentityStore", "Application"])
    );
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "IdentityStore",
        "PrivilegedIdentity",
        "MFAEnabled",
        "MFADisabled",
        "PrivilegedGroup",
        "SaaSApplication"
      ])
    );

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);

        expect(init?.method ?? "GET").toBe("GET");
        expect(
          (init?.headers as Record<string, string> | undefined)?.authorization
        ).toBe("SSWS okta-secret-token");

        if (url.endsWith("/api/v1/users/me")) {
          return new Response(
            JSON.stringify({
              id: "00u-me",
              profile: {
                login: "security@example.com"
              }
            })
          );
        }

        if (url.endsWith("/api/v1/users?limit=200")) {
          return new Response(
            JSON.stringify([
              {
                id: "00u1",
                profile: {
                  displayName: "Security Admin",
                  email: "security-admin@example.com",
                  login: "security-admin@example.com"
                },
                status: "ACTIVE"
              },
              {
                id: "00u2",
                profile: {
                  displayName: "Build Bot",
                  email: "build-bot@example.com",
                  login: "build-bot@example.com"
                },
                status: "ACTIVE"
              }
            ])
          );
        }

        if (url.endsWith("/api/v1/groups?limit=200")) {
          return new Response(
            JSON.stringify([
              {
                id: "00g1",
                profile: {
                  name: "Okta Administrators"
                },
                type: "OKTA_GROUP"
              }
            ])
          );
        }

        if (url.endsWith("/api/v1/apps?limit=200")) {
          return new Response(
            JSON.stringify([
              {
                id: "0oa1",
                label: "Production Console",
                name: "prod-console",
                signOnMode: "SAML_2_0",
                status: "ACTIVE"
              }
            ])
          );
        }

        if (url.endsWith("/api/v1/users/00u1/factors")) {
          return new Response(
            JSON.stringify([
              {
                factorType: "token:software:totp",
                id: "opf1",
                provider: "OKTA",
                status: "ACTIVE"
              }
            ])
          );
        }

        if (url.endsWith("/api/v1/users/00u2/factors")) {
          return new Response(JSON.stringify([]));
        }

        return new Response(JSON.stringify({ error: "not found" }), {
          status: 404
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "apiToken",
      config: {
        apiToken: "okta-secret-token",
        connectorKey: "okta",
        orgUrl: "https://periscan.okta.com"
      },
      integrationId: "78787878-7878-4787-8787-787878787878",
      mockMode: false,
      tenantId: "89898989-8989-4989-8989-898989898989"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets.map((asset) => asset.assetType)).toEqual(
      expect.arrayContaining(["IdentityStore", "Application"])
    );
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "IdentityStore",
        "PrivilegedIdentity",
        "MFAEnabled",
        "MFADisabled",
        "PrivilegedGroup",
        "SaaSApplication"
      ])
    );
    expect(fetchMock).toHaveBeenCalled();
    expect(JSON.stringify(liveResult)).not.toContain("okta-secret-token");
  });

  it("runs Cisco Duo signed read-only Admin API inventory sync", async () => {
    const connector = getConnectorByKey("duo");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "adminApi"]));

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "duo",
        mockMode: true
      },
      integrationId: "68686868-6868-4686-8686-686868686868",
      mockMode: true,
      tenantId: "69696969-6969-4696-8696-696969696969"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets.map((asset) => asset.assetType)).toEqual(
      expect.arrayContaining(["IdentityStore", "Application"])
    );
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "IdentityStore",
        "PrivilegedIdentity",
        "MFAEnabled",
        "MFADisabled",
        "PrivilegedGroup",
        "DuoDeviceActivated",
        "DuoProtectedApplication"
      ])
    );

    const requested = new Array<{
      bodyPresent: boolean;
      method: string;
      pathname: string;
      url: string;
    }>();
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input));
        const headers = init?.headers as Record<string, string> | undefined;

        requested.push({
          bodyPresent: init?.body !== undefined,
          method: init?.method ?? "GET",
          pathname: url.pathname,
          url: url.toString()
        });

        expect(url.origin).toBe("https://api-test.duosecurity.com");
        expect(init?.method ?? "GET").toBe("GET");
        expect(init?.body).toBeUndefined();
        expect(headers?.authorization).toMatch(/^Basic /u);
        expect(headers?.date).toBeTruthy();

        if (url.pathname === "/admin/v1/users") {
          return new Response(
            JSON.stringify({
              response: [
                {
                  groups: [{ name: "Duo Administrators" }],
                  is_enrolled: true,
                  phones: [
                    {
                      number: "+15551234567",
                      phone_id: "DPHONE1"
                    }
                  ],
                  realname: "Security Admin",
                  status: "active",
                  user_id: "DUUSER1",
                  username: "security-admin@example.com"
                },
                {
                  groups: [{ name: "Engineering" }],
                  is_enrolled: false,
                  phones: [],
                  realname: "Build Bot",
                  status: "active",
                  user_id: "DUUSER2",
                  username: "build-bot@example.com"
                }
              ],
              stat: "OK"
            })
          );
        }

        if (url.pathname === "/admin/v1/groups") {
          return new Response(
            JSON.stringify({
              response: [
                {
                  group_id: "DGROUP1",
                  name: "Duo Administrators",
                  users: [{ user_id: "DUUSER1" }]
                }
              ],
              stat: "OK"
            })
          );
        }

        if (url.pathname === "/admin/v1/phones") {
          return new Response(
            JSON.stringify({
              response: [
                {
                  activated: true,
                  number: "+15551234567",
                  phone_id: "DPHONE1",
                  platform: "Android",
                  type: "mobile",
                  users: [{ user_id: "DUUSER1" }]
                }
              ],
              stat: "OK"
            })
          );
        }

        if (url.pathname === "/admin/v1/integrations") {
          return new Response(
            JSON.stringify({
              response: [
                {
                  integration_key: "DIXXXXXXXXXXXXXXXXXX",
                  name: "AWS Console",
                  status: "active",
                  type: "saml"
                }
              ],
              stat: "OK"
            })
          );
        }

        return new Response(
          JSON.stringify({ message: "not found", stat: "FAIL" }),
          {
            status: 404
          }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "adminApi",
      config: {
        apiHostname: "api-test.duosecurity.com",
        connectorKey: "duo",
        includeGroups: true,
        includeIntegrations: true,
        includePhones: true,
        integrationKey: "DIXXXXXXXXXXXXXXXXXX",
        limit: 100,
        secretKey: "duo-secret-key"
      },
      integrationId: "70707070-7070-4707-8707-707070707070",
      mockMode: false,
      tenantId: "71717171-7171-4717-8717-717171717171"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets.map((asset) => asset.assetType)).toEqual(
      expect.arrayContaining(["IdentityStore", "Application"])
    );
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "IdentityStore",
        "PrivilegedIdentity",
        "MFAEnabled",
        "MFADisabled",
        "PrivilegedGroup",
        "DuoDeviceActivated",
        "DuoProtectedApplication"
      ])
    );
    expect(requested.map((request) => request.pathname)).toEqual(
      expect.arrayContaining([
        "/admin/v1/users",
        "/admin/v1/groups",
        "/admin/v1/phones",
        "/admin/v1/integrations"
      ])
    );
    expect(requested.every((request) => request.method === "GET")).toBe(true);
    expect(requested.every((request) => !request.bodyPresent)).toBe(true);
    expect(
      requested.some((request) =>
        /(?:bypass|policy|auth|enroll|activate|delete|create|update)/iu.test(
          request.url
        )
      )
    ).toBe(false);
    expect(JSON.stringify(liveResult)).not.toContain("duo-secret-key");
    expect(JSON.stringify(liveResult)).not.toContain("DIXXXXXXXXXXXXXXXXXX");
    expect(JSON.stringify(liveResult)).not.toContain(
      "security-admin@example.com"
    );
    expect(JSON.stringify(liveResult)).not.toContain("+15551234567");
  });

  it("runs OneLogin OAuth read-only identity inventory sync", async () => {
    const connector = getConnectorByKey("onelogin");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "oauth2ClientCredentials"]));

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "onelogin",
        mockMode: true
      },
      integrationId: "72727272-7272-4727-8727-727272727272",
      mockMode: true,
      tenantId: "73737373-7373-4737-8737-737373737373"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets.map((asset) => asset.assetType)).toEqual(
      expect.arrayContaining(["IdentityStore", "Application"])
    );
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "IdentityStore",
        "PrivilegedIdentity",
        "MFAEnabled",
        "MFAUnknown",
        "PrivilegedRole",
        "SaaSApplication"
      ])
    );

    const requested = new Array<{
      bodyPresent: boolean;
      method: string;
      pathname: string;
      url: string;
    }>();
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input));
        const headers = init?.headers as Record<string, string> | undefined;

        requested.push({
          bodyPresent: init?.body !== undefined,
          method: init?.method ?? "GET",
          pathname: url.pathname,
          url: url.toString()
        });

        expect(url.origin).toBe("https://acme.onelogin.com");

        if (url.pathname === "/auth/oauth2/v2/token") {
          expect(init?.method).toBe("POST");
          expect(headers?.authorization).toMatch(/^Basic /u);
          expect(headers?.["content-type"]).toBe("application/json");
          expect(String(init?.body)).toContain("client_credentials");

          return new Response(
            JSON.stringify({
              access_token: "onelogin-access-token",
              expires_in: 36_000,
              token_type: "bearer"
            })
          );
        }

        expect(init?.method ?? "GET").toBe("GET");
        expect(init?.body).toBeUndefined();
        expect(headers?.authorization).toBe("Bearer onelogin-access-token");

        if (url.pathname === "/api/2/users") {
          return new Response(
            JSON.stringify([
              {
                email: "security-admin@example.com",
                firstname: "Security",
                id: 1001,
                lastname: "Admin",
                otp_device_id: 44,
                role_ids: [2001],
                state: 1,
                status: 1,
                username: "security-admin@example.com"
              },
              {
                email: "build-bot@example.com",
                firstname: "Build",
                id: 1002,
                lastname: "Bot",
                role_ids: [],
                state: 1,
                status: 1,
                username: "build-bot@example.com"
              }
            ])
          );
        }

        if (url.pathname === "/api/2/roles") {
          return new Response(
            JSON.stringify([
              {
                apps: [3001],
                id: 2001,
                name: "OneLogin Administrators",
                users: [1001]
              }
            ])
          );
        }

        if (url.pathname === "/api/2/apps") {
          return new Response(
            JSON.stringify([
              {
                auth_method: 2,
                auth_method_description: "SAML2.0",
                client_secret: "hidden-app-client-secret",
                id: 3001,
                name: "AWS Multi Role",
                role_ids: [2001],
                visible: true
              }
            ])
          );
        }

        return new Response(JSON.stringify({ message: "not found" }), {
          status: 404
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "oauth2ClientCredentials",
      config: {
        accountUrl: "https://acme.onelogin.com",
        clientId: "onelogin-client-id",
        clientSecret: "onelogin-client-secret",
        connectorKey: "onelogin",
        includeApps: true,
        includeRoles: true,
        limit: 100
      },
      integrationId: "74747474-7474-4747-8747-747474747474",
      mockMode: false,
      tenantId: "75757575-7575-4757-8757-757575757575"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "IdentityStore",
        "PrivilegedIdentity",
        "MFAEnabled",
        "MFAUnknown",
        "PrivilegedRole",
        "SaaSApplication"
      ])
    );
    expect(requested.map((request) => request.pathname)).toEqual([
      "/auth/oauth2/v2/token",
      "/api/2/users",
      "/api/2/roles",
      "/api/2/apps"
    ]);
    expect(
      requested
        .filter((request) => request.pathname.startsWith("/api/2/"))
        .every((request) => request.method === "GET" && !request.bodyPresent)
    ).toBe(true);
    expect(
      requested.some((request) =>
        /(?:create|update|delete|assign|remove|mappings?|rules?|privileges?|clone)/iu.test(
          request.url
        )
      )
    ).toBe(false);
    expect(JSON.stringify(liveResult)).not.toContain("onelogin-client-secret");
    expect(JSON.stringify(liveResult)).not.toContain("onelogin-access-token");
    expect(JSON.stringify(liveResult)).not.toContain(
      "security-admin@example.com"
    );
    expect(JSON.stringify(liveResult)).not.toContain(
      "hidden-app-client-secret"
    );
  });

  it("runs PingOne OAuth read-only identity inventory sync", async () => {
    const connector = getConnectorByKey("ping-identity");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "oauth2ClientCredentials"]));

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "ping-identity",
        mockMode: true
      },
      integrationId: "76767676-7676-4767-8767-767676767676",
      mockMode: true,
      tenantId: "77777777-7777-4777-8777-777777777777"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets.map((asset) => asset.assetType)).toEqual(
      expect.arrayContaining(["IdentityStore", "Application"])
    );
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "IdentityStore",
        "PrivilegedIdentity",
        "MFAEnabled",
        "MFAUnknown",
        "PrivilegedGroup",
        "SaaSApplication"
      ])
    );

    const requested = new Array<{
      bodyPresent: boolean;
      method: string;
      pathname: string;
      url: string;
    }>();
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input));
        const headers = init?.headers as Record<string, string> | undefined;

        requested.push({
          bodyPresent: init?.body !== undefined,
          method: init?.method ?? "GET",
          pathname: url.pathname,
          url: url.toString()
        });

        if (url.pathname === "/env-live/as/token") {
          expect(url.origin).toBe("https://auth.pingone.com");
          expect(init?.method).toBe("POST");
          expect(headers?.authorization).toMatch(/^Basic /u);
          expect(headers?.["content-type"]).toBe(
            "application/x-www-form-urlencoded"
          );
          expect(String(init?.body)).toContain("grant_type=client_credentials");

          return new Response(
            JSON.stringify({
              access_token: "pingone-access-token",
              expires_in: 3600,
              token_type: "Bearer"
            })
          );
        }

        expect(url.origin).toBe("https://api.pingone.com");
        expect(init?.method ?? "GET").toBe("GET");
        expect(init?.body).toBeUndefined();
        expect(headers?.authorization).toBe("Bearer pingone-access-token");

        if (url.pathname === "/v1/environments/env-live/users") {
          return new Response(
            JSON.stringify({
              _embedded: {
                users: [
                  {
                    account: {
                      canAuthenticate: true
                    },
                    email: "security-admin@example.com",
                    enabled: true,
                    familyName: "Admin",
                    givenName: "Security",
                    id: "ping-user-1",
                    mfaDeviceCount: 1,
                    username: "security-admin@example.com"
                  },
                  {
                    account: {
                      canAuthenticate: true
                    },
                    email: "build-bot@example.com",
                    enabled: true,
                    familyName: "Bot",
                    givenName: "Build",
                    id: "ping-user-2",
                    username: "build-bot@example.com"
                  }
                ]
              }
            })
          );
        }

        if (url.pathname === "/v1/environments/env-live/groups") {
          return new Response(
            JSON.stringify({
              _embedded: {
                groups: [
                  {
                    id: "ping-group-1",
                    name: "PingOne Administrators",
                    users: 3
                  }
                ]
              }
            })
          );
        }

        if (url.pathname === "/v1/environments/env-live/applications") {
          return new Response(
            JSON.stringify({
              _embedded: {
                applications: [
                  {
                    clientSecret: "hidden-ping-app-secret",
                    enabled: true,
                    id: "ping-app-1",
                    name: "AWS Console",
                    oidc: {
                      redirectUris: ["https://console.example.com/callback"]
                    },
                    protocol: "OPENID_CONNECT",
                    type: "WEB_APP"
                  }
                ]
              }
            })
          );
        }

        return new Response(JSON.stringify({ message: "not found" }), {
          status: 404
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "oauth2ClientCredentials",
      config: {
        apiBaseUrl: "https://api.pingone.com",
        authBaseUrl: "https://auth.pingone.com",
        clientId: "pingone-client-id",
        clientSecret: "pingone-client-secret",
        connectorKey: "ping-identity",
        environmentId: "env-live",
        includeApplications: true,
        includeGroups: true,
        limit: 100
      },
      integrationId: "78787878-7878-4787-8787-787878787878",
      mockMode: false,
      tenantId: "79797979-7979-4797-8797-797979797979"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets.map((asset) => asset.assetType)).toEqual(
      expect.arrayContaining(["IdentityStore", "Application"])
    );
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "IdentityStore",
        "PrivilegedIdentity",
        "MFAEnabled",
        "MFAUnknown",
        "PrivilegedGroup",
        "SaaSApplication"
      ])
    );
    expect(requested.map((request) => request.pathname)).toEqual([
      "/env-live/as/token",
      "/v1/environments/env-live/users",
      "/v1/environments/env-live/groups",
      "/v1/environments/env-live/applications"
    ]);
    expect(
      requested
        .filter((request) => request.pathname.startsWith("/v1/"))
        .every((request) => request.method === "GET" && !request.bodyPresent)
    ).toBe(true);
    expect(
      requested.some((request) =>
        /(?:password|mfaDevices?|secret|assign|create|update|delete|policy|roleAssignments?)/iu.test(
          request.url
        )
      )
    ).toBe(false);
    expect(JSON.stringify(liveResult)).not.toContain("pingone-client-secret");
    expect(JSON.stringify(liveResult)).not.toContain("pingone-access-token");
    expect(JSON.stringify(liveResult)).not.toContain(
      "security-admin@example.com"
    );
    expect(JSON.stringify(liveResult)).not.toContain("hidden-ping-app-secret");

    const postAuthRequests = new Array<{
      authorization?: string;
      body: string;
      method: string;
      pathname: string;
    }>();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input));
        const headers = init?.headers as Record<string, string> | undefined;

        postAuthRequests.push({
          authorization: headers?.authorization,
          body: String(init?.body ?? ""),
          method: init?.method ?? "GET",
          pathname: url.pathname
        });

        if (url.pathname === "/env-live/as/token") {
          expect(headers?.authorization).toBeUndefined();
          expect(String(init?.body)).toContain("client_id=pingone-client-id");
          expect(String(init?.body)).toContain(
            "client_secret=pingone-client-secret"
          );

          return new Response(
            JSON.stringify({
              access_token: "pingone-post-access-token",
              token_type: "Bearer"
            })
          );
        }

        expect(url.pathname).toBe("/v1/environments/env-live/users");
        expect(init?.method ?? "GET").toBe("GET");
        expect(init?.body).toBeUndefined();
        expect(headers?.authorization).toBe("Bearer pingone-post-access-token");

        return new Response(
          JSON.stringify({
            _embedded: {
              users: []
            }
          })
        );
      })
    );

    const postAuthHealth = await connector!.healthCheck({
      authType: "oauth2ClientCredentials",
      config: {
        apiBaseUrl: "https://api.pingone.com",
        authBaseUrl: "https://auth.pingone.com",
        clientId: "pingone-client-id",
        clientSecret: "pingone-client-secret",
        connectorKey: "ping-identity",
        environmentId: "env-live",
        tokenEndpointAuthMethod: "clientSecretPost"
      },
      integrationId: "80808080-8080-4808-8808-808080808080",
      mockMode: false,
      tenantId: "81818181-8181-4818-8818-818181818181"
    });

    expect(postAuthHealth.status).toBe("Healthy");
    expect(postAuthRequests.map((request) => request.pathname)).toEqual([
      "/env-live/as/token",
      "/v1/environments/env-live/users"
    ]);
    expect(postAuthRequests[1]).toMatchObject({
      body: "",
      method: "GET"
    });
  });

  it("runs Auth0 OAuth read-only identity inventory sync", async () => {
    const connector = getConnectorByKey("auth0");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "oauth2ClientCredentials"]));

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "auth0",
        mockMode: true
      },
      integrationId: "82828282-8282-4828-8828-828282828282",
      mockMode: true,
      tenantId: "83838383-8383-4838-8838-838383838383"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets.map((asset) => asset.assetType)).toEqual(
      expect.arrayContaining(["IdentityStore", "Application"])
    );
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "IdentityStore",
        "PrivilegedIdentity",
        "MFAEnabled",
        "MFAUnknown",
        "PrivilegedRole",
        "SaaSApplication"
      ])
    );

    const requested = new Array<{
      bodyPresent: boolean;
      method: string;
      pathname: string;
      url: string;
    }>();
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input));
        const headers = init?.headers as Record<string, string> | undefined;

        requested.push({
          bodyPresent: init?.body !== undefined,
          method: init?.method ?? "GET",
          pathname: url.pathname,
          url: url.toString()
        });

        expect(url.origin).toBe("https://tenant.example.auth0.com");

        if (url.pathname === "/oauth/token") {
          expect(init?.method).toBe("POST");
          expect(headers?.["content-type"]).toBe("application/json");
          expect(String(init?.body)).toContain(
            '"grant_type":"client_credentials"'
          );
          expect(String(init?.body)).toContain(
            '"audience":"https://tenant.example.auth0.com/api/v2/"'
          );

          return new Response(
            JSON.stringify({
              access_token: "auth0-management-token",
              expires_in: 3600,
              token_type: "Bearer"
            })
          );
        }

        expect(init?.method ?? "GET").toBe("GET");
        expect(init?.body).toBeUndefined();
        expect(headers?.authorization).toBe("Bearer auth0-management-token");

        if (url.pathname === "/api/v2/users") {
          expect(url.searchParams.get("include_fields")).toBe("true");
          expect(url.searchParams.get("fields")).toContain("multifactor");

          return new Response(
            JSON.stringify([
              {
                blocked: false,
                email: "security-admin@example.com",
                multifactor: ["guardian"],
                name: "Security Admin",
                nickname: "security-admin",
                user_id: "auth0|admin"
              },
              {
                blocked: false,
                email: "build-bot@example.com",
                name: "Build Bot",
                nickname: "build-bot",
                user_id: "auth0|build-bot"
              }
            ])
          );
        }

        if (url.pathname === "/api/v2/roles") {
          return new Response(
            JSON.stringify([
              {
                description: "Tenant administrators",
                id: "rol_admin",
                name: "Tenant Admin"
              }
            ])
          );
        }

        if (url.pathname === "/api/v2/clients") {
          expect(url.searchParams.get("fields")).toBe(
            "client_id,name,app_type,grant_types,is_first_party"
          );

          return new Response(
            JSON.stringify([
              {
                app_type: "regular_web",
                client_id: "auth0-client-1",
                client_secret: "hidden-auth0-client-secret",
                grant_types: ["authorization_code", "refresh_token"],
                is_first_party: true,
                name: "Production Console"
              }
            ])
          );
        }

        return new Response(JSON.stringify({ message: "not found" }), {
          status: 404
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "oauth2ClientCredentials",
      config: {
        clientId: "auth0-client-id",
        clientSecret: "auth0-client-secret",
        connectorKey: "auth0",
        domain: "tenant.example.auth0.com",
        includeApplications: true,
        includeRoles: true,
        perPage: 50
      },
      integrationId: "84848484-8484-4848-8848-848484848484",
      mockMode: false,
      tenantId: "85858585-8585-4858-8858-858585858585"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets.map((asset) => asset.assetType)).toEqual(
      expect.arrayContaining(["IdentityStore", "Application"])
    );
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "IdentityStore",
        "PrivilegedIdentity",
        "MFAEnabled",
        "MFAUnknown",
        "PrivilegedRole",
        "SaaSApplication"
      ])
    );
    expect(requested.map((request) => request.pathname)).toEqual([
      "/oauth/token",
      "/api/v2/users",
      "/api/v2/roles",
      "/api/v2/clients"
    ]);
    expect(
      requested
        .filter((request) => request.pathname.startsWith("/api/v2/"))
        .every((request) => request.method === "GET" && !request.bodyPresent)
    ).toBe(true);
    expect(
      requested.some((request) =>
        /(?:password|secret|assign|create|update|delete|reset|policy|tenant-settings)/iu.test(
          request.url
        )
      )
    ).toBe(false);
    expect(JSON.stringify(liveResult)).not.toContain("auth0-client-secret");
    expect(JSON.stringify(liveResult)).not.toContain("auth0-management-token");
    expect(JSON.stringify(liveResult)).not.toContain(
      "security-admin@example.com"
    );
    expect(JSON.stringify(liveResult)).not.toContain(
      "hidden-auth0-client-secret"
    );
  });

  it("runs JumpCloud API-key read-only identity inventory sync", async () => {
    const connector = getConnectorByKey("jumpcloud");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiKey"]));

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "jumpcloud",
        mockMode: true
      },
      integrationId: "86868686-8686-4868-8868-868686868686",
      mockMode: true,
      tenantId: "87878787-8787-4878-8878-878787878787"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets.map((asset) => asset.assetType)).toEqual(
      expect.arrayContaining(["IdentityStore", "Application"])
    );
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "IdentityStore",
        "PrivilegedIdentity",
        "MFAEnabled",
        "MFAUnknown",
        "PrivilegedGroup",
        "SaaSApplication"
      ])
    );

    const requested = new Array<{
      bodyPresent: boolean;
      method: string;
      pathname: string;
      url: string;
    }>();
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input));
        const headers = init?.headers as Record<string, string> | undefined;

        requested.push({
          bodyPresent: init?.body !== undefined,
          method: init?.method ?? "GET",
          pathname: url.pathname,
          url: url.toString()
        });

        expect(url.origin).toBe("https://console.jumpcloud.com");
        expect(init?.method ?? "GET").toBe("GET");
        expect(init?.body).toBeUndefined();
        expect(headers?.["x-api-key"]).toBe("jumpcloud-api-key");
        expect(headers?.["x-org-id"]).toBe("org-123");

        if (url.pathname === "/api/systemusers") {
          expect(url.searchParams.get("limit")).toBe("100");

          return new Response(
            JSON.stringify({
              results: [
                {
                  _id: "jc-user-1",
                  activated: true,
                  email: "security-admin@example.com",
                  firstname: "Security",
                  lastname: "Admin",
                  mfa: ["totp"],
                  username: "security-admin"
                },
                {
                  _id: "jc-user-2",
                  activated: true,
                  email: "build-bot@example.com",
                  firstname: "Build",
                  lastname: "Bot",
                  username: "build-bot"
                }
              ]
            })
          );
        }

        if (url.pathname === "/api/v2/usergroups") {
          return new Response(
            JSON.stringify([
              {
                id: "jc-group-1",
                name: "JumpCloud Administrators"
              }
            ])
          );
        }

        if (url.pathname === "/api/applications") {
          return new Response(
            JSON.stringify({
              results: [
                {
                  _id: "jc-app-1",
                  active: true,
                  config: {
                    privateKey: "hidden-jumpcloud-app-secret"
                  },
                  displayLabel: "AWS Console",
                  sso: {
                    enabled: true
                  },
                  type: "saml"
                }
              ]
            })
          );
        }

        return new Response(JSON.stringify({ message: "not found" }), {
          status: 404
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "apiKey",
      config: {
        apiKey: "jumpcloud-api-key",
        baseUrl: "https://console.jumpcloud.com",
        connectorKey: "jumpcloud",
        includeApplications: true,
        includeUserGroups: true,
        limit: 100,
        organizationId: "org-123"
      },
      integrationId: "88888888-8888-4888-8888-888888888888",
      mockMode: false,
      tenantId: "89898989-8989-4898-8898-898989898989"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets.map((asset) => asset.assetType)).toEqual(
      expect.arrayContaining(["IdentityStore", "Application"])
    );
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "IdentityStore",
        "PrivilegedIdentity",
        "MFAEnabled",
        "MFAUnknown",
        "PrivilegedGroup",
        "SaaSApplication"
      ])
    );
    expect(requested.map((request) => request.pathname)).toEqual([
      "/api/systemusers",
      "/api/v2/usergroups",
      "/api/applications"
    ]);
    expect(
      requested.every(
        (request) => request.method === "GET" && !request.bodyPresent
      )
    ).toBe(true);
    expect(
      requested.some((request) =>
        /(?:unlock|password|totp|secret|assign|create|update|delete|command|association|policy)/iu.test(
          request.url
        )
      )
    ).toBe(false);
    expect(JSON.stringify(liveResult)).not.toContain("jumpcloud-api-key");
    expect(JSON.stringify(liveResult)).not.toContain(
      "security-admin@example.com"
    );
    expect(JSON.stringify(liveResult)).not.toContain(
      "hidden-jumpcloud-app-secret"
    );
  });

  it("runs CyberArk Identity SCIM read-only inventory sync", async () => {
    const connector = getConnectorByKey("cyberark");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "bearerToken"]));

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "cyberark",
        mockMode: true
      },
      integrationId: "90909090-9090-4909-8909-909090909090",
      mockMode: true,
      tenantId: "91919191-9191-4919-8919-919191919191"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets.map((asset) => asset.assetType)).toEqual([
      "IdentityStore"
    ]);
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "IdentityStore",
        "PrivilegedIdentity",
        "MFAEnabled",
        "MFAUnknown",
        "PrivilegedGroup"
      ])
    );

    const requested = new Array<{
      bodyPresent: boolean;
      method: string;
      pathname: string;
      url: string;
    }>();
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input));
        const headers = init?.headers as Record<string, string> | undefined;

        requested.push({
          bodyPresent: init?.body !== undefined,
          method: init?.method ?? "GET",
          pathname: url.pathname,
          url: url.toString()
        });

        expect(url.origin).toBe("https://tenant.id.cyberark.cloud");
        expect(init?.method ?? "GET").toBe("GET");
        expect(init?.body).toBeUndefined();
        expect(headers?.authorization).toBe("Bearer cyberark-scim-token");

        if (url.pathname === "/scim/v2/Users") {
          expect(url.searchParams.get("count")).toBe("100");
          expect(url.searchParams.get("startIndex")).toBe("1");

          return new Response(
            JSON.stringify({
              Resources: [
                {
                  active: true,
                  displayName: "Security Admin",
                  emails: [
                    {
                      value: "security-admin@example.com"
                    }
                  ],
                  id: "cyberark-user-1",
                  mfaEnabled: true,
                  userName: "security-admin"
                },
                {
                  active: true,
                  displayName: "Build Bot",
                  emails: [
                    {
                      value: "build-bot@example.com"
                    }
                  ],
                  id: "cyberark-user-2",
                  userName: "build-bot"
                }
              ],
              itemsPerPage: 100,
              startIndex: 1,
              totalResults: 2
            })
          );
        }

        if (url.pathname === "/scim/v2/Groups") {
          return new Response(
            JSON.stringify({
              Resources: [
                {
                  displayName: "CyberArk Vault Admins",
                  id: "cyberark-group-1",
                  members: [
                    {
                      value: "cyberark-user-1"
                    }
                  ]
                }
              ],
              itemsPerPage: 100,
              startIndex: 1,
              totalResults: 1
            })
          );
        }

        return new Response(JSON.stringify({ message: "not found" }), {
          status: 404
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "bearerToken",
      config: {
        baseUrl: "https://tenant.id.cyberark.cloud",
        bearerToken: "cyberark-scim-token",
        connectorKey: "cyberark",
        count: 100,
        includeGroups: true,
        startIndex: 1
      },
      integrationId: "92929292-9292-4929-8929-929292929292",
      mockMode: false,
      tenantId: "93939393-9393-4939-8939-939393939393"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets.map((asset) => asset.assetType)).toEqual([
      "IdentityStore"
    ]);
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "IdentityStore",
        "PrivilegedIdentity",
        "MFAEnabled",
        "MFAUnknown",
        "PrivilegedGroup"
      ])
    );
    expect(requested.map((request) => request.pathname)).toEqual([
      "/scim/v2/Users",
      "/scim/v2/Groups"
    ]);
    expect(
      requested.every(
        (request) => request.method === "GET" && !request.bodyPresent
      )
    ).toBe(true);
    expect(
      requested.some((request) =>
        /(?:PasswordVault|password|credential|checkout|safes?|accounts?|platformtoken|change|set|exempt|delete|patch|post)/iu.test(
          request.url
        )
      )
    ).toBe(false);
    expect(JSON.stringify(liveResult)).not.toContain("cyberark-scim-token");
    expect(JSON.stringify(liveResult)).not.toContain(
      "security-admin@example.com"
    );
  });

  it("runs Active Directory LDAP read-only identity inventory sync", async () => {
    const connector = getConnectorByKey("active-directory");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "ldapBind"]));

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "active-directory",
        mockMode: true
      },
      integrationId: "94949494-9494-4949-8949-949494949494",
      mockMode: true,
      tenantId: "95959595-9595-4959-8959-959595959595"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets.map((asset) => asset.assetType)).toEqual(
      expect.arrayContaining(["IdentityStore", "Host"])
    );
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "IdentityStore",
        "PrivilegedIdentity",
        "MFAUnknown",
        "PrivilegedGroup",
        "DelegatedServiceAccount",
        "DelegatedComputer"
      ])
    );

    const bindSpy = vi
      .spyOn(LdapClient.prototype, "bind")
      .mockResolvedValue(undefined);
    const unbindSpy = vi
      .spyOn(LdapClient.prototype, "unbind")
      .mockResolvedValue(undefined);
    const searchRequests = new Array<{
      attributes: string[];
      baseDn: string;
      filter: string;
      pageSize?: number;
      sizeLimit?: number;
      timeLimit?: number;
    }>();

    vi.spyOn(LdapClient.prototype, "search").mockImplementation(
      async (baseDn, options): Promise<SearchResult> => {
        const searchOptions = options as {
          attributes?: string[];
          filter?: string;
          paged?: { pageSize?: number } | boolean;
          sizeLimit?: number;
          timeLimit?: number;
        };
        const filter = searchOptions.filter ?? "";

        searchRequests.push({
          attributes: searchOptions.attributes ?? [],
          baseDn: String(baseDn),
          filter,
          pageSize:
            typeof searchOptions.paged === "object"
              ? searchOptions.paged.pageSize
              : undefined,
          sizeLimit: searchOptions.sizeLimit,
          timeLimit: searchOptions.timeLimit
        });

        if (filter.includes("objectCategory=person")) {
          return {
            searchEntries: [
              {
                adminCount: "1",
                distinguishedName:
                  "CN=Security Admin,OU=Users,DC=example,DC=local",
                displayName: "Security Admin",
                dn: "CN=Security Admin,OU=Users,DC=example,DC=local",
                mail: "security-admin@example.com",
                memberOf: ["CN=Domain Admins,CN=Users,DC=example,DC=local"],
                sAMAccountName: "security-admin",
                servicePrincipalName: [],
                userAccountControl: "512"
              },
              {
                distinguishedName:
                  "CN=SQL Service,OU=Services,DC=example,DC=local",
                displayName: "SQL Service",
                dn: "CN=SQL Service,OU=Services,DC=example,DC=local",
                mail: "svc-sql@example.com",
                sAMAccountName: "svc-sql",
                servicePrincipalName: ["MSSQLSvc/sql01.example.local:1433"],
                userAccountControl: String(512 | 0x80000)
              }
            ] as SearchResult["searchEntries"],
            searchReferences: []
          } as SearchResult;
        }

        if (filter.includes("objectCategory=group")) {
          return {
            searchEntries: [
              {
                cn: "Domain Admins",
                distinguishedName:
                  "CN=Domain Admins,CN=Users,DC=example,DC=local",
                dn: "CN=Domain Admins,CN=Users,DC=example,DC=local",
                member: [
                  "CN=Security Admin,OU=Users,DC=example,DC=local",
                  "CN=SQL Service,OU=Services,DC=example,DC=local"
                ]
              }
            ] as SearchResult["searchEntries"],
            searchReferences: []
          } as SearchResult;
        }

        if (filter.includes("objectCategory=computer")) {
          return {
            searchEntries: [
              {
                cn: "APP01",
                dNSHostName: "app01.example.local",
                distinguishedName: "CN=APP01,OU=Servers,DC=example,DC=local",
                dn: "CN=APP01,OU=Servers,DC=example,DC=local",
                name: "APP01",
                operatingSystem: "Windows Server",
                userAccountControl: String(4096 | 0x1000000)
              }
            ] as SearchResult["searchEntries"],
            searchReferences: []
          } as SearchResult;
        }

        return {
          searchEntries: [] as SearchResult["searchEntries"],
          searchReferences: []
        } as SearchResult;
      }
    );

    const liveResult = await connector!.sync({
      authType: "ldapBind",
      config: {
        baseDn: "DC=example,DC=local",
        bindDn: "CN=readonly,OU=Service Accounts,DC=example,DC=local",
        bindPassword: "active-directory-bind-password",
        connectorKey: "active-directory",
        includeComputers: true,
        includeGroups: true,
        includeServiceAccounts: true,
        pageSize: 250,
        sizeLimit: 1000,
        timeLimitSeconds: 10,
        tlsRejectUnauthorized: true,
        url: "ldaps://dc01.example.local:636"
      },
      integrationId: "96969696-9696-4969-8969-969696969696",
      mockMode: false,
      tenantId: "97979797-9797-4979-8979-979797979797"
    });

    expect(bindSpy).toHaveBeenCalledWith(
      "CN=readonly,OU=Service Accounts,DC=example,DC=local",
      "active-directory-bind-password"
    );
    expect(unbindSpy).toHaveBeenCalledTimes(1);
    expect(searchRequests.map((request) => request.filter)).toEqual([
      "(&(objectCategory=person)(objectClass=user))",
      "(&(objectCategory=group)(objectClass=group))",
      "(&(objectCategory=computer)(objectClass=computer))"
    ]);
    expect(
      searchRequests.every(
        (request) =>
          request.baseDn === "DC=example,DC=local" &&
          request.pageSize === 250 &&
          request.sizeLimit === 1000 &&
          request.timeLimit === 10
      )
    ).toBe(true);
    expect(searchRequests.flatMap((request) => request.attributes)).not.toEqual(
      expect.arrayContaining([
        "unicodePwd",
        "ntPwdHistory",
        "dBCSPwd",
        "supplementalCredentials",
        "msDS-KeyCredentialLink"
      ])
    );
    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets.map((asset) => asset.assetType)).toEqual(
      expect.arrayContaining(["IdentityStore", "Host"])
    );
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "IdentityStore",
        "PrivilegedIdentity",
        "MFAUnknown",
        "PrivilegedGroup",
        "DelegatedServiceAccount",
        "DelegatedComputer"
      ])
    );
    expect(JSON.stringify(liveResult)).not.toContain(
      "active-directory-bind-password"
    );
    expect(JSON.stringify(liveResult)).not.toContain(
      "security-admin@example.com"
    );
  });

  it("runs Microsoft Entra read-only Graph identity inventory sync", async () => {
    const connector = getConnectorByKey("microsoft-entra-id");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "oauth2ClientCredentials"]));

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "microsoft-entra-id",
        mockMode: true
      },
      integrationId: "90909090-9090-4909-8909-909090909090",
      mockMode: true,
      tenantId: "91919191-9191-4919-8919-919191919191"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets.map((asset) => asset.assetType)).toEqual(
      expect.arrayContaining(["IdentityStore", "Application"])
    );
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "IdentityStore",
        "PrivilegedIdentity",
        "PrivilegedGroup",
        "DirectoryRole",
        "SaaSApplication"
      ])
    );

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);

        if (url.includes("/oauth2/v2.0/token")) {
          expect(init?.method).toBe("POST");
          expect(String(init?.body)).toContain("client_secret=entra-secret");

          return new Response(
            JSON.stringify({
              access_token: "entra-access-token"
            })
          );
        }

        expect(init?.method ?? "GET").toBe("GET");
        expect(
          (init?.headers as Record<string, string> | undefined)?.authorization
        ).toBe("Bearer entra-access-token");

        if (url.includes("/organization?")) {
          return new Response(
            JSON.stringify({
              value: [
                {
                  displayName: "Periscan Directory",
                  id: "tenant-live"
                }
              ]
            })
          );
        }

        if (url.includes("/users?")) {
          return new Response(
            JSON.stringify({
              value: [
                {
                  accountEnabled: true,
                  displayName: "Security Admin",
                  id: "user-1",
                  mail: "security-admin@example.com",
                  userPrincipalName: "security-admin@example.com",
                  userType: "Member"
                }
              ]
            })
          );
        }

        if (url.includes("/groups?")) {
          return new Response(
            JSON.stringify({
              value: [
                {
                  description: "Privileged administrators.",
                  displayName: "Global Administrators",
                  id: "group-1",
                  securityEnabled: true
                }
              ]
            })
          );
        }

        if (url.includes("/applications?")) {
          return new Response(
            JSON.stringify({
              value: [
                {
                  appId: "app-client-id",
                  displayName: "Production Operations App",
                  id: "app-1",
                  signInAudience: "AzureADMyOrg"
                }
              ]
            })
          );
        }

        if (url.includes("/directoryRoles?")) {
          return new Response(
            JSON.stringify({
              value: [
                {
                  description: "Can manage all directory settings.",
                  displayName: "Global Administrator",
                  id: "role-1"
                }
              ]
            })
          );
        }

        return new Response(JSON.stringify({ error: "not found" }), {
          status: 404
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "oauth2ClientCredentials",
      config: {
        clientId: "entra-client-id",
        clientSecret: "entra-secret",
        connectorKey: "microsoft-entra-id",
        tenantId: "tenant-live"
      },
      integrationId: "92929292-9292-4929-8929-929292929292",
      mockMode: false,
      tenantId: "93939393-9393-4939-8939-939393939393"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets.map((asset) => asset.assetType)).toEqual(
      expect.arrayContaining(["IdentityStore", "Application"])
    );
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "IdentityStore",
        "PrivilegedIdentity",
        "PrivilegedGroup",
        "DirectoryRole",
        "SaaSApplication"
      ])
    );
    expect(
      fetchMock.mock.calls
        .filter((call) => !String(call[0]).includes("/oauth2/v2.0/token"))
        .every((call) => (call[1]?.method ?? "GET") === "GET")
    ).toBe(true);
    expect(JSON.stringify(liveResult)).not.toContain("entra-secret");
    expect(JSON.stringify(liveResult)).not.toContain("entra-access-token");
  });

  it("runs Microsoft Defender for Office 365 read-only email-security sync", async () => {
    const connector = getConnectorByKey("microsoft-defender-email");

    expect(connector).toBeDefined();
    expect(connector!.manifest.marketplaceCategory).toBe("Email Security");
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "oauth2ClientCredentials"]));

    const mockContext = {
      authType: "mock",
      config: {
        connectorKey: "microsoft-defender-email",
        mockMode: true
      },
      integrationId: "15151515-1515-4151-8151-151515151515",
      mockMode: true,
      tenantId: "16161616-1616-4161-8161-161616161616"
    };
    const mockResult = await connector!.sync(mockContext);

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets.map((asset) => asset.assetType)).toEqual(
      expect.arrayContaining(["Service"])
    );
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "EmailSecurityControl",
        "EmailThreatIncident",
        "EmailSecurityAlert",
        "MitreTechniqueObserved"
      ])
    );
    await expect(
      connector!.observeControl?.(mockContext)
    ).resolves.toMatchObject({
      outcome: "Alerted"
    });

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);

        if (url.includes("/oauth2/v2.0/token")) {
          expect(init?.method).toBe("POST");
          expect(String(init?.body)).toContain(
            "client_secret=defender-email-secret"
          );

          return new Response(
            JSON.stringify({
              access_token: "defender-email-access-token"
            })
          );
        }

        expect(init?.method ?? "GET").toBe("GET");
        expect(
          (init?.headers as Record<string, string> | undefined)?.authorization
        ).toBe("Bearer defender-email-access-token");

        if (url.includes("/security/incidents")) {
          return new Response(
            JSON.stringify({
              value: [
                {
                  classification: "TruePositive",
                  createdDateTime: "2026-06-01T12:00:00Z",
                  displayName: "Credential phishing campaign",
                  id: "incident-live-1",
                  severity: "high",
                  status: "active"
                }
              ]
            })
          );
        }

        if (url.includes("/security/alerts_v2")) {
          return new Response(
            JSON.stringify({
              value: [
                {
                  category: "InitialAccess",
                  createdDateTime: "2026-06-01T12:02:00Z",
                  detectionSource: "Microsoft Defender for Office 365",
                  id: "alert-live-1",
                  mitreTechniques: ["T1566.001"],
                  serviceSource: "Microsoft Defender for Office 365",
                  severity: "high",
                  status: "newAlert",
                  title: "Phishing message delivered"
                }
              ]
            })
          );
        }

        return new Response(JSON.stringify({ error: "not found" }), {
          status: 404
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "oauth2ClientCredentials",
      config: {
        clientId: "defender-email-client-id",
        clientSecret: "defender-email-secret",
        connectorKey: "microsoft-defender-email",
        maxItems: 5,
        tenantId: "tenant-live"
      },
      integrationId: "17171717-1717-4171-8171-171717171717",
      mockMode: false,
      tenantId: "18181818-1818-4181-8181-181818181818"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "EmailThreatIncident",
        "EmailSecurityAlert",
        "MitreTechniqueObserved"
      ])
    );
    expect(
      fetchMock.mock.calls
        .filter((call) => !String(call[0]).includes("/oauth2/v2.0/token"))
        .every((call) => (call[1]?.method ?? "GET") === "GET")
    ).toBe(true);
    expect(JSON.stringify(liveResult)).not.toContain("defender-email-secret");
    expect(JSON.stringify(liveResult)).not.toContain(
      "defender-email-access-token"
    );
  });

  it("runs Google Gmail Security read-only Alert Center sync", async () => {
    const connector = getConnectorByKey("google-gmail-security");

    expect(connector).toBeDefined();
    expect(connector!.manifest).toMatchObject({
      availability: "Beta",
      connectable: true,
      marketplaceCategory: "Email Security",
      product: "Gmail Security",
      vendor: "Google"
    });
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "accessToken"]));
    expect(connector!.manifest.requiredPermissions).toEqual(
      expect.arrayContaining(["apps.alerts.readonly"])
    );

    const mockContext = {
      authType: "mock",
      config: {
        connectorKey: "google-gmail-security",
        mockMode: true
      },
      integrationId: "19191919-1919-4191-8191-191919191919",
      mockMode: true,
      tenantId: "20202020-2020-4202-8202-202020202020"
    };
    const mockResult = await connector!.sync(mockContext);

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets.map((asset) => asset.assetType)).toEqual(
      expect.arrayContaining(["Service"])
    );
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "EmailSecurityControl",
        "GmailSecurityAlert",
        "PhishingObserved",
        "MalwareObserved"
      ])
    );
    await expect(
      connector!.observeControl?.(mockContext)
    ).resolves.toMatchObject({
      outcome: "Alerted"
    });

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        const parsed = new URL(url);
        const headers = init?.headers as Record<string, string> | undefined;

        expect(init?.method ?? "GET").toBe("GET");
        expect(`${parsed.origin}${parsed.pathname}`).toBe(
          "https://alertcenter.googleapis.example.test/v1beta1/alerts"
        );
        expect(parsed.searchParams.get("pageSize")).toBe("10");
        expect(parsed.searchParams.get("filter")).toBe('source="Gmail"');
        expect(headers?.authorization).toBe(
          "Bearer google-gmail-security-token"
        );
        expect(url).not.toMatch(
          /\/(?:alerts\/[^/]+\/(?:delete|undelete|feedback|metadata)|settings|rules|gmail\/v1\/users\/[^/]+\/messages)(\/|\?|$)/iu
        );

        return new Response(
          JSON.stringify({
            alerts: [
              {
                alertId: "gmail-live-alert",
                createTime: "2026-06-04T12:00:00.000Z",
                data: {
                  displayName: "Phishing message with malware attachment",
                  messageId: "redacted-test-message",
                  severity: "HIGH"
                },
                source: "Gmail",
                type: "User reported phishing"
              }
            ]
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "accessToken",
      config: {
        accessToken: "google-gmail-security-token",
        alertCenterBaseUrl:
          "https://alertcenter.googleapis.example.test/v1beta1",
        connectorKey: "google-gmail-security",
        filter: 'source="Gmail"',
        maxAlerts: 10
      },
      integrationId: "21212121-2121-4212-8212-212121212121",
      mockMode: false,
      tenantId: "22222222-2222-4222-8222-222222222222"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "EmailSecurityControl",
        "GmailSecurityAlert",
        "PhishingObserved",
        "MalwareObserved"
      ])
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(liveResult)).not.toContain(
      "google-gmail-security-token"
    );
  });

  it("runs Proofpoint TAP SIEM read-only email-security sync", async () => {
    const connector = getConnectorByKey("proofpoint");

    expect(connector).toBeDefined();
    expect(connector!.manifest.marketplaceCategory).toBe("Email Security");
    expect(connector!.manifest).toMatchObject({
      availability: "Beta",
      connectable: true,
      product: "Targeted Attack Protection",
      vendor: "Proofpoint"
    });
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "basicAuth"]));

    const mockContext = {
      authType: "mock",
      config: {
        connectorKey: "proofpoint",
        fixtureOutcome: "Blocked",
        mockMode: true
      },
      integrationId: "19191919-1919-4191-8191-191919191919",
      mockMode: true,
      tenantId: "20202020-2020-4202-8202-202020202020"
    };
    const mockResult = await connector!.sync(mockContext);

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets.map((asset) => asset.assetType)).toEqual(
      expect.arrayContaining(["Service"])
    );
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining(["EmailSecurityControl", "EmailThreatBlocked"])
    );
    await expect(
      connector!.observeControl?.(mockContext)
    ).resolves.toMatchObject({
      outcome: "Blocked"
    });

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);

        expect(init?.method ?? "GET").toBe("GET");
        expect(url).toContain("/v2/siem/messages/blocked");
        expect(url).toContain("format=json");
        expect(url).toContain("sinceSeconds=3600");
        expect(url).not.toMatch(
          /\/(quarantine|release|delete|remediate|allowlist|blocklist|safelist|settings|policy|users)(\/|\?|$)/iu
        );
        expect(
          (init?.headers as Record<string, string> | undefined)?.authorization
        ).toBe(
          `Basic ${Buffer.from(
            "proofpoint-principal:proofpoint-secret"
          ).toString("base64")}`
        );

        return new Response(
          JSON.stringify({
            messagesBlocked: [
              {
                GUID: "proofpoint-live-guid",
                campaignId: "proofpoint-live-campaign",
                messageID: "<proofpoint-live-message@periscan.local>",
                quarantineRule: "malware rule",
                senderIP: "203.0.113.40",
                threatsInfoMap: [
                  {
                    classification: "Malware",
                    threat:
                      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
                    threatId: "proofpoint-threat-live",
                    threatType: "attachment"
                  }
                ]
              }
            ],
            messagesDelivered: [],
            clicksBlocked: [],
            clicksPermitted: []
          })
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "basicAuth",
      config: {
        baseUrl: "https://tap-api-v2.proofpoint.example.test",
        connectorKey: "proofpoint",
        endpoint: "messagesBlocked",
        principal: "proofpoint-principal",
        secret: "proofpoint-secret",
        sinceSeconds: 3600
      },
      integrationId: "21212121-2121-4212-8212-212121212121",
      mockMode: false,
      tenantId: "22222222-2222-4222-8222-222222222222"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining(["EmailSecurityControl", "EmailThreatBlocked"])
    );
    expect(fetchMock).toHaveBeenCalled();
    expect(
      fetchMock.mock.calls.every((call) => (call[1]?.method ?? "GET") === "GET")
    ).toBe(true);
    expect(JSON.stringify(liveResult)).not.toContain("proofpoint-secret");
    expect(JSON.stringify(liveResult)).not.toContain("proofpoint-principal");
  });

  it("runs Mimecast SIEM read-only email-security sync", async () => {
    const connector = getConnectorByKey("mimecast");

    expect(connector).toBeDefined();
    expect(connector!.manifest.marketplaceCategory).toBe("Email Security");
    expect(connector!.manifest).toMatchObject({
      availability: "Beta",
      connectable: true,
      product: "Email Security Cloud Gateway",
      vendor: "Mimecast"
    });
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "hmacApiKey"]));

    const mockContext = {
      authType: "mock",
      config: {
        connectorKey: "mimecast",
        fixtureOutcome: "Blocked",
        mockMode: true
      },
      integrationId: "23232323-2323-4232-8232-232323232323",
      mockMode: true,
      tenantId: "24242424-2424-4242-8242-242424242424"
    };
    const mockResult = await connector!.sync(mockContext);

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets.map((asset) => asset.assetType)).toEqual(
      expect.arrayContaining(["Service"])
    );
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining(["EmailSecurityControl", "EmailThreatBlocked"])
    );
    await expect(
      connector!.observeControl?.(mockContext)
    ).resolves.toMatchObject({
      outcome: "Blocked"
    });

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        const headers = init?.headers as Record<string, string> | undefined;

        expect(init?.method).toBe("POST");
        expect(url).toBe(
          "https://us-api.mimecast.example.test/api/audit/get-siem-logs"
        );
        expect(headers?.authorization).toMatch(/^MC mimecast-access-key:/u);
        expect(headers?.["x-mc-app-id"]).toBe("mimecast-app-id");
        expect(headers?.["x-mc-date"]).toEqual(expect.any(String));
        expect(headers?.["x-mc-req-id"]).toEqual(expect.any(String));
        expect(url).not.toMatch(
          /\/(release|delete|remediate|policy|policies|group|groups|user|users|message-finder|message-finders|managed-url|block|permit)(\/|\?|$)/iu
        );
        expect(String(init?.body)).toContain('"type":"MTA"');
        expect(String(init?.body)).toContain('"fileFormat":"json"');

        return new Response(
          JSON.stringify({
            data: [
              {
                action: "blocked",
                eventType: "url_protect",
                messageId: "mimecast-live-message",
                reason: "malware",
                sender: "sender@example.invalid",
                timestamp: "2026-06-01T12:00:00.000Z"
              }
            ],
            fail: [],
            meta: {
              status: 200
            }
          }),
          {
            headers: {
              "content-type": "application/json",
              "mc-siem-token": "mimecast-next-token"
            }
          }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "hmacApiKey",
      config: {
        accessKey: "mimecast-access-key",
        applicationId: "mimecast-app-id",
        applicationKey: "mimecast-application-key",
        baseUrl: "https://us-api.mimecast.example.test",
        connectorKey: "mimecast",
        logType: "MTA",
        maxEvents: 10,
        secretKey: Buffer.from("mimecast-secret-key").toString("base64")
      },
      integrationId: "25252525-2525-4252-8252-252525252525",
      mockMode: false,
      tenantId: "26262626-2626-4262-8262-262626262626"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining(["EmailSecurityControl", "EmailThreatBlocked"])
    );
    expect(fetchMock).toHaveBeenCalled();
    expect(
      fetchMock.mock.calls.every((call) => call[1]?.method === "POST")
    ).toBe(true);
    expect(JSON.stringify(liveResult)).not.toContain("mimecast-secret-key");
    expect(JSON.stringify(liveResult)).not.toContain("mimecast-access-key");
    expect(JSON.stringify(liveResult)).not.toContain(
      "mimecast-application-key"
    );
  });

  it("runs Abnormal Security read-only threat-log sync", async () => {
    const connector = getConnectorByKey("abnormal-security");

    expect(connector).toBeDefined();
    expect(connector!.manifest.marketplaceCategory).toBe("Email Security");
    expect(connector!.manifest).toMatchObject({
      availability: "Beta",
      connectable: true,
      product: "Inbound Email Security",
      vendor: "Abnormal Security"
    });
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "bearerToken"]));

    const mockContext = {
      authType: "mock",
      config: {
        connectorKey: "abnormal-security",
        fixtureOutcome: "Blocked",
        mockMode: true
      },
      integrationId: "27272727-2727-4272-8272-272727272727",
      mockMode: true,
      tenantId: "28282828-2828-4282-8282-282828282828"
    };
    const mockResult = await connector!.sync(mockContext);

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets.map((asset) => asset.assetType)).toEqual(
      expect.arrayContaining(["Service"])
    );
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining(["EmailSecurityControl", "EmailThreatBlocked"])
    );
    await expect(
      connector!.observeControl?.(mockContext)
    ).resolves.toMatchObject({
      outcome: "Blocked"
    });

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        const headers = init?.headers as Record<string, string> | undefined;

        expect(init?.method ?? "GET").toBe("GET");
        expect(url).toContain(
          "https://api.abnormalplatform.example.test/v1/threats"
        );
        expect(url).toContain("pageSize=10");
        expect(url).toContain("pageNumber=1");
        expect(url).not.toMatch(
          /\/(remediate|remediation|status|abuse-mailbox|abuse-mailboxes|mailbox|mailboxes|message-actions|move|trash|delete|release|policy|policies|users)(\/|\?|$)/iu
        );
        expect(headers?.authorization).toBe("Bearer abnormal-access-token");

        return new Response(
          JSON.stringify({
            threats: [
              {
                abxMessageId: "abnormal-live-message",
                attackStrategy: "Credential Phishing",
                attackType: "Phishing",
                attackVector: "Link",
                attackedParty: "user@example.invalid",
                autoRemediated: true,
                receivedTime: "2026-06-01T12:00:00.000Z",
                remediationStatus: "Auto Remediated",
                severity: "High",
                threatId: "abnormal-live-threat"
              }
            ]
          }),
          {
            headers: {
              "content-type": "application/json"
            }
          }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "bearerToken",
      config: {
        accessToken: "abnormal-access-token",
        apiBaseUrl: "https://api.abnormalplatform.example.test",
        connectorKey: "abnormal-security",
        maxEvents: 10
      },
      integrationId: "29292929-2929-4292-8292-292929292929",
      mockMode: false,
      tenantId: "30303030-3030-4303-8303-303030303030"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining(["EmailSecurityControl", "EmailThreatBlocked"])
    );
    expect(fetchMock).toHaveBeenCalled();
    expect(
      fetchMock.mock.calls.every((call) => (call[1]?.method ?? "GET") === "GET")
    ).toBe(true);
    expect(JSON.stringify(liveResult)).not.toContain("abnormal-access-token");
  });

  it("runs Google Workspace read-only identity inventory sync", async () => {
    const connector = getConnectorByKey("google-workspace");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(
      expect.arrayContaining(["mock", "oauthAccessToken", "serviceAccount"])
    );

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "google-workspace",
        mockMode: true
      },
      integrationId: "94949494-9494-4949-8949-949494949494",
      mockMode: true,
      tenantId: "95959595-9595-4959-8959-959595959595"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets.map((asset) => asset.assetType)).toEqual(
      expect.arrayContaining(["IdentityStore"])
    );
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "IdentityStore",
        "PrivilegedIdentity",
        "MFAEnabled",
        "MFADisabled",
        "PrivilegedGroup"
      ])
    );

    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048
    });
    const privateKeyPem = privateKey
      .export({
        format: "pem",
        type: "pkcs8"
      })
      .toString();
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);

        if (url === "https://oauth2.googleapis.com/token") {
          expect(init?.method).toBe("POST");
          expect(String(init?.body)).toContain(
            "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer"
          );
          expect(String(init?.body)).toContain("assertion=");
          expect(String(init?.body)).not.toContain(privateKeyPem);

          return new Response(
            JSON.stringify({
              access_token: "google-directory-token"
            })
          );
        }

        expect(init?.method ?? "GET").toBe("GET");
        expect(
          (init?.headers as Record<string, string> | undefined)?.authorization
        ).toBe("Bearer google-directory-token");

        if (url.includes("/users?")) {
          return new Response(
            JSON.stringify({
              users: [
                {
                  id: "gw-live-admin",
                  isAdmin: true,
                  isDelegatedAdmin: false,
                  isEnrolledIn2Sv: true,
                  name: {
                    fullName: "Security Admin"
                  },
                  primaryEmail: "security-admin@example.com",
                  suspended: false
                },
                {
                  id: "gw-live-bot",
                  isAdmin: false,
                  isDelegatedAdmin: false,
                  isEnrolledIn2Sv: false,
                  name: {
                    fullName: "Build Bot"
                  },
                  primaryEmail: "build-bot@example.com",
                  suspended: false
                }
              ]
            })
          );
        }

        if (url.includes("/groups?")) {
          return new Response(
            JSON.stringify({
              groups: [
                {
                  email: "workspace-admins@example.com",
                  id: "gw-live-group-admins",
                  name: "Workspace Administrators"
                }
              ]
            })
          );
        }

        return new Response(JSON.stringify({ error: "not found" }), {
          status: 404
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "serviceAccount",
      config: {
        clientEmail: "periscan@workspace-project.iam.gserviceaccount.com",
        connectorKey: "google-workspace",
        customerId: "C123456",
        delegatedAdminEmail: "security@example.com",
        privateKey: privateKeyPem
      },
      integrationId: "96969696-9696-4969-8969-969696969696",
      mockMode: false,
      tenantId: "97979797-9797-4979-8979-979797979797"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets.map((asset) => asset.assetType)).toEqual(
      expect.arrayContaining(["IdentityStore"])
    );
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "IdentityStore",
        "PrivilegedIdentity",
        "MFAEnabled",
        "MFADisabled",
        "PrivilegedGroup"
      ])
    );
    expect(
      fetchMock.mock.calls
        .filter(
          (call) => String(call[0]) !== "https://oauth2.googleapis.com/token"
        )
        .every((call) => (call[1]?.method ?? "GET") === "GET")
    ).toBe(true);
    expect(JSON.stringify(liveResult)).not.toContain(privateKeyPem);
    expect(JSON.stringify(liveResult)).not.toContain("google-directory-token");
  });

  it("runs GitHub PAT metadata sync without storing repository contents", async () => {
    const connector = getConnectorByKey("github");
    const fetchMock = vi.fn(async (url: string | URL) => {
      const pathname = String(url).replace("https://api.github.test", "");

      if (pathname === "/user") {
        return new Response(JSON.stringify({ login: "periscan-app" }));
      }

      if (pathname === "/repos/acme/api") {
        return new Response(
          JSON.stringify({
            archived: false,
            default_branch: "main",
            full_name: "acme/api",
            owner: { login: "acme" },
            permissions: { admin: false, pull: true, push: true },
            private: true,
            visibility: "private"
          })
        );
      }

      if (pathname === "/repos/acme/api/branches/main/protection") {
        return new Response(JSON.stringify({ required_status_checks: {} }));
      }

      return new Response(JSON.stringify({ message: "not found" }), {
        status: 404
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    expect(connector).toBeDefined();

    const result = await connector!.sync({
      authType: "pat",
      config: {
        accessToken: "ghp_test_token",
        apiBaseUrl: "https://api.github.test",
        repositoryFullNames: ["acme/api"]
      },
      integrationId: "71717171-7171-4717-8717-717171717171",
      mockMode: false,
      tenantId: "72727272-7272-4727-8727-727272727272"
    });

    expect(result.health).toMatchObject({
      authorizationVerified: true,
      status: "Healthy"
    });
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0]).toMatchObject({
      assetType: "Repository",
      name: "acme/api"
    });
    expect(result.signals.map((signal) => signal.signalSubcategory)).toEqual(
      expect.arrayContaining([
        "Repository",
        "BranchProtection",
        "RepoPermission"
      ])
    );
    expect(
      result.signals.map((signal) => signal.signalSubcategory)
    ).not.toContain("SecretScanCandidate");
    expect(JSON.stringify(result)).not.toContain("ghp_test_token");
  });

  it("delivers Slack workflow events through mock and webhook modes", async () => {
    const connector = getConnectorByKey("slack");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "webhook"]));

    const mockDelivery = await connector!.sendWorkflowEvent!({
      authType: "mock",
      config: {
        connectorKey: "slack",
        mockMode: true,
        workflowEvent: {
          evidenceIds: ["81818181-8181-4818-8818-818181818181"],
          missionId: "82828282-8282-4828-8828-828282828282",
          summary: "Dependency advisory trigger approved.",
          title: "Periscan trigger approval",
          triggerId: "trigger.cve"
        }
      },
      integrationId: "83838383-8383-4838-8838-838383838383",
      mockMode: true,
      tenantId: "84848484-8484-4848-8848-848484848484"
    });

    expect(mockDelivery).toMatchObject({
      destination: "Slack",
      mode: "mock",
      status: "Delivered"
    });
    expect(JSON.stringify(mockDelivery)).toContain("trigger.cve");

    const fetchMock = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);

    const liveDelivery = await connector!.sendWorkflowEvent!({
      authType: "webhook",
      config: {
        channel: "#security-validation",
        connectorKey: "slack",
        webhookUrl: "https://hooks.slack.test/services/T000/B000/secret",
        workflowEvent: {
          missionId: "85858585-8585-4858-8858-858585858585",
          summary: "A policy-gated draft mission is ready for review.",
          title: "Periscan validation recommendation",
          triggerId: "trigger.policy_change"
        }
      },
      integrationId: "86868686-8686-4868-8868-868686868686",
      mockMode: false,
      tenantId: "87878787-8787-4878-8878-878787878787"
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://hooks.slack.test/services/T000/B000/secret",
      expect.objectContaining({
        method: "POST"
      })
    );
    expect(liveDelivery).toMatchObject({
      destination: "Slack",
      mode: "webhook",
      status: "Delivered"
    });
    expect(JSON.stringify(liveDelivery)).not.toContain(
      "hooks.slack.test/services"
    );

    const health = await connector!.healthCheck({
      authType: "webhook",
      config: {
        connectorKey: "slack",
        webhookUrl: "https://hooks.slack.test/services/T000/B000/secret"
      },
      integrationId: "88888888-8888-4888-8888-888888888888",
      mockMode: false,
      tenantId: "89898989-8989-4989-8989-898989898989"
    });

    expect(health).toMatchObject({
      authorizationVerified: false,
      status: "Unknown"
    });
  });

  it("does not emit fixture Slack workflow signals during live webhook sync", async () => {
    const connector = getConnectorByKey("slack");

    expect(connector).toBeDefined();

    const result = await connector!.sync!({
      authType: "webhook",
      config: {
        channel: "#security-validation",
        connectorKey: "slack",
        webhookUrl: "https://hooks.slack.test/services/T000/B000/secret"
      },
      integrationId: "89898989-8989-4989-8989-898989898989",
      mockMode: false,
      tenantId: "90909090-9090-4909-8909-909090909090"
    });

    expect(result).toMatchObject({
      assets: [],
      health: {
        authorizationVerified: false,
        status: "Unknown"
      },
      signals: []
    });
    expect(JSON.stringify(result)).not.toContain("hooks.slack.test/services");
  });

  it("delivers Microsoft Teams workflow events through mock and webhook modes", async () => {
    const connector = getConnectorByKey("microsoft-teams");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "webhook"]));

    const mockDelivery = await connector!.sendWorkflowEvent!({
      authType: "mock",
      config: {
        connectorKey: "microsoft-teams",
        mockMode: true,
        workflowEvent: {
          evidenceIds: ["73737373-7373-4737-8737-737373737373"],
          missionId: "74747474-7474-4747-8747-747474747474",
          summary: "Dependency advisory trigger approved.",
          title: "Periscan trigger approval",
          triggerId: "trigger.cve"
        }
      },
      integrationId: "75757575-7575-4757-8757-757575757575",
      mockMode: true,
      tenantId: "76767676-7676-4767-8767-767676767676"
    });

    expect(mockDelivery).toMatchObject({
      destination: "Microsoft Teams",
      mode: "mock",
      status: "Delivered"
    });
    expect(JSON.stringify(mockDelivery)).toContain("trigger.cve");

    const fetchMock = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) => {
        void _input;
        void _init;

        return new Response("1");
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveDelivery = await connector!.sendWorkflowEvent!({
      authType: "webhook",
      config: {
        channelName: "Security Validation",
        connectorKey: "microsoft-teams",
        themeColor: "0F766E",
        webhookUrl:
          "https://outlook.office.com/webhook/tenant/group/IncomingWebhook/secret",
        workflowEvent: {
          evidenceIds: ["77777777-7777-4777-8777-777777777777"],
          missionId: "78787878-7878-4787-8787-787878787878",
          summary: "A policy-gated draft mission is ready for review.",
          title: "Periscan validation recommendation",
          triggerId: "trigger.policy_change"
        }
      },
      integrationId: "79797979-7979-4797-8797-797979797979",
      mockMode: false,
      tenantId: "80808080-8080-4808-8808-808080808080"
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://outlook.office.com/webhook/tenant/group/IncomingWebhook/secret",
      expect.objectContaining({
        method: "POST"
      })
    );

    const requestInit = fetchMock.mock.calls[0]?.[1];

    expect(requestInit).toBeDefined();

    const body = JSON.parse(requestInit!.body as string) as {
      sections: Array<{ facts: Array<{ name: string; value: string }> }>;
      themeColor: string;
      title: string;
    };

    expect(body.title).toBe("Periscan validation recommendation");
    expect(body.themeColor).toBe("0F766E");
    expect(body.sections[0]?.facts).toEqual(
      expect.arrayContaining([
        {
          name: "Evidence IDs",
          value: "77777777-7777-4777-8777-777777777777"
        }
      ])
    );
    expect(liveDelivery).toMatchObject({
      destination: "Microsoft Teams",
      mode: "webhook",
      status: "Delivered"
    });
    expect(JSON.stringify(liveDelivery)).not.toContain(
      "outlook.office.com/webhook"
    );

    const health = await connector!.healthCheck({
      authType: "webhook",
      config: {
        connectorKey: "microsoft-teams",
        webhookUrl:
          "https://outlook.office.com/webhook/tenant/group/IncomingWebhook/secret"
      },
      integrationId: "81818181-8181-4818-8818-818181818181",
      mockMode: false,
      tenantId: "82828282-8282-4828-8828-828282828282"
    });

    expect(health).toMatchObject({
      authorizationVerified: false,
      status: "Unknown"
    });
  });

  it("does not emit fixture Microsoft Teams workflow signals during live webhook sync", async () => {
    const connector = getConnectorByKey("microsoft-teams");

    expect(connector).toBeDefined();

    const result = await connector!.sync!({
      authType: "webhook",
      config: {
        channelName: "Security Validation",
        connectorKey: "microsoft-teams",
        webhookUrl:
          "https://outlook.office.com/webhook/tenant/group/IncomingWebhook/secret"
      },
      integrationId: "83838383-8383-4838-8838-838383838383",
      mockMode: false,
      tenantId: "84848484-8484-4848-8848-848484848484"
    });

    expect(result).toMatchObject({
      assets: [],
      health: {
        authorizationVerified: false,
        status: "Unknown"
      },
      signals: []
    });
    expect(JSON.stringify(result)).not.toContain("outlook.office.com/webhook");
  });

  it("delivers Jira workflow events through mock and API token modes", async () => {
    const connector = getConnectorByKey("jira");

    expect(connector).toBeDefined();
    expect(connector?.sendWorkflowEvent).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiToken"]));

    const mockDelivery = await connector!.sendWorkflowEvent!({
      authType: "mock",
      config: {
        connectorKey: "jira",
        mockMode: true,
        workflowEvent: {
          evidenceIds: ["81818181-8181-4818-8818-818181818181"],
          remediationId: "82828282-8282-4828-8828-828282828282",
          summary: "Rotate the exposed credential and verify the path closes.",
          title: "Periscan remediation"
        }
      },
      integrationId: "83838383-8383-4838-8838-838383838383",
      mockMode: true,
      tenantId: "84848484-8484-4848-8848-848484848484"
    });

    expect(mockDelivery).toMatchObject({
      destination: "Jira",
      mode: "mock",
      status: "Delivered"
    });

    const fetchMock = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) => {
        void _input;
        void _init;

        return new Response(JSON.stringify({ id: "10001", key: "SEC-42" }), {
          headers: {
            "content-type": "application/json"
          },
          status: 201
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveDelivery = await connector!.sendWorkflowEvent!({
      authType: "apiToken",
      config: {
        apiToken: "jira-secret-token",
        connectorKey: "jira",
        email: "security@example.com",
        issueType: "Task",
        projectKey: "SEC",
        siteUrl: "https://periscan.atlassian.net",
        workflowEvent: {
          evidenceIds: ["85858585-8585-4858-8858-858585858585"],
          missionId: "86868686-8686-4868-8868-868686868686",
          summary: "A policy-gated validation mission is ready for review.",
          title: "Periscan validation recommendation"
        }
      },
      integrationId: "87878787-8787-4878-8878-878787878787",
      mockMode: false,
      tenantId: "88888888-8888-4888-8888-888888888888"
    });

    expect(liveDelivery).toMatchObject({
      destination: "Jira",
      mode: "apiToken",
      status: "Delivered",
      ticketId: "SEC-42"
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://periscan.atlassian.net/rest/api/3/issue",
      expect.objectContaining({
        method: "POST"
      })
    );

    const requestInit = fetchMock.mock.calls[0]?.[1];

    expect(requestInit).toBeDefined();

    const headers = requestInit!.headers as Record<string, string>;
    const body = JSON.parse(requestInit!.body as string) as {
      fields: {
        description: {
          content: Array<{ content: Array<{ text: string }> }>;
        };
        project: { key: string };
        summary: string;
      };
    };

    expect(headers.authorization).toMatch(/^Basic /u);
    expect(body.fields.project.key).toBe("SEC");
    expect(body.fields.summary).toBe("Periscan validation recommendation");
    expect(body.fields.description.content[0]?.content[0]?.text).toContain(
      "Evidence IDs: 85858585-8585-4858-8858-858585858585"
    );
    expect(JSON.stringify(liveDelivery)).not.toContain("jira-secret-token");
  });

  it("delivers GitHub Issues workflow events through mock and PAT modes", async () => {
    const connector = getConnectorByKey("github-issues");

    expect(connector).toBeDefined();
    expect(connector?.sendWorkflowEvent).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "pat"]));

    const mockDelivery = await connector!.sendWorkflowEvent!({
      authType: "mock",
      config: {
        connectorKey: "github-issues",
        mockMode: true,
        workflowEvent: {
          evidenceIds: ["91919191-9191-4919-8919-919191919191"],
          remediationId: "92929292-9292-4929-8929-929292929292",
          summary: "Rotate the exposed credential and verify the path closes.",
          title: "Periscan remediation"
        }
      },
      integrationId: "93939393-9393-4939-8939-939393939393",
      mockMode: true,
      tenantId: "94949494-9494-4949-8949-949494949494"
    });

    expect(mockDelivery).toMatchObject({
      destination: "GitHub Issues",
      mode: "mock",
      status: "Delivered"
    });

    const fetchMock = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) => {
        void _input;
        void _init;

        return new Response(
          JSON.stringify({
            html_url: "https://github.com/periscan-fixtures/demo-app/issues/42",
            number: 42
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 201
          }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveDelivery = await connector!.sendWorkflowEvent!({
      authType: "pat",
      config: {
        accessToken: "github-issues-secret-token",
        connectorKey: "github-issues",
        labels: ["periscan", "remediation"],
        repositoryFullName: "periscan-fixtures/demo-app",
        workflowEvent: {
          evidenceIds: ["95959595-9595-4959-8959-959595959595"],
          missionId: "96969696-9696-4969-8969-969696969696",
          summary: "A policy-gated validation mission is ready for review.",
          title: "Periscan validation recommendation"
        }
      },
      integrationId: "97979797-9797-4979-8979-979797979797",
      mockMode: false,
      tenantId: "98989898-9898-4989-8989-989898989898"
    });

    expect(liveDelivery).toMatchObject({
      destination: "GitHub Issues",
      mode: "pat",
      status: "Delivered",
      ticketId: "#42"
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/periscan-fixtures/demo-app/issues",
      expect.objectContaining({
        method: "POST"
      })
    );

    const requestInit = fetchMock.mock.calls[0]?.[1];

    expect(requestInit).toBeDefined();

    const headers = requestInit!.headers as Record<string, string>;
    const body = JSON.parse(requestInit!.body as string) as {
      body: string;
      labels: string[];
      title: string;
    };

    expect(headers.authorization).toBe("Bearer github-issues-secret-token");
    expect(body.labels).toEqual(["periscan", "remediation"]);
    expect(body.title).toBe("Periscan validation recommendation");
    expect(body.body).toContain(
      "Evidence IDs: 95959595-9595-4959-8959-959595959595"
    );
    expect(JSON.stringify(liveDelivery)).not.toContain(
      "github-issues-secret-token"
    );
  });

  it("delivers Linear workflow events through mock and API key modes", async () => {
    const connector = getConnectorByKey("linear");

    expect(connector).toBeDefined();
    expect(connector?.sendWorkflowEvent).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiKey"]));

    const mockDelivery = await connector!.sendWorkflowEvent!({
      authType: "mock",
      config: {
        connectorKey: "linear",
        mockMode: true,
        workflowEvent: {
          evidenceIds: ["30303030-3030-4303-8303-303030303030"],
          remediationId: "31313131-3131-4313-8313-313131313131",
          summary: "Rotate the exposed credential and verify the path closes.",
          title: "Periscan remediation"
        }
      },
      integrationId: "32323232-3232-4323-8323-323232323232",
      mockMode: true,
      tenantId: "33333333-3333-4333-8333-333333333333"
    });

    expect(mockDelivery).toMatchObject({
      destination: "Linear",
      mode: "mock",
      status: "Delivered"
    });

    const fetchMock = vi.fn(
      async (_input: string | URL | Request, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as {
          query: string;
          variables?: {
            input?: {
              description: string;
              labelIds: string[];
              teamId: string;
              title: string;
            };
          };
        };

        if (body.query.includes("viewer")) {
          return new Response(
            JSON.stringify({
              data: {
                viewer: {
                  id: "linear-user-1",
                  name: "Security Bot"
                }
              }
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        expect(body.variables?.input).toMatchObject({
          labelIds: ["label-security"],
          teamId: "team-security",
          title: "Periscan validation recommendation"
        });
        expect(body.variables?.input?.description).toContain(
          "Evidence IDs: 34343434-3434-4343-8343-343434343434"
        );

        return new Response(
          JSON.stringify({
            data: {
              issueCreate: {
                issue: {
                  identifier: "SEC-42",
                  url: "https://linear.app/periscan/issue/SEC-42"
                },
                success: true
              }
            }
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const health = await connector!.healthCheck({
      authType: "apiKey",
      config: {
        apiKey: "linear-secret-api-key",
        connectorKey: "linear",
        teamId: "team-security"
      },
      integrationId: "35353535-3535-4353-8353-353535353535",
      mockMode: false,
      tenantId: "36363636-3636-4363-8363-363636363636"
    });
    const liveDelivery = await connector!.sendWorkflowEvent!({
      authType: "apiKey",
      config: {
        apiKey: "linear-secret-api-key",
        connectorKey: "linear",
        labelIds: ["label-security"],
        teamId: "team-security",
        workflowEvent: {
          evidenceIds: ["34343434-3434-4343-8343-343434343434"],
          missionId: "37373737-3737-4373-8373-373737373737",
          summary: "A policy-gated validation mission is ready for review.",
          title: "Periscan validation recommendation"
        }
      },
      integrationId: "38383838-3838-4383-8383-383838383838",
      mockMode: false,
      tenantId: "39393939-3939-4393-8393-393939393939"
    });

    expect(health).toMatchObject({
      authorizationVerified: true,
      status: "Healthy"
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.linear.app/graphql",
      expect.objectContaining({
        method: "POST"
      })
    );
    expect(liveDelivery).toMatchObject({
      destination: "Linear",
      mode: "apiKey",
      status: "Delivered",
      ticketId: "SEC-42"
    });
    expect(JSON.stringify(liveDelivery)).not.toContain("linear-secret-api-key");
  });

  it("routes PagerDuty workflow events through mock and Events API modes", async () => {
    const connector = getConnectorByKey("pagerduty");

    expect(connector).toBeDefined();
    expect(connector?.sendWorkflowEvent).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "eventsApi"]));

    const mockDelivery = await connector!.sendWorkflowEvent!({
      authType: "mock",
      config: {
        connectorKey: "pagerduty",
        mockMode: true,
        workflowEvent: {
          evidenceIds: ["40404040-4040-4404-8404-404040404040"],
          remediationId: "41414141-4141-4414-8414-414141414141",
          summary: "Escalate a missed control validation.",
          title: "Periscan control validation missed"
        }
      },
      integrationId: "42424242-4242-4424-8424-424242424242",
      mockMode: true,
      tenantId: "43434343-4343-4434-8434-434343434343"
    });

    expect(mockDelivery).toMatchObject({
      destination: "PagerDuty",
      mode: "mock",
      status: "Delivered"
    });

    const fetchMock = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) => {
        void _input;
        void _init;

        return new Response(
          JSON.stringify({
            dedup_key: "periscan:44444444-4444-4444-8444-444444444444",
            message: "Event processed",
            status: "success"
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 202
          }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const health = await connector!.healthCheck({
      authType: "eventsApi",
      config: {
        connectorKey: "pagerduty",
        routingKey: "pagerduty-secret-routing-key"
      },
      integrationId: "45454545-4545-4454-8454-454545454545",
      mockMode: false,
      tenantId: "46464646-4646-4464-8464-464646464646"
    });
    const liveDelivery = await connector!.sendWorkflowEvent!({
      authType: "eventsApi",
      config: {
        connectorKey: "pagerduty",
        routingKey: "pagerduty-secret-routing-key",
        severity: "critical",
        source: "periscan-cloud",
        workflowEvent: {
          evidenceIds: ["47474747-4747-4474-8474-474747474747"],
          missionId: "44444444-4444-4444-8444-444444444444",
          policyDecisionId: "48484848-4848-4484-8484-484848484848",
          summary: "A policy-gated validation mission is ready for review.",
          title: "Periscan validation escalation"
        }
      },
      integrationId: "49494949-4949-4494-8494-494949494949",
      mockMode: false,
      tenantId: "50505050-5050-4505-8505-505050505050"
    });

    expect(health).toMatchObject({
      authorizationVerified: false,
      status: "Unknown"
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://events.pagerduty.com/v2/enqueue",
      expect.objectContaining({
        method: "POST"
      })
    );

    const requestInit = fetchMock.mock.calls[0]?.[1];

    expect(requestInit).toBeDefined();

    const body = JSON.parse(String(requestInit!.body)) as {
      payload: {
        custom_details: {
          evidenceIds: string[];
          missionId: string;
          policyDecisionId: string;
        };
        severity: string;
        source: string;
        summary: string;
      };
      routing_key: string;
    };

    expect(body.routing_key).toBe("pagerduty-secret-routing-key");
    expect(body.payload).toMatchObject({
      severity: "critical",
      source: "periscan-cloud",
      summary: "Periscan validation escalation"
    });
    expect(body.payload.custom_details).toMatchObject({
      evidenceIds: ["47474747-4747-4474-8474-474747474747"],
      missionId: "44444444-4444-4444-8444-444444444444",
      policyDecisionId: "48484848-4848-4484-8484-484848484848"
    });
    expect(liveDelivery).toMatchObject({
      destination: "PagerDuty",
      mode: "eventsApi",
      status: "Delivered",
      ticketId: "periscan:44444444-4444-4444-8444-444444444444"
    });
    expect(JSON.stringify(liveDelivery)).not.toContain(
      "pagerduty-secret-routing-key"
    );
  });

  it("routes Opsgenie workflow alerts through mock and API key modes", async () => {
    const connector = getConnectorByKey("opsgenie");

    expect(connector).toBeDefined();
    expect(connector?.sendWorkflowEvent).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiKey"]));

    const mockDelivery = await connector!.sendWorkflowEvent!({
      authType: "mock",
      config: {
        connectorKey: "opsgenie",
        mockMode: true,
        workflowEvent: {
          evidenceIds: ["51515151-5151-4515-8515-515151515151"],
          remediationId: "52525252-5252-4525-8525-525252525252",
          summary: "Route an urgent validation escalation.",
          title: "Periscan urgent validation alert"
        }
      },
      integrationId: "53535353-5353-4535-8535-535353535353",
      mockMode: true,
      tenantId: "54545454-5454-4545-8545-545454545454"
    });

    expect(mockDelivery).toMatchObject({
      destination: "Opsgenie",
      mode: "mock",
      status: "Delivered"
    });

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        void init;
        const url = String(input);

        if (url.endsWith("/v2/account")) {
          return new Response(
            JSON.stringify({
              data: {
                name: "Periscan Ops"
              }
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        return new Response(
          JSON.stringify({
            requestId: "opsgenie-request-42",
            result: "Request will be processed"
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 202
          }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const health = await connector!.healthCheck({
      authType: "apiKey",
      config: {
        apiKey: "opsgenie-secret-api-key",
        connectorKey: "opsgenie"
      },
      integrationId: "55555555-5555-4555-8555-555555555555",
      mockMode: false,
      tenantId: "56565656-5656-4565-8565-565656565656"
    });
    const liveDelivery = await connector!.sendWorkflowEvent!({
      authType: "apiKey",
      config: {
        apiKey: "opsgenie-secret-api-key",
        connectorKey: "opsgenie",
        priority: "P1",
        source: "periscan-cloud",
        tags: ["periscan", "validation"],
        workflowEvent: {
          evidenceIds: ["57575757-5757-4575-8575-575757575757"],
          missionId: "58585858-5858-4585-8585-585858585858",
          policyDecisionId: "59595959-5959-4595-8595-595959595959",
          summary: "A policy-gated validation mission is ready for review.",
          title: "Periscan validation escalation"
        }
      },
      integrationId: "60606060-6060-4606-8606-606060606060",
      mockMode: false,
      tenantId: "61616161-6161-4616-8616-616161616161"
    });

    expect(health).toMatchObject({
      authorizationVerified: true,
      status: "Healthy"
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.opsgenie.com/v2/alerts",
      expect.objectContaining({
        method: "POST"
      })
    );

    const requestInit = fetchMock.mock.calls[1]?.[1];

    expect(requestInit).toBeDefined();

    const headers = requestInit!.headers as Record<string, string>;
    const body = JSON.parse(String(requestInit!.body)) as {
      details: {
        evidenceIds: string;
        missionId: string;
        policyDecisionId: string;
      };
      message: string;
      priority: string;
      source: string;
      tags: string[];
    };

    expect(headers.authorization).toBe("GenieKey opsgenie-secret-api-key");
    expect(body).toMatchObject({
      message: "Periscan validation escalation",
      priority: "P1",
      source: "periscan-cloud",
      tags: ["periscan", "validation"]
    });
    expect(body.details).toMatchObject({
      evidenceIds: "57575757-5757-4575-8575-575757575757",
      missionId: "58585858-5858-4585-8585-585858585858",
      policyDecisionId: "59595959-5959-4595-8595-595959595959"
    });
    expect(liveDelivery).toMatchObject({
      destination: "Opsgenie",
      mode: "apiKey",
      status: "Delivered",
      ticketId: "opsgenie-request-42"
    });
    expect(JSON.stringify(liveDelivery)).not.toContain(
      "opsgenie-secret-api-key"
    );
  });

  it("delivers ServiceNow workflow events through mock and Table API modes", async () => {
    const connector = getConnectorByKey("servicenow");

    expect(connector).toBeDefined();
    expect(connector?.sendWorkflowEvent).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "basicAuth"]));

    const mockDelivery = await connector!.sendWorkflowEvent!({
      authType: "mock",
      config: {
        connectorKey: "servicenow",
        mockMode: true,
        workflowEvent: {
          evidenceIds: ["11111111-2222-4333-8444-555555555555"],
          remediationId: "22222222-3333-4444-8555-666666666666",
          summary: "Restrict the public security group and verify closure.",
          title: "Periscan remediation"
        }
      },
      integrationId: "23232323-2323-4232-8232-232323232323",
      mockMode: true,
      tenantId: "24242424-2424-4242-8424-242424242424"
    });

    expect(mockDelivery).toMatchObject({
      destination: "ServiceNow",
      mode: "mock",
      status: "Delivered"
    });

    const fetchMock = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) => {
        void _input;
        void _init;

        return new Response(
          JSON.stringify({
            result: {
              number: "INC0012345",
              sys_id: "sys-123"
            }
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 201
          }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveDelivery = await connector!.sendWorkflowEvent!({
      authType: "basicAuth",
      config: {
        assignmentGroup: "Security Operations",
        connectorKey: "servicenow",
        instanceUrl: "https://periscan.service-now.com",
        password: "servicenow-secret-password",
        ticketTable: "incident",
        username: "periscan-api",
        workflowEvent: {
          evidenceIds: ["33333333-4444-4555-8666-777777777777"],
          missionId: "44444444-5555-4666-8777-888888888888",
          summary: "A policy-gated validation mission is ready for review.",
          title: "Periscan validation recommendation"
        }
      },
      integrationId: "25252525-2525-4252-8252-252525252525",
      mockMode: false,
      tenantId: "26262626-2626-4262-8262-262626262626"
    });

    expect(liveDelivery).toMatchObject({
      destination: "ServiceNow",
      mode: "basicAuth",
      status: "Delivered",
      ticketId: "INC0012345"
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://periscan.service-now.com/api/now/table/incident",
      expect.objectContaining({
        method: "POST"
      })
    );

    const requestInit = fetchMock.mock.calls[0]?.[1];

    expect(requestInit).toBeDefined();

    const headers = requestInit!.headers as Record<string, string>;
    const body = JSON.parse(requestInit!.body as string) as {
      assignment_group?: string;
      description: string;
      short_description: string;
    };

    expect(headers.authorization).toMatch(/^Basic /u);
    expect(body.assignment_group).toBe("Security Operations");
    expect(body.short_description).toBe("Periscan validation recommendation");
    expect(body.description).toContain(
      "Evidence IDs: 33333333-4444-4555-8666-777777777777"
    );
    expect(JSON.stringify(liveDelivery)).not.toContain(
      "servicenow-secret-password"
    );
  });

  it("runs ConnectWise Manage sync and workflow delivery through API key mode", async () => {
    const connector = getConnectorByKey("connectwise-manage");

    expect(connector).toBeDefined();
    expect(connector?.sendWorkflowEvent).toBeDefined();
    expect(connector!.manifest).toMatchObject({
      availability: "Beta",
      category: "MSSP",
      connectable: true,
      marketplaceCategory: "MSSP/PSA/RMM",
      product: "ConnectWise Manage"
    });
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiKey"]));

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "connectwise-manage",
        mockMode: true
      },
      integrationId: "abababab-abab-4bab-8bab-abababababab",
      mockMode: true,
      tenantId: "bcbcbcbc-bcbc-4bcb-8bcb-bcbcbcbcbcbc"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets.map((asset) => asset.assetType)).toEqual(
      expect.arrayContaining(["Other"])
    );
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "ConnectWiseCompanyObserved",
        "ConnectWiseTicketObserved",
        "ConnectWiseOpenTicketObserved"
      ])
    );

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const parsedUrl = new URL(String(input));

        expect(parsedUrl.origin).toBe("https://manage.example.com");
        expect(init?.headers).toMatchObject({
          accept: "application/json",
          authorization: expect.stringMatching(/^Basic /u),
          "x-cw-clientid": "connectwise-client-id"
        });
        expect(parsedUrl.pathname).not.toMatch(
          /\/(?:config|setup|invoice|agreement|project|device|agent|delete|update|execute)(?:\/|$)/iu
        );

        if (parsedUrl.pathname === "/apis/3.0/system/info") {
          expect(init?.method).toBe("GET");

          return new Response(JSON.stringify({ version: "2026.1" }), {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          });
        }

        if (parsedUrl.pathname === "/apis/3.0/company/companies") {
          expect(init?.method).toBe("GET");
          expect(init).not.toHaveProperty("body");

          return new Response(
            JSON.stringify([
              {
                id: 201,
                identifier: "CLIENT",
                name: "Client Co",
                status: {
                  name: "Active"
                },
                type: {
                  name: "Managed Services"
                }
              }
            ]),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (parsedUrl.pathname === "/apis/3.0/service/tickets") {
          if (init?.method === "POST") {
            const body = JSON.parse(String(init.body)) as {
              company?: {
                id: number;
              };
              initialDescription: string;
              summary: string;
            };

            expect(body.summary).toBe("Periscan remediation");
            expect(body.company?.id).toBe(201);
            expect(body.initialDescription).toContain(
              "Evidence IDs: cccccccc-cccc-4ccc-8ccc-cccccccccccc"
            );

            return new Response(JSON.stringify({ id: 9001 }), {
              headers: {
                "content-type": "application/json"
              },
              status: 201
            });
          }

          expect(init?.method).toBe("GET");
          expect(init).not.toHaveProperty("body");

          return new Response(
            JSON.stringify([
              {
                board: {
                  name: "Security"
                },
                company: {
                  name: "Client Co"
                },
                id: 7001,
                lastUpdated: "2026-06-03T12:00:00Z",
                priority: {
                  name: "High"
                },
                status: {
                  name: "New"
                },
                summary: "Review Periscan validation"
              }
            ]),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        return new Response(JSON.stringify({}), {
          headers: {
            "content-type": "application/json"
          },
          status: 404
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "apiKey",
      config: {
        apiBaseUrl: "https://manage.example.com/apis/3.0",
        clientId: "connectwise-client-id",
        companyId: "periscan",
        connectorKey: "connectwise-manage",
        privateKey: "connectwise-private-key",
        publicKey: "connectwise-public-key"
      },
      integrationId: "cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd",
      mockMode: false,
      tenantId: "dededede-dede-4ede-8ede-dededededede"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "ConnectWiseCompanyObserved",
        "ConnectWiseTicketObserved",
        "ConnectWiseOpenTicketObserved"
      ])
    );

    const liveDelivery = await connector!.sendWorkflowEvent!({
      authType: "apiKey",
      config: {
        apiBaseUrl: "https://manage.example.com/apis/3.0",
        clientId: "connectwise-client-id",
        companyId: "periscan",
        connectorKey: "connectwise-manage",
        defaultTicketCompanyId: 201,
        privateKey: "connectwise-private-key",
        publicKey: "connectwise-public-key",
        workflowEvent: {
          evidenceIds: ["cccccccc-cccc-4ccc-8ccc-cccccccccccc"],
          remediationId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          summary: "Rotate the exposed key and rerun verification.",
          title: "Periscan remediation"
        }
      },
      integrationId: "efefefef-efef-4fef-8fef-efefefefefef",
      mockMode: false,
      tenantId: "f0f0f0f0-f0f0-40f0-80f0-f0f0f0f0f0f0"
    });

    expect(liveDelivery).toMatchObject({
      destination: "ConnectWise Manage",
      mode: "apiKey",
      status: "Delivered",
      ticketId: "CW-9001"
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(JSON.stringify(liveResult)).not.toContain("connectwise-private-key");
    expect(JSON.stringify(liveDelivery)).not.toContain(
      "connectwise-private-key"
    );
  });

  it("runs NinjaOne sync through read-only organization, device, and alert endpoints", async () => {
    const connector = getConnectorByKey("ninjaone");

    expect(connector).toBeDefined();
    expect(connector!.manifest).toMatchObject({
      availability: "Beta",
      category: "MSSP",
      connectable: true,
      marketplaceCategory: "MSSP/PSA/RMM",
      product: "NinjaOne"
    });
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "accessToken"]));

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "ninjaone",
        mockMode: true
      },
      integrationId: "12121212-1212-4212-8212-121212121212",
      mockMode: true,
      tenantId: "13131313-1313-4313-8313-131313131313"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets.map((asset) => asset.assetType)).toEqual(
      expect.arrayContaining(["Other", "Host"])
    );
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "NinjaOneOrganizationObserved",
        "NinjaOneDeviceObserved",
        "NinjaOneOfflineDeviceObserved",
        "NinjaOneAlertObserved",
        "NinjaOneCriticalOpenAlertObserved"
      ])
    );

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const parsedUrl = new URL(String(input));

        expect(parsedUrl.origin).toBe("https://app.ninjarmm.com");
        expect(init?.method).toBe("GET");
        expect(init).not.toHaveProperty("body");
        expect(init?.headers).toMatchObject({
          accept: "application/json",
          authorization: "Bearer ninjaone-secret-token"
        });
        expect(parsedUrl.pathname).not.toMatch(
          /\/(?:action|script|automation|patch|remote|ticket|policy|archive|delete|reset|run|execute)(?:\/|$)/iu
        );

        if (parsedUrl.pathname === "/v2/organizations") {
          return new Response(
            JSON.stringify([
              {
                id: 301,
                name: "Acme Manufacturing"
              },
              {
                id: 302,
                name: "Northwind Labs"
              }
            ]),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (parsedUrl.pathname === "/v2/devices") {
          return new Response(
            JSON.stringify([
              {
                approvalStatus: "approved",
                displayName: "acme-dc-01",
                id: 501,
                online: false,
                organization: {
                  id: 301,
                  name: "Acme Manufacturing"
                },
                os: {
                  name: "Windows Server 2022"
                },
                status: "offline",
                type: "WINDOWS_SERVER"
              },
              {
                approvalStatus: "approved",
                displayName: "northwind-laptop-14",
                id: 502,
                online: true,
                organization: {
                  id: 302,
                  name: "Northwind Labs"
                },
                os: {
                  name: "Windows 11"
                },
                status: "online",
                type: "WINDOWS_WORKSTATION"
              }
            ]),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (parsedUrl.pathname === "/v2/device/501/alerts") {
          return new Response(
            JSON.stringify([
              {
                id: "alert-501",
                message: "Endpoint protection service stopped",
                severity: "critical",
                status: "open",
                timestamp: "2026-06-04T12:00:00Z"
              }
            ]),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (parsedUrl.pathname === "/v2/device/502/alerts") {
          return new Response(JSON.stringify([]), {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          });
        }

        return new Response(JSON.stringify({}), {
          headers: {
            "content-type": "application/json"
          },
          status: 404
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "accessToken",
      config: {
        accessToken: "ninjaone-secret-token",
        apiBaseUrl: "https://app.ninjarmm.com",
        connectorKey: "ninjaone",
        organizationIds: [301, 302],
        pageSize: 25
      },
      integrationId: "14141414-1414-4414-8414-141414141414",
      mockMode: false,
      tenantId: "15151515-1515-4515-8515-151515151515"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "NinjaOneOrganizationObserved",
        "NinjaOneDeviceObserved",
        "NinjaOneOfflineDeviceObserved",
        "NinjaOneAlertObserved",
        "NinjaOneCriticalOpenAlertObserved"
      ])
    );
    expect(JSON.stringify(liveResult)).not.toContain("ninjaone-secret-token");
  });

  it("runs HaloPSA sync and workflow delivery through OAuth client credentials", async () => {
    const connector = getConnectorByKey("halopsa");

    expect(connector).toBeDefined();
    expect(connector?.sendWorkflowEvent).toBeDefined();
    expect(connector!.manifest).toMatchObject({
      availability: "Beta",
      category: "MSSP",
      connectable: true,
      marketplaceCategory: "MSSP/PSA/RMM",
      product: "HaloPSA"
    });
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "clientCredentials"]));

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "halopsa",
        mockMode: true
      },
      integrationId: "16161616-1616-4616-8616-161616161616",
      mockMode: true,
      tenantId: "17171717-1717-4717-8717-171717171717"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets.map((asset) => asset.assetType)).toEqual(
      expect.arrayContaining(["Other"])
    );
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "HaloPSAClientObserved",
        "HaloPSATicketObserved",
        "HaloPSAOpenTicketObserved"
      ])
    );

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const parsedUrl = new URL(String(input));

        expect(parsedUrl.origin).toBe("https://halo.example.com");
        expect(parsedUrl.pathname).not.toMatch(
          /\/(?:site|user|asset|project|billing|invoice|configuration|delete|archive|action|update|merge|execute)(?:\/|$)/iu
        );

        if (parsedUrl.pathname === "/auth/token") {
          expect(init?.method).toBe("POST");
          expect(init?.headers).toMatchObject({
            "content-type": "application/x-www-form-urlencoded"
          });

          const body = new URLSearchParams(String(init?.body));

          expect(body.get("grant_type")).toBe("client_credentials");
          expect(body.get("client_id")).toBe("halo-client-id");
          expect(body.get("scope")).toBe("all");

          return new Response(
            JSON.stringify({
              access_token: "halo-access-token"
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        expect(init?.headers).toMatchObject({
          accept: "application/json",
          authorization: "Bearer halo-access-token"
        });

        if (parsedUrl.pathname === "/api/Client") {
          expect(init?.method).toBe("GET");
          expect(init).not.toHaveProperty("body");

          return new Response(
            JSON.stringify([
              {
                id: 701,
                name: "Acme Manufacturing",
                status: {
                  name: "Active"
                }
              }
            ]),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (parsedUrl.pathname === "/api/Tickets") {
          if (init?.method === "POST") {
            const body = JSON.parse(String(init.body)) as {
              client_id?: number;
              details: string;
              priority_id?: number;
              summary: string;
              tickettype_id?: number;
            };

            expect(body.summary).toBe("Periscan remediation");
            expect(body.client_id).toBe(701);
            expect(body.tickettype_id).toBe(9);
            expect(body.priority_id).toBe(3);
            expect(body.details).toContain(
              "Evidence IDs: 18181818-1818-4818-8818-181818181818"
            );

            return new Response(JSON.stringify({ id: 9901 }), {
              headers: {
                "content-type": "application/json"
              },
              status: 201
            });
          }

          expect(init?.method).toBe("GET");
          expect(init).not.toHaveProperty("body");

          return new Response(
            JSON.stringify({
              items: [
                {
                  client: {
                    id: 701,
                    name: "Acme Manufacturing"
                  },
                  id: 8801,
                  priority: {
                    name: "High"
                  },
                  status: {
                    name: "New"
                  },
                  summary: "Rotate exposed GitHub credential",
                  updateddate: "2026-06-04T14:00:00Z"
                }
              ]
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        return new Response(JSON.stringify({}), {
          headers: {
            "content-type": "application/json"
          },
          status: 404
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "clientCredentials",
      config: {
        apiBaseUrl: "https://halo.example.com",
        clientId: "halo-client-id",
        clientSecret: "halo-client-secret",
        connectorKey: "halopsa",
        pageSize: 25,
        scope: "all"
      },
      integrationId: "19191919-1919-4919-8919-191919191919",
      mockMode: false,
      tenantId: "1a1a1a1a-1a1a-4a1a-8a1a-1a1a1a1a1a1a"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "HaloPSAClientObserved",
        "HaloPSATicketObserved",
        "HaloPSAOpenTicketObserved"
      ])
    );

    const liveDelivery = await connector!.sendWorkflowEvent!({
      authType: "clientCredentials",
      config: {
        apiBaseUrl: "https://halo.example.com",
        clientId: "halo-client-id",
        clientSecret: "halo-client-secret",
        connectorKey: "halopsa",
        defaultClientId: 701,
        ticketPriorityId: 3,
        ticketTypeId: 9,
        workflowEvent: {
          evidenceIds: ["18181818-1818-4818-8818-181818181818"],
          remediationId: "1b1b1b1b-1b1b-4b1b-8b1b-1b1b1b1b1b1b",
          summary: "Rotate the exposed key and rerun verification.",
          title: "Periscan remediation"
        }
      },
      integrationId: "1c1c1c1c-1c1c-4c1c-8c1c-1c1c1c1c1c1c",
      mockMode: false,
      tenantId: "1d1d1d1d-1d1d-4d1d-8d1d-1d1d1d1d1d1d"
    });

    expect(liveDelivery).toMatchObject({
      destination: "HaloPSA",
      mode: "clientCredentials",
      status: "Delivered",
      ticketId: "HALO-9901"
    });
    expect(fetchMock).toHaveBeenCalledTimes(7);
    expect(JSON.stringify(liveResult)).not.toContain("halo-client-secret");
    expect(JSON.stringify(liveDelivery)).not.toContain("halo-client-secret");
  });

  it("runs Autotask sync and workflow delivery through API-user credentials", async () => {
    const connector = getConnectorByKey("autotask");

    expect(connector).toBeDefined();
    expect(connector?.sendWorkflowEvent).toBeDefined();
    expect(connector!.manifest).toMatchObject({
      availability: "Beta",
      category: "MSSP",
      connectable: true,
      marketplaceCategory: "MSSP/PSA/RMM",
      product: "Autotask PSA"
    });
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiKey"]));

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "autotask",
        mockMode: true
      },
      integrationId: "1e1e1e1e-1e1e-4e1e-8e1e-1e1e1e1e1e1e",
      mockMode: true,
      tenantId: "1f1f1f1f-1f1f-4f1f-8f1f-1f1f1f1f1f1f"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets.map((asset) => asset.assetType)).toEqual(
      expect.arrayContaining(["Other"])
    );
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "AutotaskCompanyObserved",
        "AutotaskTicketObserved",
        "AutotaskOpenTicketObserved"
      ])
    );

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const parsedUrl = new URL(String(input));

        expect(parsedUrl.origin).toBe("https://webservices15.autotask.net");
        expect(init?.headers).toMatchObject({
          accept: "application/json",
          ApiIntegrationCode: "autotask-integration-code",
          "content-type": "application/json",
          Secret: "autotask-secret",
          UserName: "apiuser@example.com"
        });
        expect(parsedUrl.pathname).not.toMatch(
          /\/(?:contacts?|contracts?|configurationitems?|projects?|timeentries|billing|invoice|users?|delete|archive|action|update|merge|execute|patch|put)(?:\/|$)/iu
        );

        if (
          parsedUrl.pathname === "/atservicesrest/v1.0/Companies/query" &&
          init?.method === "GET"
        ) {
          expect(init).not.toHaveProperty("body");

          const search = JSON.parse(
            parsedUrl.searchParams.get("search") ?? "{}"
          ) as {
            IncludeFields: string[];
            MaxRecords: number;
          };

          expect(search.IncludeFields).toEqual(
            expect.arrayContaining(["id", "companyName"])
          );

          return new Response(
            JSON.stringify({
              items: [
                {
                  companyName: "Acme Manufacturing",
                  companyType: "Client",
                  id: 901,
                  isActive: true
                }
              ]
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (
          parsedUrl.pathname === "/atservicesrest/v1.0/Tickets/query" &&
          init?.method === "GET"
        ) {
          expect(init).not.toHaveProperty("body");

          return new Response(
            JSON.stringify({
              items: [
                {
                  companyID: 901,
                  id: 9101,
                  lastActivityDate: "2026-06-04T16:00:00Z",
                  priority: "High",
                  status: "New",
                  title: "Rotate exposed cloud credential"
                }
              ]
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (
          parsedUrl.pathname === "/atservicesrest/v1.0/Tickets" &&
          init?.method === "POST"
        ) {
          const body = JSON.parse(String(init.body)) as {
            companyID?: number;
            description: string;
            priority?: number;
            queueID?: number;
            status?: number;
            title: string;
          };

          expect(body.title).toBe("Periscan remediation");
          expect(body.companyID).toBe(901);
          expect(body.queueID).toBe(12);
          expect(body.status).toBe(1);
          expect(body.priority).toBe(3);
          expect(body.description).toContain(
            "Evidence IDs: 20202020-2020-4020-8020-202020202020"
          );

          return new Response(
            JSON.stringify({
              item: {
                id: 9902
              }
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 201
            }
          );
        }

        return new Response(JSON.stringify({}), {
          headers: {
            "content-type": "application/json"
          },
          status: 404
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "apiKey",
      config: {
        apiBaseUrl: "https://webservices15.autotask.net/atservicesrest/v1.0",
        apiIntegrationCode: "autotask-integration-code",
        connectorKey: "autotask",
        pageSize: 25,
        secret: "autotask-secret",
        username: "apiuser@example.com"
      },
      integrationId: "21212121-2121-4121-8121-212121212121",
      mockMode: false,
      tenantId: "22222222-2222-4222-8222-222222222222"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "AutotaskCompanyObserved",
        "AutotaskTicketObserved",
        "AutotaskOpenTicketObserved"
      ])
    );

    const liveDelivery = await connector!.sendWorkflowEvent!({
      authType: "apiKey",
      config: {
        apiBaseUrl: "https://webservices15.autotask.net/atservicesrest/v1.0",
        apiIntegrationCode: "autotask-integration-code",
        connectorKey: "autotask",
        defaultCompanyId: 901,
        priority: 3,
        queueId: 12,
        secret: "autotask-secret",
        status: 1,
        ticketType: 1,
        username: "apiuser@example.com",
        workflowEvent: {
          evidenceIds: ["20202020-2020-4020-8020-202020202020"],
          remediationId: "23232323-2323-4323-8323-232323232323",
          summary: "Rotate the exposed key and rerun verification.",
          title: "Periscan remediation"
        }
      },
      integrationId: "24242424-2424-4424-8424-242424242424",
      mockMode: false,
      tenantId: "25252525-2525-4525-8525-252525252525"
    });

    expect(liveDelivery).toMatchObject({
      destination: "Autotask PSA",
      mode: "apiKey",
      status: "Delivered",
      ticketId: "AT-9902"
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(JSON.stringify(liveResult)).not.toContain("autotask-secret");
    expect(JSON.stringify(liveResult)).not.toContain(
      "autotask-integration-code"
    );
    expect(JSON.stringify(liveDelivery)).not.toContain("autotask-secret");
    expect(JSON.stringify(liveDelivery)).not.toContain(
      "autotask-integration-code"
    );
  });

  it("runs Syncro sync and workflow delivery through API-token mode", async () => {
    const connector = getConnectorByKey("syncro");

    expect(connector).toBeDefined();
    expect(connector?.sendWorkflowEvent).toBeDefined();
    expect(connector!.manifest).toMatchObject({
      availability: "Beta",
      category: "MSSP",
      connectable: true,
      marketplaceCategory: "MSSP/PSA/RMM",
      product: "Syncro"
    });
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiKey"]));

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "syncro",
        mockMode: true
      },
      integrationId: "26262626-2626-4626-8626-262626262626",
      mockMode: true,
      tenantId: "27272727-2727-4727-8727-272727272727"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets.map((asset) => asset.assetType)).toEqual(
      expect.arrayContaining(["Other", "Host"])
    );
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "SyncroCustomerObserved",
        "SyncroAssetObserved",
        "SyncroOfflineAssetObserved",
        "SyncroTicketObserved",
        "SyncroOpenTicketObserved"
      ])
    );

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const parsedUrl = new URL(String(input));

        expect(parsedUrl.origin).toBe("https://acme.syncromsp.com");
        expect(init?.headers).toMatchObject({
          accept: "application/json",
          authorization: "Bearer syncro-secret-token",
          "content-type": "application/json"
        });
        expect(parsedUrl.pathname).not.toMatch(
          /\/(?:appointments?|estimates?|invoices?|payments?|products?|polic(?:y|ies)|scripts?|timers?|line_items?|attachments?|comments?|print|email|delete|remove|charge|update|put|patch|action|execute|contracts?)(?:\/|$)/iu
        );

        if (parsedUrl.pathname === "/api/v1/customers") {
          expect(init?.method).toBe("GET");
          expect(init).not.toHaveProperty("body");
          expect(parsedUrl.searchParams.get("page")).toBe("1");

          return new Response(
            JSON.stringify({
              customers: [
                {
                  business_name: "Acme Manufacturing",
                  id: 1101,
                  status: "active"
                }
              ]
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (parsedUrl.pathname === "/api/v1/customer_assets") {
          expect(init?.method).toBe("GET");
          expect(init).not.toHaveProperty("body");
          expect(parsedUrl.searchParams.get("customer_id")).toBe("1101");

          return new Response(
            JSON.stringify({
              customer_assets: [
                {
                  customer_business_then_name: "Acme Manufacturing",
                  customer_id: 1101,
                  id: 1201,
                  name: "acme-dc-02",
                  online: false,
                  operating_system: "Windows Server 2022",
                  serial_number: "ACME-DC-02"
                }
              ]
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (
          parsedUrl.pathname === "/api/v1/tickets" &&
          init?.method === "GET"
        ) {
          expect(init).not.toHaveProperty("body");
          expect(parsedUrl.searchParams.get("customer_id")).toBe("1101");
          expect(parsedUrl.searchParams.get("comment_format")).toBe(
            "plaintext"
          );
          expect(parsedUrl.searchParams.get("all_comments")).toBe("false");

          return new Response(
            JSON.stringify({
              tickets: [
                {
                  customer_business_then_name: "Acme Manufacturing",
                  customer_id: 1101,
                  id: 1301,
                  priority: "High",
                  status: "New",
                  subject: "Rotate exposed cloud credential",
                  updated_at: "2026-06-04T18:00:00Z"
                }
              ]
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (
          parsedUrl.pathname === "/api/v1/tickets" &&
          init?.method === "POST"
        ) {
          const body = JSON.parse(String(init.body)) as {
            asset_ids?: number[];
            comments_attributes?: Array<{
              body: string;
              hidden: boolean;
              subject: string;
            }>;
            customer_id?: number;
            priority?: string;
            status: string;
            subject: string;
            ticket_type_id?: number;
          };

          expect(body.subject).toBe("Periscan remediation");
          expect(body.customer_id).toBe(1101);
          expect(body.ticket_type_id).toBe(8);
          expect(body.priority).toBe("High");
          expect(body.status).toBe("New");
          expect(body.asset_ids).toEqual([1201]);
          expect(body.comments_attributes?.[0]?.body).toContain(
            "Evidence IDs: 28282828-2828-4828-8828-282828282828"
          );

          return new Response(
            JSON.stringify({
              ticket: {
                id: 1401
              }
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 201
            }
          );
        }

        return new Response(JSON.stringify({}), {
          headers: {
            "content-type": "application/json"
          },
          status: 404
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "apiKey",
      config: {
        apiBaseUrl: "https://acme.syncromsp.com/api/v1",
        apiKey: "syncro-secret-token",
        connectorKey: "syncro",
        customerId: 1101,
        page: 1,
        ticketStatusFilter: "Not Closed"
      },
      integrationId: "29292929-2929-4929-8929-292929292929",
      mockMode: false,
      tenantId: "2a2a2a2a-2a2a-4a2a-8a2a-2a2a2a2a2a2a"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "SyncroCustomerObserved",
        "SyncroAssetObserved",
        "SyncroOfflineAssetObserved",
        "SyncroTicketObserved",
        "SyncroOpenTicketObserved"
      ])
    );

    const liveDelivery = await connector!.sendWorkflowEvent!({
      authType: "apiKey",
      config: {
        apiBaseUrl: "https://acme.syncromsp.com/api/v1",
        apiKey: "syncro-secret-token",
        connectorKey: "syncro",
        defaultCustomerId: 1101,
        priority: "High",
        status: "New",
        ticketTypeId: 8,
        workflowEvent: {
          assetIds: [1201],
          evidenceIds: ["28282828-2828-4828-8828-282828282828"],
          remediationId: "2b2b2b2b-2b2b-4b2b-8b2b-2b2b2b2b2b2b",
          summary: "Rotate the exposed key and rerun verification.",
          title: "Periscan remediation"
        }
      },
      integrationId: "2c2c2c2c-2c2c-4c2c-8c2c-2c2c2c2c2c2c",
      mockMode: false,
      tenantId: "2d2d2d2d-2d2d-4d2d-8d2d-2d2d2d2d2d2d"
    });

    expect(liveDelivery).toMatchObject({
      destination: "Syncro",
      mode: "apiKey",
      status: "Delivered",
      ticketId: "SYNCRO-1401"
    });
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(JSON.stringify(liveResult)).not.toContain("syncro-secret-token");
    expect(JSON.stringify(liveDelivery)).not.toContain("syncro-secret-token");
  });

  it("runs N-able N-central sync through JWT-token read-only mode", async () => {
    const connector = getConnectorByKey("n-able-ncentral");

    expect(connector).toBeDefined();
    expect(connector?.sendWorkflowEvent).toBeUndefined();
    expect(connector!.manifest).toMatchObject({
      availability: "Beta",
      category: "MSSP",
      connectable: true,
      marketplaceCategory: "MSSP/PSA/RMM",
      product: "N-central",
      vendor: "N-able"
    });
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiToken"]));
    expect(connector!.manifest.requiredPermissions).toEqual(
      expect.arrayContaining([
        "GET /api/customers",
        "GET /api/devices",
        "GET /api/org-units/{orgUnitId}/active-issues"
      ])
    );

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "n-able-ncentral",
        mockMode: true
      },
      integrationId: "30303030-3030-4030-8030-303030303030",
      mockMode: true,
      tenantId: "31313131-3131-4131-8131-313131313131"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets.map((asset) => asset.assetType)).toEqual(
      expect.arrayContaining(["Other", "Host"])
    );
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "NCentralCustomerObserved",
        "NCentralDeviceObserved",
        "NCentralOfflineDeviceObserved",
        "NCentralActiveIssueObserved"
      ])
    );

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const parsedUrl = new URL(String(input));

        expect(parsedUrl.origin).toBe("https://ncentral.example.com");
        expect(parsedUrl.pathname).not.toMatch(
          /\/(?:tasks?|scheduled-tasks?|jobs?|scripts?|patch(?:es|ing)?|reboot|restart|shutdown|remote-control|take-control|credentials?|users?|roles?|rules?|polic(?:y|ies)|probes?|agents?|delete|remove|create|update|put|patch|execute|run|start|stop)(?:\/|$)/iu
        );

        if (parsedUrl.pathname === "/api/auth/authenticate") {
          expect(init?.method).toBe("POST");
          expect(init?.headers).toMatchObject({
            accept: "application/json",
            authorization: "Bearer ncentral-jwt-token",
            "content-type": "application/json"
          });

          return new Response(
            JSON.stringify({
              tokens: {
                access: {
                  token: "ncentral-access-token"
                }
              }
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        expect(init?.method).toBe("GET");
        expect(init).not.toHaveProperty("body");
        expect(init?.headers).toMatchObject({
          accept: "application/json",
          authorization: "Bearer ncentral-access-token",
          "content-type": "application/json"
        });

        if (parsedUrl.pathname === "/api/customers") {
          expect(parsedUrl.searchParams.get("pageNumber")).toBe("1");
          expect(parsedUrl.searchParams.get("pageSize")).toBe("50");

          return new Response(
            JSON.stringify({
              data: [
                {
                  customerId: 2101,
                  customerName: "Acme Manufacturing",
                  customerType: "Customer",
                  parentId: null
                }
              ]
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (parsedUrl.pathname === "/api/devices") {
          return new Response(
            JSON.stringify({
              data: [
                {
                  customerId: 2101,
                  deviceClass: "Servers - Windows",
                  deviceId: 2201,
                  longName: "acme-edge-01",
                  online: false,
                  operatingSystem: "Windows Server 2022",
                  orgUnitId: 2101,
                  uri: "/api/devices/2201"
                }
              ]
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (parsedUrl.pathname === "/api/org-units/2101/active-issues") {
          expect(parsedUrl.searchParams.get("pageNumber")).toBe("1");
          expect(parsedUrl.searchParams.get("pageSize")).toBe("50");

          return new Response(
            JSON.stringify({
              data: [
                {
                  deviceId: 2201,
                  deviceName: "acme-edge-01",
                  notificationState: "Failed",
                  serviceName: "Endpoint Detection Sensor",
                  serviceType: "Security",
                  taskId: 2301
                }
              ]
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        return new Response(JSON.stringify({}), {
          headers: {
            "content-type": "application/json"
          },
          status: 404
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "apiToken",
      config: {
        apiBaseUrl: "https://ncentral.example.com/api",
        connectorKey: "n-able-ncentral",
        jwtToken: "ncentral-jwt-token",
        orgUnitIds: [2101],
        pageNumber: 1,
        pageSize: 50
      },
      integrationId: "32323232-3232-4232-8232-323232323232",
      mockMode: false,
      tenantId: "33333333-3333-4333-8333-333333333333"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "NCentralCustomerObserved",
        "NCentralDeviceObserved",
        "NCentralOfflineDeviceObserved",
        "NCentralActiveIssueObserved"
      ])
    );
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(JSON.stringify(liveResult)).not.toContain("ncentral-jwt-token");
    expect(JSON.stringify(liveResult)).not.toContain("ncentral-access-token");
  });

  it("runs Datto RMM sync through OAuth read-only mode", async () => {
    const connector = getConnectorByKey("datto-rmm");

    expect(connector).toBeDefined();
    expect(connector?.sendWorkflowEvent).toBeUndefined();
    expect(connector!.manifest).toMatchObject({
      availability: "Beta",
      category: "MSSP",
      connectable: true,
      marketplaceCategory: "MSSP/PSA/RMM",
      product: "Datto RMM",
      vendor: "Kaseya"
    });
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiKey"]));
    expect(connector!.manifest.requiredPermissions).toEqual(
      expect.arrayContaining([
        "POST /auth/oauth/token",
        "GET /api/v2/account/devices"
      ])
    );
    expect(connector!.manifest.permissionsSummary).toContain(
      "does not run scripts, jobs, components, patches, remote-control sessions"
    );

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "datto-rmm",
        mockMode: true
      },
      integrationId: "34343434-3434-4434-8434-343434343434",
      mockMode: true,
      tenantId: "35353535-3535-4535-8535-353535353535"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets.map((asset) => asset.assetType)).toEqual(
      expect.arrayContaining(["Other", "Host"])
    );
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "DattoRmmSiteObserved",
        "DattoRmmDeviceObserved",
        "DattoRmmOfflineDeviceObserved"
      ])
    );

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const parsedUrl = new URL(String(input));

        expect(parsedUrl.origin).toBe("https://merlot-api.centrastage.net");
        expect(parsedUrl.pathname).not.toMatch(
          /\/(?:scripts?|jobs?|components?|quick-jobs?|patch(?:es|ing)?|reboot|restart|shutdown|remote-control|take-control|web-remote|credentials?|users?|sites?|settings?|polic(?:y|ies)|delete|remove|create|update|put|patch|execute|run|start|stop|udf)(?:\/|$)/iu
        );

        if (parsedUrl.pathname === "/auth/oauth/token") {
          expect(init?.method).toBe("POST");
          expect(init?.headers).toMatchObject({
            accept: "application/json",
            authorization: `Basic ${Buffer.from(
              "public-client:public"
            ).toString("base64")}`,
            "content-type": "application/x-www-form-urlencoded"
          });
          expect(String(init?.body)).toContain("grant_type=password");
          expect(String(init?.body)).toContain("username=datto-api-key");
          expect(String(init?.body)).toContain("password=datto-api-secret");

          return new Response(
            JSON.stringify({
              access_token: "datto-access-token"
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (parsedUrl.pathname === "/api/v2/account/devices") {
          expect(init?.method).toBe("GET");
          expect(init).not.toHaveProperty("body");
          expect(init?.headers).toMatchObject({
            accept: "application/json",
            authorization: "Bearer datto-access-token",
            "content-type": "application/json"
          });
          expect(parsedUrl.searchParams.get("page")).toBe("1");
          expect(["1", "2"]).toContain(parsedUrl.searchParams.get("max"));

          return new Response(
            JSON.stringify({
              devices: [
                {
                  deviceUid: "device-live-01",
                  hostname: "acme-datto-server-01",
                  lastSeenAt: "2026-06-05T12:00:00.000Z",
                  onlineStatus: "offline",
                  operatingSystem: "Windows Server 2022",
                  serialNumber: "DATTO-LIVE-01",
                  siteName: "Acme Manufacturing",
                  siteUid: "site-live-acme"
                },
                {
                  deviceUid: "device-live-02",
                  hostname: "acme-datto-laptop-02",
                  lastSeenAt: "2026-06-05T12:30:00.000Z",
                  operatingSystem: "Windows 11",
                  serialNumber: "DATTO-LIVE-02",
                  siteName: "Acme Manufacturing",
                  siteUid: "site-live-acme",
                  suspended: false
                }
              ],
              pageDetails: {
                count: 1,
                nextPageUrl: null,
                prevPageUrl: null
              }
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        return new Response(JSON.stringify({}), {
          headers: {
            "content-type": "application/json"
          },
          status: 404
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "apiKey",
      config: {
        apiBaseUrl: "https://merlot-api.centrastage.net",
        apiKey: "datto-api-key",
        apiSecret: "datto-api-secret",
        connectorKey: "datto-rmm",
        max: 2,
        page: 1
      },
      integrationId: "36363636-3636-4636-8636-363636363636",
      mockMode: false,
      tenantId: "37373737-3737-4737-8737-373737373737"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "DattoRmmSiteObserved",
        "DattoRmmDeviceObserved",
        "DattoRmmOfflineDeviceObserved"
      ])
    );
    expect(
      liveResult.signals.filter(
        (signal) => signal.signalSubcategory === "DattoRmmOfflineDeviceObserved"
      )
    ).toHaveLength(1);
    expect(
      liveResult.assets.find((asset) =>
        asset.name.includes("acme-datto-laptop-02")
      )?.status
    ).toBe("Active");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(JSON.stringify(liveResult)).not.toContain("datto-api-key");
    expect(JSON.stringify(liveResult)).not.toContain("datto-api-secret");
    expect(JSON.stringify(liveResult)).not.toContain("datto-access-token");
  });

  it("runs Kaseya VSA sync through personal-access-token read-only mode", async () => {
    const connector = getConnectorByKey("kaseya-vsa");

    expect(connector).toBeDefined();
    expect(connector?.sendWorkflowEvent).toBeUndefined();
    expect(connector!.manifest).toMatchObject({
      availability: "Beta",
      category: "MSSP",
      connectable: true,
      marketplaceCategory: "MSSP/PSA/RMM",
      product: "VSA",
      vendor: "Kaseya"
    });
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiKey"]));
    expect(connector!.manifest.requiredPermissions).toEqual(
      expect.arrayContaining([
        "GET /api/v1.0/assetmgmt/assets",
        "GET /api/v1.0/assetmgmt/agents"
      ])
    );
    expect(connector!.manifest.permissionsSummary).toContain(
      "does not run agent procedures, schedule jobs, deploy patches"
    );

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "kaseya-vsa",
        mockMode: true
      },
      integrationId: "38383838-3838-4838-8838-383838383838",
      mockMode: true,
      tenantId: "39393939-3939-4939-8939-393939393939"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets.map((asset) => asset.assetType)).toEqual(
      expect.arrayContaining(["Host"])
    );
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "KaseyaVsaAssetObserved",
        "KaseyaVsaAgentObserved",
        "KaseyaVsaOfflineAgentObserved"
      ])
    );

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const parsedUrl = new URL(String(input));

        expect(parsedUrl.origin).toBe("https://vsa.example.test");
        expect(parsedUrl.pathname).not.toMatch(
          /\/(?:automation|agentprocs?|procedures?|scheduledprocs?|patch|patches|machineupdate|packages?|getfiles?|logs?|remotecontrol|take-control|web-remote|scripts?|jobs?|tasks?|commands?|credential|password|users?|roles?|settings?|polic(?:y|ies)|delete|remove|create|update|put|patch|post|execute|run|start|stop|rename|install|deploy|upload|download)(?:\/|$)/iu
        );
        expect(init?.method).toBe("GET");
        expect(init).not.toHaveProperty("body");
        expect(init?.headers).toMatchObject({
          accept: "application/json",
          authorization: "Bearer kaseya-vsa-token",
          "content-type": "application/json"
        });

        if (parsedUrl.pathname === "/api/v1.0/assetmgmt/assets") {
          return new Response(
            JSON.stringify({
              Result: [
                {
                  AgentId: 701,
                  AssetId: 9701,
                  AssetName: "acme-vsa-live-server-01",
                  IsComputerAgent: true,
                  IsMobileAgent: false,
                  MachineGroup: "Acme Manufacturing.servers",
                  OrgId: 1701
                },
                {
                  AgentId: 702,
                  AssetId: 9702,
                  AssetName: "northwind-vsa-live-laptop-02",
                  IsComputerAgent: true,
                  IsMobileAgent: false,
                  MachineGroup: "Northwind Labs.workstations",
                  OrgId: 1702
                }
              ],
              ResponseCode: 0,
              Status: "OK",
              TotalRecords: 2
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (parsedUrl.pathname === "/api/v1.0/assetmgmt/agents") {
          return new Response(
            JSON.stringify({
              Result: [
                {
                  AgentId: 701,
                  AgentName: "acme-vsa-live-server-01",
                  ComputerName: "acme-vsa-live-server-01",
                  MachineGroup: "Acme Manufacturing.servers",
                  OSInfo: "Windows Server 2022",
                  OSType: "Windows",
                  Online: 0,
                  OrgId: 1701
                },
                {
                  AgentId: 702,
                  AgentName: "northwind-vsa-live-laptop-02",
                  ComputerName: "northwind-vsa-live-laptop-02",
                  MachineGroup: "Northwind Labs.workstations",
                  OSInfo: "Windows 11",
                  OSType: "Windows",
                  Online: 1,
                  OrgId: 1702
                }
              ],
              ResponseCode: 0,
              Status: "OK",
              TotalRecords: 2
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        return new Response(JSON.stringify({}), {
          headers: {
            "content-type": "application/json"
          },
          status: 404
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "apiKey",
      config: {
        accessToken: "kaseya-vsa-token",
        apiBaseUrl: "https://vsa.example.test/api/v1.0",
        connectorKey: "kaseya-vsa"
      },
      integrationId: "40404040-4040-4040-8040-404040404040",
      mockMode: false,
      tenantId: "41414141-4141-4141-8141-414141414141"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "KaseyaVsaAssetObserved",
        "KaseyaVsaAgentObserved",
        "KaseyaVsaOfflineAgentObserved"
      ])
    );
    expect(
      liveResult.signals.filter(
        (signal) => signal.signalSubcategory === "KaseyaVsaOfflineAgentObserved"
      )
    ).toHaveLength(1);
    expect(
      liveResult.assets.find((asset) =>
        asset.name.includes("northwind-vsa-live-laptop-02")
      )?.status
    ).toBe("Active");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(liveResult)).not.toContain("kaseya-vsa-token");
  });

  it("runs ConnectWise Automate sync through REST read-only mode", async () => {
    const connector = getConnectorByKey("connectwise-automate");

    expect(connector).toBeDefined();
    expect(connector?.sendWorkflowEvent).toBeUndefined();
    expect(connector!.manifest).toMatchObject({
      availability: "Beta",
      category: "MSSP",
      connectable: true,
      marketplaceCategory: "MSSP/PSA/RMM",
      product: "ConnectWise Automate",
      vendor: "ConnectWise"
    });
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "basicAuth"]));
    expect(connector!.manifest.requiredPermissions).toEqual(
      expect.arrayContaining([
        "GET /cwa/api/v1/Clients",
        "GET /cwa/api/v1/Computers",
        "GET /cwa/api/v1/Alerts"
      ])
    );
    expect(connector!.manifest.permissionsSummary).toContain(
      "does not run scripts, agent procedures, commands, patch jobs"
    );

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "connectwise-automate",
        mockMode: true
      },
      integrationId: "42424242-4242-4242-8242-424242424242",
      mockMode: true,
      tenantId: "43434343-4343-4343-8343-434343434343"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets.map((asset) => asset.assetType)).toEqual(
      expect.arrayContaining(["Host", "Other"])
    );
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "ConnectWiseAutomateClientObserved",
        "ConnectWiseAutomateComputerObserved",
        "ConnectWiseAutomateOfflineComputerObserved",
        "ConnectWiseAutomateAlertObserved",
        "ConnectWiseAutomateCriticalOpenAlertObserved"
      ])
    );

    const expectedAuthorization = `Basic ${Buffer.from(
      "automate-user:automate-password"
    ).toString("base64")}`;
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const parsedUrl = new URL(String(input));

        expect(parsedUrl.origin).toBe("https://automate.example.test");
        expect(parsedUrl.pathname).not.toMatch(
          /\/(?:scripts?|commands?|agentprocs?|procedures?|patch(?:es|ing)?|deploy|install|uninstall|reboot|restart|shutdown|remote-control|control|screenconnect|take-control|files?|logs?|tickets?|users?|roles?|credentials?|password|settings?|configuration|delete|remove|create|update|put|patch|post|execute|run|start|stop)(?:\/|$)/iu
        );
        expect(init?.method).toBe("GET");
        expect(init).not.toHaveProperty("body");
        expect(init?.headers).toMatchObject({
          accept: "application/json",
          authorization: expectedAuthorization,
          "content-type": "application/json"
        });

        if (parsedUrl.pathname === "/cwa/api/v1/Clients") {
          return new Response(
            JSON.stringify({
              Clients: [
                {
                  ClientID: 1101,
                  Name: "Acme Manufacturing",
                  Status: "Active"
                }
              ],
              TotalRecords: 1
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (parsedUrl.pathname === "/cwa/api/v1/Computers") {
          return new Response(
            JSON.stringify({
              Computers: [
                {
                  ClientID: 1101,
                  ClientName: "Acme Manufacturing",
                  ComputerID: 1201,
                  LastContact: "2026-06-04T21:00:00Z",
                  LocationName: "HQ",
                  Name: "acme-cwa-live-server-01",
                  OS: "Windows Server 2022",
                  Online: 0,
                  SerialNumber: "CWA-LIVE-1201"
                }
              ],
              TotalRecords: 1
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (parsedUrl.pathname === "/cwa/api/v1/Alerts") {
          return new Response(
            JSON.stringify({
              Alerts: [
                {
                  AlertID: 9001,
                  ClientID: 1101,
                  ComputerID: 1201,
                  ComputerName: "acme-cwa-live-server-01",
                  LastUpdate: "2026-06-04T21:05:00Z",
                  Message: "Endpoint protection service stopped",
                  Severity: "Critical",
                  Status: "Open"
                }
              ],
              TotalRecords: 1
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        return new Response(JSON.stringify({}), {
          headers: {
            "content-type": "application/json"
          },
          status: 404
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "basicAuth",
      config: {
        apiBaseUrl: "https://automate.example.test",
        connectorKey: "connectwise-automate",
        password: "automate-password",
        username: "automate-user"
      },
      integrationId: "44444444-4444-4444-8444-444444444444",
      mockMode: false,
      tenantId: "45454545-4545-4545-8545-454545454545"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "ConnectWiseAutomateClientObserved",
        "ConnectWiseAutomateComputerObserved",
        "ConnectWiseAutomateOfflineComputerObserved",
        "ConnectWiseAutomateAlertObserved",
        "ConnectWiseAutomateCriticalOpenAlertObserved"
      ])
    );
    expect(
      liveResult.signals.filter(
        (signal) =>
          signal.signalSubcategory ===
          "ConnectWiseAutomateCriticalOpenAlertObserved"
      )
    ).toHaveLength(1);
    expect(
      liveResult.assets.find((asset) =>
        asset.name.includes("acme-cwa-live-server-01")
      )?.status
    ).toBe("Inactive");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(JSON.stringify(liveResult)).not.toContain("automate-password");
    expect(JSON.stringify(liveResult)).not.toContain(expectedAuthorization);
  });

  it("runs mock AWS sync with inventory assets and exposure signals", async () => {
    const connector = getConnectorByKey("aws");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(
      expect.arrayContaining(["mock", "staticCredentials", "assumeRole"])
    );
    expect(connector!.manifest.requiredPermissions).toEqual(
      expect.arrayContaining(["sts:AssumeRole", "sts:GetCallerIdentity"])
    );

    const result = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "aws",
        mockMode: true
      },
      integrationId: "55555555-5555-4555-8555-555555555555",
      mockMode: true,
      tenantId: "66666666-6666-4666-8666-666666666666"
    });

    expect(result.health.status).toBe("Healthy");
    expect(result.assets.length).toBeGreaterThan(4);
    expect(result.assets[0]?.assetType).toBe("CloudResource");
    expect(result.signals.map((signal) => signal.signalSubcategory)).toEqual(
      expect.arrayContaining([
        "CloudAccount",
        "CloudAsset",
        "SecurityGroup",
        "IAMRole",
        "IAMPolicy",
        "StorageBucket",
        "PublicExposure"
      ])
    );
  });

  it("runs AWS WAF sync with web ACL posture signals", async () => {
    const connector = getConnectorByKey("aws-waf");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(
      expect.arrayContaining(["mock", "staticCredentials", "assumeRole"])
    );
    expect(connector!.manifest.requiredPermissions).toEqual(
      expect.arrayContaining([
        "wafv2:ListWebACLs",
        "wafv2:GetWebACL",
        "wafv2:ListResourcesForWebACL"
      ])
    );

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "aws-waf",
        mockMode: true
      },
      integrationId: "62626262-6262-4626-8626-626262626262",
      mockMode: true,
      tenantId: "63636363-6363-4636-8636-636363636363"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets.length).toBeGreaterThan(1);
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "WAFRulesConfigured",
        "WAFRulesMissing",
        "WAFResourceCoverage",
        "WAFUnassociated"
      ])
    );

    const sendSpy = vi
      .spyOn(WAFV2Client.prototype, "send")
      .mockImplementation(async (command) => {
        const commandName = command.constructor.name;

        if (commandName === "ListWebACLsCommand") {
          return {
            WebACLs: [
              {
                ARN: "arn:aws:wafv2:us-east-1:123456789012:regional/webacl/customer-edge/live-waf-1",
                Id: "live-waf-1",
                Name: "customer-edge"
              }
            ]
          } as never;
        }

        if (commandName === "GetWebACLCommand") {
          return {
            WebACL: {
              Capacity: 90,
              DefaultAction: {
                Block: {}
              },
              Description: "Customer edge WAF",
              ManagedByFirewallManager: false,
              Rules: [
                {
                  Name: "AWSManagedRulesCommonRuleSet",
                  Priority: 1
                }
              ]
            }
          } as never;
        }

        if (commandName === "ListResourcesForWebACLCommand") {
          return {
            ResourceArns: [
              "arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/customer-app/abc123"
            ]
          } as never;
        }

        return {} as never;
      });

    const liveResult = await connector!.sync({
      authType: "staticCredentials",
      config: {
        accessKeyId: "AKIA1234567890WAF",
        connectorKey: "aws-waf",
        region: "us-east-1",
        scopes: ["REGIONAL"],
        secretAccessKey: "aws-waf-secret-key"
      },
      integrationId: "64646464-6464-4646-8646-646464646464",
      mockMode: false,
      tenantId: "65656565-6565-4656-8656-656565656565"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets.length).toBeGreaterThanOrEqual(2);
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining(["WAFRulesConfigured", "WAFResourceCoverage"])
    );
    expect(sendSpy).toHaveBeenCalled();
    expect(JSON.stringify(liveResult)).not.toContain("aws-waf-secret-key");
  });

  it("runs Azure sync with read-only subscription and resource signals", async () => {
    const connector = getConnectorByKey("azure");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "oauth2ClientCredentials"]));

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "azure",
        mockMode: true
      },
      integrationId: "41414141-4141-4414-8414-414141414141",
      mockMode: true,
      tenantId: "42424242-4242-4424-8424-424242424242"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets.length).toBeGreaterThan(3);
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "CloudAccount",
        "CloudAsset",
        "SecurityGroup",
        "PublicExposure"
      ])
    );

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);

        if (url.includes("/oauth2/v2.0/token")) {
          expect(String(init?.body)).toContain("client_secret=azure-secret");

          return new Response(
            JSON.stringify({
              access_token: "azure-access-token"
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        expect((init?.headers as Record<string, string>).authorization).toBe(
          "Bearer azure-access-token"
        );

        if (url.endsWith("/subscriptions?api-version=2022-12-01")) {
          return new Response(
            JSON.stringify({
              value: [
                {
                  displayName: "Customer Azure Production",
                  state: "Enabled",
                  subscriptionId: "sub-live"
                }
              ]
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (url.includes("/resources?api-version=2021-04-01")) {
          return new Response(
            JSON.stringify({
              value: [
                {
                  id: "/subscriptions/sub-live/resourceGroups/rg-prod/providers/Microsoft.Compute/virtualMachines/app-01",
                  location: "eastus",
                  name: "app-01",
                  tags: {
                    environment: "production"
                  },
                  type: "Microsoft.Compute/virtualMachines"
                },
                {
                  id: "/subscriptions/sub-live/resourceGroups/rg-prod/providers/Microsoft.Network/publicIPAddresses/app-ip",
                  location: "eastus",
                  name: "app-ip",
                  tags: {
                    environment: "production"
                  },
                  type: "Microsoft.Network/publicIPAddresses"
                }
              ]
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (url.includes("/networkSecurityGroups?api-version=2023-09-01")) {
          return new Response(
            JSON.stringify({
              value: [
                {
                  id: "/subscriptions/sub-live/resourceGroups/rg-prod/providers/Microsoft.Network/networkSecurityGroups/nsg-app",
                  location: "eastus",
                  name: "nsg-app",
                  properties: {
                    securityRules: [
                      {
                        properties: {
                          access: "Allow",
                          destinationPortRange: "443",
                          direction: "Inbound",
                          sourceAddressPrefix: "*"
                        }
                      }
                    ]
                  }
                }
              ]
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        return new Response(JSON.stringify({ value: [] }), {
          headers: {
            "content-type": "application/json"
          },
          status: 200
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "oauth2ClientCredentials",
      config: {
        clientId: "azure-client-id",
        clientSecret: "azure-secret",
        connectorKey: "azure",
        subscriptionIds: ["sub-live"],
        tenantId: "tenant-live"
      },
      integrationId: "43434343-4343-4434-8434-434343434343",
      mockMode: false,
      tenantId: "44444444-4444-4444-8444-444444444444"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets.length).toBeGreaterThanOrEqual(4);
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "CloudAccount",
        "CloudAsset",
        "SecurityGroup",
        "PublicExposure"
      ])
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://login.microsoftonline.com/tenant-live/oauth2/v2.0/token",
      expect.objectContaining({
        method: "POST"
      })
    );
    expect(JSON.stringify(liveResult)).not.toContain("azure-secret");
  });

  it("runs Azure Front Door WAF sync with policy posture signals", async () => {
    const connector = getConnectorByKey("azure-front-door-waf");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "oauth2ClientCredentials"]));
    expect(connector!.manifest.requiredPermissions).toEqual(
      expect.arrayContaining([
        "Microsoft.Network/frontDoorWebApplicationFirewallPolicies/read",
        "Microsoft.Resources/subscriptions/read"
      ])
    );

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "azure-front-door-waf",
        mockMode: true
      },
      integrationId: "66666666-6666-4666-8666-666666666666",
      mockMode: true,
      tenantId: "67676767-6767-4676-8676-676767676767"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets.length).toBeGreaterThan(1);
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "WAFRulesConfigured",
        "WAFPolicyDisabled",
        "WAFResourceCoverage",
        "WAFUnassociated"
      ])
    );

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);

        if (url.includes("/oauth2/v2.0/token")) {
          expect(String(init?.body)).toContain(
            "client_secret=azure-waf-secret"
          );

          return new Response(
            JSON.stringify({
              access_token: "azure-waf-access-token"
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        expect((init?.headers as Record<string, string>).authorization).toBe(
          "Bearer azure-waf-access-token"
        );

        if (url.endsWith("/subscriptions?api-version=2022-12-01")) {
          return new Response(
            JSON.stringify({
              value: [
                {
                  displayName: "Customer Azure Production",
                  state: "Enabled",
                  subscriptionId: "sub-waf"
                }
              ]
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        expect(url).toContain(
          "/providers/Microsoft.Network/frontDoorWebApplicationFirewallPolicies"
        );

        return new Response(
          JSON.stringify({
            value: [
              {
                id: "/subscriptions/sub-waf/resourceGroups/rg-edge/providers/Microsoft.Network/frontDoorWebApplicationFirewallPolicies/customer-edge",
                location: "global",
                name: "customer-edge",
                properties: {
                  customRules: {
                    rules: [
                      {
                        name: "block-bad-bot"
                      }
                    ]
                  },
                  frontendEndpointLinks: [
                    {
                      id: "/subscriptions/sub-waf/resourceGroups/rg-edge/providers/Microsoft.Network/frontDoors/customer/frontendEndpoints/www"
                    }
                  ],
                  managedRules: {
                    managedRuleSets: [
                      {
                        ruleSetType: "Microsoft_DefaultRuleSet"
                      }
                    ]
                  },
                  policySettings: {
                    enabledState: "Enabled",
                    mode: "Prevention"
                  }
                }
              }
            ]
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "oauth2ClientCredentials",
      config: {
        clientId: "azure-waf-client-id",
        clientSecret: "azure-waf-secret",
        connectorKey: "azure-front-door-waf",
        subscriptionIds: ["sub-waf"],
        tenantId: "tenant-waf"
      },
      integrationId: "68686868-6868-4686-8686-686868686868",
      mockMode: false,
      tenantId: "69696969-6969-4696-8696-696969696969"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets.length).toBeGreaterThanOrEqual(2);
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining(["WAFRulesConfigured", "WAFResourceCoverage"])
    );
    expect(JSON.stringify(liveResult)).not.toContain("azure-waf-secret");
  });

  it("runs GCP sync with read-only project and asset signals", async () => {
    const connector = getConnectorByKey("gcp");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "accessToken"]));

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "gcp",
        mockMode: true
      },
      integrationId: "51515151-5151-4515-8515-515151515151",
      mockMode: true,
      tenantId: "52525252-5252-4525-8525-525252525252"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets.length).toBeGreaterThan(2);
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "CloudAccount",
        "CloudAsset",
        "SecurityGroup",
        "PublicExposure"
      ])
    );

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);

        expect((init?.headers as Record<string, string>).authorization).toBe(
          "Bearer gcp-access-token"
        );
        expect(url).toContain("/v1/projects/live-gcp-project/assets");

        return new Response(
          JSON.stringify({
            assets: [
              {
                assetType: "compute.googleapis.com/Instance",
                name: "//compute.googleapis.com/projects/live-gcp-project/zones/us-central1-a/instances/web-01",
                resource: {
                  data: {
                    labels: {
                      environment: "production"
                    },
                    location: "us-central1-a",
                    networkInterfaces: [
                      {
                        accessConfigs: [
                          {
                            natIP: "203.0.113.20"
                          }
                        ]
                      }
                    ]
                  }
                }
              },
              {
                assetType: "compute.googleapis.com/Firewall",
                name: "//compute.googleapis.com/projects/live-gcp-project/global/firewalls/allow-https",
                resource: {
                  data: {
                    allowed: [
                      {
                        IPProtocol: "tcp",
                        ports: ["443"]
                      }
                    ],
                    direction: "INGRESS",
                    sourceRanges: ["0.0.0.0/0"]
                  }
                }
              },
              {
                assetType: "storage.googleapis.com/Bucket",
                name: "//storage.googleapis.com/projects/live-gcp-project/buckets/customer-artifacts",
                resource: {
                  data: {
                    labels: {
                      environment: "production"
                    },
                    location: "us"
                  }
                }
              }
            ]
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "accessToken",
      config: {
        accessToken: "gcp-access-token",
        connectorKey: "gcp",
        projectIds: ["live-gcp-project"]
      },
      integrationId: "53535353-5353-4535-8535-535353535353",
      mockMode: false,
      tenantId: "54545454-5454-4545-8545-545454545454"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets.length).toBeGreaterThan(2);
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "CloudAccount",
        "CloudAsset",
        "SecurityGroup",
        "PublicExposure"
      ])
    );
    expect(JSON.stringify(liveResult)).not.toContain("gcp-access-token");
  });

  it("runs DigitalOcean sync through read-only inventory endpoints", async () => {
    const connector = getConnectorByKey("digitalocean");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiToken"]));
    expect(connector!.manifest).toMatchObject({
      availability: "Beta",
      connectable: true,
      marketplaceCategory: "Cloud",
      product: "DigitalOcean"
    });

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "digitalocean",
        mockMode: true
      },
      integrationId: "90909090-9090-4909-9090-909090909090",
      mockMode: true,
      tenantId: "91919191-9191-4919-9191-919191919191"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets.map((asset) => asset.assetType)).toEqual(
      expect.arrayContaining(["CloudResource", "Kubernetes"])
    );
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "DigitalOceanAccountInventory",
        "DigitalOceanDropletObserved",
        "DigitalOceanPublicDropletExposure",
        "DigitalOceanDropletMissingFirewall",
        "DigitalOceanKubernetesClusterObserved"
      ])
    );

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        const parsedUrl = new URL(url);

        expect(init?.method).toBe("GET");
        expect(init).not.toHaveProperty("body");
        expect(init?.headers).toMatchObject({
          authorization: "Bearer digitalocean-secret-token"
        });
        expect(parsedUrl.origin).toBe("https://api.digitalocean.com");
        expect(parsedUrl.pathname).not.toMatch(
          /\/(?:actions|destroy|delete|kubeconfig|credentials|recycle|upgrades|registry)(?:\/|$)/iu
        );

        if (parsedUrl.pathname === "/v2/account") {
          return new Response(
            JSON.stringify({
              account: {
                status: "active",
                team: {
                  name: "Customer Cloud"
                },
                uuid: "account-live"
              }
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (parsedUrl.pathname === "/v2/droplets") {
          return new Response(
            JSON.stringify({
              droplets: [
                {
                  features: ["monitoring"],
                  id: 123,
                  image: {
                    slug: "ubuntu-24-04-x64"
                  },
                  name: "web-01",
                  networks: {
                    v4: [
                      {
                        ip_address: "203.0.113.77",
                        type: "public"
                      },
                      {
                        ip_address: "10.10.0.5",
                        type: "private"
                      }
                    ]
                  },
                  region: {
                    slug: "nyc3"
                  },
                  size_slug: "s-2vcpu-2gb",
                  status: "active",
                  tags: ["production"],
                  vpc_uuid: "vpc-live"
                }
              ],
              links: {}
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (parsedUrl.pathname === "/v2/firewalls") {
          return new Response(
            JSON.stringify({
              firewalls: [
                {
                  droplet_ids: [],
                  id: "firewall-live",
                  inbound_rules: [
                    {
                      protocol: "tcp"
                    }
                  ],
                  name: "default-web",
                  outbound_rules: [
                    {
                      protocol: "tcp"
                    }
                  ],
                  status: "succeeded",
                  tags: []
                }
              ],
              links: {}
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (parsedUrl.pathname === "/v2/kubernetes/clusters") {
          return new Response(
            JSON.stringify({
              kubernetes_clusters: [
                {
                  id: "doks-live",
                  name: "prod-doks",
                  node_pools: [
                    {
                      count: 3
                    }
                  ],
                  region: {
                    slug: "nyc3"
                  },
                  status: {
                    state: "running"
                  },
                  version: "1.32.2-do.0"
                }
              ],
              links: {}
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        return new Response(JSON.stringify({}), {
          headers: {
            "content-type": "application/json"
          },
          status: 404
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "apiToken",
      config: {
        apiToken: "digitalocean-secret-token",
        connectorKey: "digitalocean"
      },
      integrationId: "92929292-9292-4929-9292-929292929292",
      mockMode: false,
      tenantId: "93939393-9393-4939-9393-939393939393"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "DigitalOceanAccountInventory",
        "DigitalOceanDropletObserved",
        "DigitalOceanPublicDropletExposure",
        "DigitalOceanFirewallObserved",
        "DigitalOceanDropletMissingFirewall",
        "DigitalOceanKubernetesClusterObserved"
      ])
    );
    expect(JSON.stringify(liveResult)).not.toContain(
      "digitalocean-secret-token"
    );
    expect(JSON.stringify(liveResult)).not.toContain("203.0.113.77");
  });

  it("flags internet-open sensitive ports as a measured DigitalOcean exposure", async () => {
    const connector = getConnectorByKey("digitalocean");

    expect(connector).toBeDefined();

    // Mock mode uses the bundled fixture, which now models a public db-01 Droplet
    // with SSH (tcp/22) and PostgreSQL (tcp/5432) open to the public internet.
    const mockResult = await connector!.sync({
      authType: "mock",
      config: { connectorKey: "digitalocean", mockMode: true },
      integrationId: "94949494-9494-4949-9494-949494949494",
      mockMode: true,
      tenantId: "95959595-9595-4959-9595-959595959595"
    });

    const mockMeasured = mockResult.signals.filter(
      (signal) =>
        signal.signalSubcategory === "DigitalOceanInternetOpenSensitivePort"
    );

    expect(mockMeasured).toHaveLength(1);
    expect(mockMeasured[0]?.signalCategory).toBe("Exposure");
    expect(mockMeasured[0]?.sourceType).toBe(
      "digitalocean.firewall.internet_open_sensitive_port"
    );
    expect(mockMeasured[0]?.confidence).toBe(0.95);
    expect(mockMeasured[0]?.rawPayloadPointer).toContain("tcp%2F22");
    expect(mockMeasured[0]?.rawPayloadPointer).toContain("tcp%2F5432");
    // web-01 (101) has no firewall, so it must still be reported as a coverage gap,
    // not an internet-open-port finding.
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(expect.arrayContaining(["DigitalOceanDropletMissingFirewall"]));

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const parsedUrl = new URL(String(input));

      if (parsedUrl.pathname === "/v2/account") {
        return new Response(
          JSON.stringify({ account: { status: "active", uuid: "acct-x" } }),
          { headers: { "content-type": "application/json" }, status: 200 }
        );
      }

      if (parsedUrl.pathname === "/v2/droplets") {
        return new Response(
          JSON.stringify({
            droplets: [
              {
                id: 555,
                name: "edge-01",
                networks: {
                  v4: [{ ip_address: "198.51.100.9", type: "public" }]
                },
                region: { slug: "nyc3" },
                status: "active"
              }
            ],
            links: {}
          }),
          { headers: { "content-type": "application/json" }, status: 200 }
        );
      }

      if (parsedUrl.pathname === "/v2/firewalls") {
        return new Response(
          JSON.stringify({
            firewalls: [
              {
                droplet_ids: [555],
                id: "fw-edge",
                inbound_rules: [
                  // SSH open to the whole internet -> measured exposure.
                  {
                    protocol: "tcp",
                    ports: "22",
                    sources: { addresses: ["0.0.0.0/0"] }
                  },
                  // HTTPS open to the internet -> NOT sensitive, must be ignored.
                  {
                    protocol: "tcp",
                    ports: "443",
                    sources: { addresses: ["0.0.0.0/0"] }
                  },
                  // MySQL open only to a private CIDR -> NOT internet-facing.
                  {
                    protocol: "tcp",
                    ports: "3306",
                    sources: { addresses: ["10.0.0.0/8"] }
                  }
                ],
                name: "edge-fw",
                outbound_rules: [],
                status: "succeeded"
              }
            ],
            links: {}
          }),
          { headers: { "content-type": "application/json" }, status: 200 }
        );
      }

      if (parsedUrl.pathname === "/v2/kubernetes/clusters") {
        return new Response(
          JSON.stringify({ kubernetes_clusters: [], links: {} }),
          {
            headers: { "content-type": "application/json" },
            status: 200
          }
        );
      }

      return new Response(JSON.stringify({}), {
        headers: { "content-type": "application/json" },
        status: 404
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "apiToken",
      config: { apiToken: "do-token", connectorKey: "digitalocean" },
      integrationId: "96969696-9696-4969-9696-969696969696",
      mockMode: false,
      tenantId: "97979797-9797-4979-9797-979797979797"
    });

    const measured = liveResult.signals.filter(
      (signal) =>
        signal.signalSubcategory === "DigitalOceanInternetOpenSensitivePort"
    );

    expect(measured).toHaveLength(1);
    // Only SSH (22) is flagged: 443 is not sensitive, 3306 is not internet-open.
    expect(measured[0]?.rawPayloadPointer).toContain("tcp%2F22");
    expect(measured[0]?.rawPayloadPointer).not.toContain("443");
    expect(measured[0]?.rawPayloadPointer).not.toContain("3306");
    expect(JSON.stringify(liveResult)).not.toContain("198.51.100.9");
  });

  it("runs Alibaba Cloud sync through signed read-only inventory APIs", async () => {
    const connector = getConnectorByKey("alibaba-cloud");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "accessKey"]));
    expect(connector!.manifest).toMatchObject({
      availability: "Beta",
      connectable: true,
      marketplaceCategory: "Cloud",
      product: "Alibaba Cloud"
    });
    expect(connector!.manifest.requiredPermissions).toEqual(
      expect.arrayContaining([
        "ecs:DescribeInstances",
        "ecs:DescribeSecurityGroups",
        "ram:ListRoles"
      ])
    );

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "alibaba-cloud",
        mockMode: true
      },
      integrationId: "53535353-5353-4535-9353-535353535353",
      mockMode: true,
      tenantId: "54545454-5454-4545-9454-545454545454"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets.map((asset) => asset.assetType)).toEqual(
      expect.arrayContaining(["CloudResource"])
    );
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "AlibabaCloudAccountInventory",
        "AlibabaEcsInstanceObserved",
        "AlibabaEcsPublicExposure",
        "AlibabaSecurityGroupObserved",
        "AlibabaRamRoleObserved"
      ])
    );

    const fetchMock = vi.fn(async (input: string | URL | Request, init) => {
      const url = String(input);
      const parsedUrl = new URL(url);
      const action = parsedUrl.searchParams.get("Action");

      expect(init?.method).toBe("GET");
      expect(init).not.toHaveProperty("body");
      expect(parsedUrl.searchParams.get("Signature")).toBeTruthy();
      expect(parsedUrl.searchParams.get("SignatureMethod")).toBe("HMAC-SHA1");
      expect(url).not.toContain("aliyun-secret-access-key");
      expect(action).toMatch(
        /^(?:DescribeInstances|DescribeSecurityGroups|ListRoles)$/u
      );
      expect(action).not.toMatch(
        /(?:Create|Update|Modify|Delete|Attach|Detach|Start|Stop|Reboot|Authorize|Revoke|Put|Set|Run|Exec|Shell|Console|Assume|GetCredential)/iu
      );

      if (action === "DescribeInstances") {
        return new Response(
          JSON.stringify({
            Instances: {
              Instance: [
                {
                  EipAddress: {
                    IpAddress: ""
                  },
                  InstanceId: "i-live-web01",
                  InstanceName: "web-01",
                  InternetMaxBandwidthOut: 5,
                  PublicIpAddress: {
                    IpAddress: ["203.0.113.144"]
                  },
                  RegionId: "cn-hangzhou",
                  SecurityGroupIds: {
                    SecurityGroupId: ["sg-live-web"]
                  },
                  Status: "Running",
                  VpcAttributes: {
                    PrivateIpAddress: {
                      IpAddress: ["10.0.1.4"]
                    },
                    VpcId: "vpc-live"
                  },
                  ZoneId: "cn-hangzhou-g"
                }
              ]
            },
            RequestId: "request-instances"
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }

      if (action === "DescribeSecurityGroups") {
        return new Response(
          JSON.stringify({
            RequestId: "request-security-groups",
            SecurityGroups: {
              SecurityGroup: [
                {
                  RegionId: "cn-hangzhou",
                  SecurityGroupId: "sg-live-web",
                  SecurityGroupName: "web-public",
                  ServiceManaged: false,
                  VpcId: "vpc-live"
                }
              ]
            }
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }

      if (action === "ListRoles") {
        return new Response(
          JSON.stringify({
            RequestId: "request-roles",
            Roles: {
              Role: [
                {
                  Arn: "acs:ram::1234567890123456:role/PeriscanReadOnly",
                  RoleName: "PeriscanReadOnly"
                }
              ]
            }
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }

      return new Response(JSON.stringify({}), {
        headers: {
          "content-type": "application/json"
        },
        status: 404
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "accessKey",
      config: {
        accessKeyId: "aliyun-access-key",
        accessKeySecret: "aliyun-secret-access-key",
        accountId: "1234567890123456",
        connectorKey: "alibaba-cloud",
        regionId: "cn-hangzhou"
      },
      integrationId: "55555555-5555-4555-9555-555555555555",
      mockMode: false,
      tenantId: "56565656-5656-4565-9565-565656565656"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "AlibabaCloudAccountInventory",
        "AlibabaEcsInstanceObserved",
        "AlibabaEcsPublicExposure",
        "AlibabaSecurityGroupObserved",
        "AlibabaRamRoleObserved"
      ])
    );
    expect(JSON.stringify(liveResult)).not.toContain(
      "aliyun-secret-access-key"
    );
    expect(JSON.stringify(liveResult)).not.toContain("203.0.113.144");
    expect(JSON.stringify(liveResult)).not.toContain("10.0.1.4");
  });

  it("runs Oracle Cloud Infrastructure sync through signed read-only list APIs", async () => {
    const connector = getConnectorByKey("oracle-cloud");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiSigningKey"]));
    expect(connector!.manifest).toMatchObject({
      availability: "Beta",
      connectable: true,
      marketplaceCategory: "Cloud",
      product: "Oracle Cloud Infrastructure"
    });
    expect(connector!.manifest.requiredPermissions).toEqual(
      expect.arrayContaining([
        "inspect instances in compartment",
        "inspect vcns in compartment",
        "inspect security-lists in compartment"
      ])
    );

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "oracle-cloud",
        mockMode: true
      },
      integrationId: "57575757-5757-4575-9575-575757575757",
      mockMode: true,
      tenantId: "58585858-5858-4585-9585-585858585858"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets.map((asset) => asset.assetType)).toEqual(
      expect.arrayContaining(["CloudResource"])
    );
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "OracleCloudCompartmentInventory",
        "OracleComputeInstanceObserved",
        "OracleVcnObserved",
        "OracleSecurityListObserved",
        "OracleSecurityListInternetOpenIngress"
      ])
    );

    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: {
        format: "pem",
        type: "pkcs8"
      },
      publicKeyEncoding: {
        format: "pem",
        type: "spki"
      }
    });
    const fetchMock = vi.fn(async (input: string | URL | Request, init) => {
      const url = String(input);
      const parsedUrl = new URL(url);
      const authorization = String(
        (init?.headers as Record<string, string> | undefined)?.authorization ??
          ""
      );

      expect(init?.method).toBe("GET");
      expect(init).not.toHaveProperty("body");
      expect(parsedUrl.origin).toBe(
        "https://iaas.us-ashburn-1.oraclecloud.com"
      );
      expect(parsedUrl.pathname).toMatch(
        /^\/20160918\/(?:instances|vcns|securityLists)$/u
      );
      expect(parsedUrl.pathname).not.toMatch(
        /(?:Create|Update|Delete|Attach|Detach|Launch|Terminate|Start|Stop|Reboot|Reset|Console|Command|Capture|Put|Patch|Upload|Download|Secret|Credential|Object)/iu
      );
      expect(authorization).toContain('Signature version="1"');
      expect(authorization).toContain('algorithm="rsa-sha256"');
      expect(authorization).toContain('headers="(request-target) host date"');
      expect(authorization).not.toContain("PRIVATE KEY");

      if (parsedUrl.pathname === "/20160918/instances") {
        return new Response(
          JSON.stringify([
            {
              availabilityDomain: "Uocm:IAD-AD-1",
              compartmentId:
                "ocid1.compartment.oc1..aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              displayName: "web-01",
              id: "ocid1.instance.oc1.iad.web01",
              lifecycleState: "RUNNING",
              shape: "VM.Standard.E4.Flex"
            }
          ]),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }

      if (parsedUrl.pathname === "/20160918/vcns") {
        return new Response(
          JSON.stringify([
            {
              cidrBlock: "10.42.0.0/16",
              compartmentId:
                "ocid1.compartment.oc1..aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              displayName: "prod-vcn",
              id: "ocid1.vcn.oc1.iad.prod"
            }
          ]),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }

      if (parsedUrl.pathname === "/20160918/securityLists") {
        return new Response(
          JSON.stringify([
            {
              compartmentId:
                "ocid1.compartment.oc1..aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              displayName: "public-web",
              id: "ocid1.securitylist.oc1.iad.publicweb",
              ingressSecurityRules: [
                {
                  protocol: "6",
                  source: "0.0.0.0/0",
                  tcpOptions: {
                    destinationPortRange: {
                      max: 443,
                      min: 443
                    }
                  }
                }
              ],
              vcnId: "ocid1.vcn.oc1.iad.prod"
            }
          ]),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }

      return new Response(JSON.stringify([]), {
        headers: {
          "content-type": "application/json"
        },
        status: 404
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "apiSigningKey",
      config: {
        compartmentId:
          "ocid1.compartment.oc1..aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        connectorKey: "oracle-cloud",
        fingerprint: "aa:bb:cc:dd",
        privateKeyPem: privateKey,
        region: "us-ashburn-1",
        tenancyOcid:
          "ocid1.tenancy.oc1..aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        userOcid:
          "ocid1.user.oc1..aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      integrationId: "59595959-5959-4595-9595-595959595959",
      mockMode: false,
      tenantId: "60606060-6060-4606-9606-606060606060"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "OracleCloudCompartmentInventory",
        "OracleComputeInstanceObserved",
        "OracleVcnObserved",
        "OracleSecurityListObserved",
        "OracleSecurityListInternetOpenIngress"
      ])
    );
    expect(JSON.stringify(liveResult)).not.toContain("PRIVATE KEY");
    expect(JSON.stringify(liveResult)).not.toContain("10.42.0.0/16");
  });

  it("runs Heroku sync through read-only inventory endpoints", async () => {
    const connector = getConnectorByKey("heroku");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiToken"]));
    expect(connector!.manifest).toMatchObject({
      availability: "Beta",
      connectable: true,
      marketplaceCategory: "Cloud",
      product: "Heroku"
    });

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "heroku",
        mockMode: true
      },
      integrationId: "94949494-9494-4949-9494-949494949494",
      mockMode: true,
      tenantId: "95959595-9595-4959-9595-959595959595"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets.map((asset) => asset.assetType)).toEqual(
      expect.arrayContaining(["Application", "CloudResource"])
    );
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "HerokuAccountInventory",
        "HerokuAppObserved",
        "HerokuPublicAppExposure",
        "HerokuFormationObserved"
      ])
    );

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        const parsedUrl = new URL(url);

        expect(init?.method).toBe("GET");
        expect(init).not.toHaveProperty("body");
        expect(init?.headers).toMatchObject({
          accept: "application/vnd.heroku+json; version=3",
          authorization: "Bearer heroku-secret-token"
        });
        expect(parsedUrl.origin).toBe("https://api.heroku.com");
        expect(parsedUrl.pathname).not.toMatch(
          /\/(?:config-vars|logs?|builds?|releases?|dynos?|addons?|actions?|transfers?|oauth|authorizations?)(?:\/|$)/iu
        );

        if (parsedUrl.pathname === "/account") {
          return new Response(
            JSON.stringify({
              id: "heroku-account-live",
              verified: true
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (parsedUrl.pathname === "/apps") {
          return new Response(
            JSON.stringify([
              {
                archived_at: null,
                id: "app-live",
                internal_routing: false,
                maintenance: true,
                name: "customer-api",
                owner: {
                  type: "team"
                },
                region: {
                  name: "us"
                },
                stack: {
                  name: "heroku-24"
                },
                web_url: "https://customer-api.herokuapp.com/"
              }
            ]),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (parsedUrl.pathname === "/apps/app-live/formation") {
          return new Response(
            JSON.stringify([
              {
                command: "node server.js",
                quantity: 2,
                size: {
                  name: "standard-1x"
                },
                type: "web"
              }
            ]),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (parsedUrl.pathname === "/apps/app-live/domains") {
          return new Response(
            JSON.stringify([
              {
                cname: "customer-api.herokudns.com",
                hostname: "api.customer.example",
                id: "domain-live",
                kind: "custom",
                status: "succeeded"
              }
            ]),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        return new Response(JSON.stringify({}), {
          headers: {
            "content-type": "application/json"
          },
          status: 404
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "apiToken",
      config: {
        apiToken: "heroku-secret-token",
        connectorKey: "heroku"
      },
      integrationId: "96969696-9696-4969-9696-969696969696",
      mockMode: false,
      tenantId: "97979797-9797-4979-9797-979797979797"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "HerokuAccountInventory",
        "HerokuAppObserved",
        "HerokuPublicAppExposure",
        "HerokuFormationObserved",
        "HerokuMaintenanceModeEnabled"
      ])
    );
    expect(JSON.stringify(liveResult)).not.toContain("heroku-secret-token");
    expect(JSON.stringify(liveResult)).not.toContain("api.customer.example");
    expect(JSON.stringify(liveResult)).not.toContain("node server.js");
  });

  it("runs Databricks sync through read-only workspace metadata endpoints", async () => {
    const connector = getConnectorByKey("databricks");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "pat"]));
    expect(connector!.manifest).toMatchObject({
      availability: "Beta",
      connectable: true,
      marketplaceCategory: "Cloud",
      product: "Databricks"
    });

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "databricks",
        mockMode: true
      },
      integrationId: "98989898-9898-4989-9898-989898989898",
      mockMode: true,
      tenantId: "99999999-9999-4999-9999-999999999999"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets.map((asset) => asset.assetType)).toEqual(
      expect.arrayContaining(["Application", "CloudResource"])
    );
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "DatabricksWorkspaceInventory",
        "DatabricksClusterObserved",
        "DatabricksJobObserved",
        "DatabricksSQLWarehouseObserved",
        "DatabricksWorkspaceObjectObserved"
      ])
    );

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        const parsedUrl = new URL(url);

        expect(init?.method).toBe("GET");
        expect(init).not.toHaveProperty("body");
        expect(init?.headers).toMatchObject({
          accept: "application/json",
          authorization: "Bearer databricks-secret-token"
        });
        expect(parsedUrl.origin).toBe("https://dbc-live.cloud.databricks.com");
        expect(parsedUrl.pathname).not.toMatch(
          /\/(?:commands?|command-execution|runs?|run-now|submit|cancel|create|delete|edit|reset|start|restart|resize|terminate|permanent-delete|export|import|dbfs|secrets?|permissions)(?:\/|$)/iu
        );

        if (parsedUrl.pathname === "/api/2.0/clusters/list") {
          return new Response(
            JSON.stringify({
              clusters: [
                {
                  autotermination_minutes: 15,
                  cluster_id: "cluster-live",
                  cluster_name: "prod-etl-cluster",
                  cluster_source: "UI",
                  data_security_mode: null,
                  node_type_id: "i3.xlarge",
                  spark_conf: {
                    "spark.secret.scope": "secret-scope"
                  },
                  spark_version: "14.3.x-scala2.12",
                  state: "RUNNING"
                }
              ]
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (parsedUrl.pathname === "/api/2.1/jobs/list") {
          expect(parsedUrl.searchParams.get("limit")).toBe("25");

          return new Response(
            JSON.stringify({
              jobs: [
                {
                  job_id: 12345,
                  settings: {
                    format: "MULTI_TASK",
                    git_source: {
                      git_url: "https://github.com/customer/private-repo"
                    },
                    name: "prod-ingest-job",
                    schedule: {
                      quartz_cron_expression: "0 0 1 * * ?"
                    },
                    tasks: [
                      {
                        notebook_task: {
                          base_parameters: {
                            query: "SELECT * FROM sensitive_table"
                          },
                          notebook_path: "/Users/alice@example.com/Revenue"
                        }
                      }
                    ]
                  }
                }
              ]
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (parsedUrl.pathname === "/api/2.0/sql/warehouses") {
          return new Response(
            JSON.stringify({
              warehouses: [
                {
                  auto_stop_mins: 10,
                  channel: {
                    name: "CHANNEL_NAME_CURRENT"
                  },
                  cluster_size: "Small",
                  id: "warehouse-live",
                  name: "prod-warehouse",
                  state: "RUNNING",
                  warehouse_type: "PRO"
                }
              ]
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (parsedUrl.pathname === "/api/2.0/workspace/list") {
          expect(parsedUrl.searchParams.get("path")).toBe("/");

          return new Response(
            JSON.stringify({
              objects: [
                {
                  language: "PYTHON",
                  object_id: 456,
                  object_type: "NOTEBOOK",
                  path: "/Users/alice@example.com/Revenue"
                },
                {
                  object_id: 789,
                  object_type: "FILE",
                  path: "dbfs:/mnt/customer/raw.json"
                }
              ]
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        return new Response(JSON.stringify({}), {
          headers: {
            "content-type": "application/json"
          },
          status: 404
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "pat",
      config: {
        connectorKey: "databricks",
        patToken: "databricks-secret-token",
        workspaceUrl: "https://dbc-live.cloud.databricks.com"
      },
      integrationId: "9a9a9a9a-9a9a-4a9a-9a9a-9a9a9a9a9a9a",
      mockMode: false,
      tenantId: "9b9b9b9b-9b9b-4b9b-9b9b-9b9b9b9b9b9b"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "DatabricksWorkspaceInventory",
        "DatabricksClusterObserved",
        "DatabricksClusterAccessModeMissing",
        "DatabricksJobObserved",
        "DatabricksJobGitSourceObserved",
        "DatabricksSQLWarehouseObserved",
        "DatabricksWorkspaceObjectObserved"
      ])
    );
    expect(JSON.stringify(liveResult)).not.toContain("databricks-secret-token");
    expect(JSON.stringify(liveResult)).not.toContain("secret-scope");
    expect(JSON.stringify(liveResult)).not.toContain(
      "/Users/alice@example.com/Revenue"
    );
    expect(JSON.stringify(liveResult)).not.toContain("dbfs:/mnt/customer");
    expect(JSON.stringify(liveResult)).not.toContain(
      "SELECT * FROM sensitive_table"
    );
  });

  it("runs Snowflake sync through generated read-only SQL API statements", async () => {
    const connector = getConnectorByKey("snowflake");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "accessToken"]));
    expect(connector!.manifest).toMatchObject({
      availability: "Beta",
      connectable: true,
      marketplaceCategory: "Cloud",
      product: "Snowflake"
    });
    expect(connector!.manifest.requiredPermissions).toEqual(
      expect.arrayContaining([
        "SELECT SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSES",
        "SELECT SNOWFLAKE.ACCOUNT_USAGE.USERS"
      ])
    );

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "snowflake",
        mockMode: true
      },
      integrationId: "9c9c9c9c-9c9c-4c9c-9c9c-9c9c9c9c9c9c",
      mockMode: true,
      tenantId: "9d9d9d9d-9d9d-4d9d-9d9d-9d9d9d9d9d9d"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets.map((asset) => asset.assetType)).toEqual(
      expect.arrayContaining(["Service", "CloudResource"])
    );
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "SnowflakeAccountInventory",
        "SnowflakeWarehouseObserved",
        "SnowflakeWarehouseCostGuardrailGap",
        "SnowflakeDatabaseObserved",
        "SnowflakeSchemaObserved",
        "SnowflakeUserObserved",
        "SnowflakeUserMfaGapObserved",
        "SnowflakePrivilegedGrantObserved"
      ])
    );

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        const parsedUrl = new URL(url);
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          statement?: string;
        };
        const statement = body.statement ?? "";

        expect(init?.method).toBe("POST");
        expect(parsedUrl.origin).toBe("https://acme.snowflakecomputing.com");
        expect(parsedUrl.pathname).toBe("/api/v2/statements");
        expect(init?.headers).toMatchObject({
          accept: "application/json",
          authorization: "Bearer snowflake-secret-token",
          "content-type": "application/json"
        });
        expect(statement).toMatch(/^SELECT\b/iu);
        expect(statement).not.toMatch(
          /\b(?:ALTER|CALL|COPY|CREATE|DELETE|DROP|EXEC(?:UTE)?|GET|GRANT|INSERT|MERGE|PUT|REMOVE|REVOKE|TRUNCATE|UPDATE|USE)\b|;/iu
        );

        const rows = statement.includes("CURRENT_ACCOUNT")
          ? [{ ACCOUNT_NAME: "ACME_PROD" }]
          : statement.includes("WAREHOUSES")
            ? [
                {
                  AUTO_SUSPEND: 0,
                  SIZE: "X-LARGE",
                  STATE: "STARTED",
                  WAREHOUSE_NAME: "LIVE_WH"
                }
              ]
            : statement.includes("DATABASES")
              ? [
                  {
                    CREATED_ON: "2026-06-01T00:00:00.000Z",
                    DATABASE_NAME: "CUSTOMER_APP",
                    OWNER: "SYSADMIN"
                  }
                ]
              : statement.includes("SCHEMATA")
                ? [
                    {
                      DATABASE_NAME: "CUSTOMER_APP",
                      OWNER: "SYSADMIN",
                      SCHEMA_NAME: "PUBLIC"
                    }
                  ]
                : statement.includes("USERS")
                  ? [
                      {
                        DEFAULT_ROLE: "ACCOUNTADMIN",
                        DISABLED: false,
                        HAS_MFA: false,
                        HAS_PASSWORD: true,
                        NAME: "LIVE_BREAK_GLASS"
                      }
                    ]
                  : statement.includes("GRANTS_TO_ROLES")
                    ? [
                        {
                          GRANTEE_NAME: "SECURITYADMIN",
                          GRANTED_ON: "ROLE",
                          NAME: "ACCOUNTADMIN",
                          PRIVILEGE: "USAGE"
                        }
                      ]
                    : [];

        return new Response(JSON.stringify({ rows }), {
          headers: {
            "content-type": "application/json"
          },
          status: 200
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "accessToken",
      config: {
        accessToken: "snowflake-secret-token",
        accountUrl: "https://acme.snowflakecomputing.com",
        connectorKey: "snowflake",
        database: "SNOWFLAKE",
        role: "PERISCAN_READONLY",
        statementLimit: 10,
        warehouse: "PERISCAN_WH"
      },
      integrationId: "9e9e9e9e-9e9e-4e9e-9e9e-9e9e9e9e9e9e",
      mockMode: false,
      tenantId: "9f9f9f9f-9f9f-4f9f-9f9f-9f9f9f9f9f9f"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(fetchMock).toHaveBeenCalledTimes(7);
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "SnowflakeAccountInventory",
        "SnowflakeWarehouseObserved",
        "SnowflakeWarehouseCostGuardrailGap",
        "SnowflakeDatabaseObserved",
        "SnowflakeSchemaObserved",
        "SnowflakeUserObserved",
        "SnowflakeUserMfaGapObserved",
        "SnowflakePrivilegedGrantObserved"
      ])
    );
    expect(JSON.stringify(liveResult)).not.toContain("snowflake-secret-token");
  });

  it("runs Cloudflare sync with DNS exposure and WAF posture signals", async () => {
    const connector = getConnectorByKey("cloudflare");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiToken"]));

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "cloudflare",
        mockMode: true
      },
      integrationId: "54545454-5454-4545-8545-545454545454",
      mockMode: true,
      tenantId: "64646464-6464-4646-8646-646464646464"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets.map((asset) => asset.assetType)).toEqual(
      expect.arrayContaining(["Domain", "Service"])
    );
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "CloudflareZone",
        "DNSRecord",
        "DirectOriginExposure",
        "WAFRulesConfigured"
      ])
    );

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);

      if (url.endsWith("/client/v4/user/tokens/verify")) {
        return new Response(
          JSON.stringify({
            result: {
              id: "token-id"
            },
            success: true
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }

      if (url.endsWith("/client/v4/zones?per_page=50")) {
        return new Response(
          JSON.stringify({
            result: [
              {
                id: "zone-live",
                name: "customer.example",
                status: "active"
              }
            ],
            success: true
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }

      if (url.includes("/dns_records")) {
        return new Response(
          JSON.stringify({
            result: [
              {
                content: "198.51.100.10",
                id: "dns-live-root",
                name: "customer.example",
                proxied: true,
                type: "A"
              },
              {
                content: "origin.customer.example",
                id: "dns-live-origin",
                name: "origin.customer.example",
                proxied: false,
                type: "CNAME"
              }
            ],
            success: true
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }

      if (url.includes("/rulesets")) {
        return new Response(
          JSON.stringify({
            result: [
              {
                id: "ruleset-live",
                kind: "zone",
                name: "Managed WAF",
                phase: "http_request_firewall_managed",
                rules: [{ id: "rule-1" }]
              }
            ],
            success: true
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }

      return new Response(
        JSON.stringify({
          result: [],
          success: true
        }),
        {
          headers: {
            "content-type": "application/json"
          },
          status: 200
        }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "apiToken",
      config: {
        apiToken: "cloudflare-secret-token",
        connectorKey: "cloudflare"
      },
      integrationId: "65656565-6565-4656-8656-656565656565",
      mockMode: false,
      tenantId: "75757575-7575-4757-8757-757575757575"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets).toHaveLength(3);
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "CloudflareZone",
        "DNSRecord",
        "DirectOriginExposure",
        "WAFRulesConfigured"
      ])
    );
    expect(JSON.stringify(liveResult)).not.toContain("cloudflare-secret-token");
  });

  it("runs Kubernetes sync through read-only inventory endpoints", async () => {
    const connector = getConnectorByKey("kubernetes");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiToken"]));
    expect(connector!.manifest).toMatchObject({
      availability: "Beta",
      connectable: true,
      marketplaceCategory: "Cloud",
      product: "Kubernetes"
    });

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "kubernetes",
        mockMode: true
      },
      integrationId: "86868686-8686-4868-8686-868686868686",
      mockMode: true,
      tenantId: "87878787-8787-4878-8787-878787878787"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets.map((asset) => asset.assetType)).toContain(
      "Kubernetes"
    );
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "KubernetesClusterInventory",
        "KubernetesNamespaceDeclared",
        "KubernetesPodObserved",
        "KubernetesDeploymentObserved",
        "KubernetesServiceObserved",
        "KubernetesPublicServiceExposure",
        "KubernetesPrivilegedWorkloadObserved",
        "KubernetesHostNamespaceWorkloadObserved",
        "KubernetesNamespaceMissingNetworkPolicy"
      ])
    );

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        const parsedUrl = new URL(url);

        expect(init?.method).toBe("GET");
        expect(init).not.toHaveProperty("body");
        expect(init?.headers).toMatchObject({
          authorization: "Bearer kubernetes-secret-token"
        });
        expect(parsedUrl.origin).toBe("https://k8s.example");
        expect(parsedUrl.pathname).not.toMatch(
          /\/(?:exec|log|proxy|portforward|attach|secrets)(?:\/|$)/iu
        );

        if (parsedUrl.pathname === "/version") {
          return new Response(
            JSON.stringify({
              gitVersion: "v1.36.0"
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (parsedUrl.pathname.endsWith("/pods")) {
          return new Response(
            JSON.stringify({
              items: [
                {
                  metadata: {
                    name: "api-pod",
                    namespace: "production"
                  },
                  spec: {
                    automountServiceAccountToken: true,
                    containers: [
                      {
                        image: "registry.example/api:1",
                        name: "api"
                      }
                    ]
                  },
                  status: {
                    containerStatuses: [
                      {
                        ready: true
                      }
                    ]
                  }
                }
              ]
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (parsedUrl.pathname.endsWith("/services")) {
          return new Response(
            JSON.stringify({
              items: [
                {
                  metadata: {
                    name: "api-public",
                    namespace: "production"
                  },
                  spec: {
                    ports: [
                      {
                        port: 443
                      }
                    ],
                    type: "LoadBalancer"
                  },
                  status: {
                    loadBalancer: {
                      ingress: [
                        {
                          hostname: "api.customer.example"
                        }
                      ]
                    }
                  }
                }
              ]
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (parsedUrl.pathname.endsWith("/deployments")) {
          return new Response(
            JSON.stringify({
              items: [
                {
                  metadata: {
                    name: "api",
                    namespace: "production"
                  },
                  spec: {
                    replicas: 2,
                    template: {
                      spec: {
                        automountServiceAccountToken: false,
                        containers: [
                          {
                            image: "registry.example/api:1",
                            name: "api"
                          }
                        ]
                      }
                    }
                  },
                  status: {
                    readyReplicas: 2
                  }
                }
              ]
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (parsedUrl.pathname.endsWith("/networkpolicies")) {
          return new Response(
            JSON.stringify({
              items: [
                {
                  metadata: {
                    name: "default-deny",
                    namespace: "production"
                  },
                  spec: {
                    podSelector: {},
                    policyTypes: ["Ingress", "Egress"]
                  }
                }
              ]
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        return new Response(JSON.stringify({ items: [] }), {
          headers: {
            "content-type": "application/json"
          },
          status: 200
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "apiToken",
      config: {
        apiServerUrl: "https://k8s.example",
        bearerToken: "kubernetes-secret-token",
        clusterName: "prod-cluster",
        connectorKey: "kubernetes",
        namespaceNames: ["production"]
      },
      integrationId: "88888888-8888-4888-8888-888888888888",
      mockMode: false,
      tenantId: "89898989-8989-4898-8989-898989898989"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(
      liveResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "KubernetesPodObserved",
        "KubernetesDeploymentObserved",
        "KubernetesServiceObserved",
        "KubernetesPublicServiceExposure",
        "KubernetesNamespaceWideNetworkPolicyDeclared"
      ])
    );
    expect(JSON.stringify(liveResult)).not.toContain("kubernetes-secret-token");
    expect(JSON.stringify(liveResult)).not.toContain("api.customer.example");
  });

  it("runs OpenAI sync with read-only model inventory signals", async () => {
    const connector = getConnectorByKey("openai");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiKey"]));

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "openai",
        mockMode: true
      },
      integrationId: "76767676-7676-4767-8767-767676767676",
      mockMode: true,
      tenantId: "86868686-8686-4868-8868-868686868686"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets[0]?.assetType).toBe("Application");
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(expect.arrayContaining(["AIModelAvailable"]));

    const fetchMock = vi.fn(async (_input: string | URL | Request) => {
      void _input;

      return new Response(
        JSON.stringify({
          data: [
            {
              id: "gpt-5-mini",
              object: "model",
              owned_by: "openai"
            },
            {
              id: "gpt-5",
              object: "model",
              owned_by: "openai"
            }
          ],
          object: "list"
        }),
        {
          headers: {
            "content-type": "application/json"
          },
          status: 200
        }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "apiKey",
      config: {
        apiKey: "openai-secret-key",
        connectorKey: "openai",
        organizationId: "org_123",
        projectId: "proj_123"
      },
      integrationId: "87878787-8787-4878-8878-878787878787",
      mockMode: false,
      tenantId: "97979797-9797-4979-8979-979797979797"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/models",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer openai-secret-key",
          "x-openai-organization": "org_123",
          "x-openai-project": "proj_123"
        })
      })
    );
    expect(JSON.stringify(liveResult)).not.toContain("openai-secret-key");
  });

  it("runs Anthropic sync with read-only model inventory signals", async () => {
    const connector = getConnectorByKey("anthropic");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiKey"]));

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "anthropic",
        mockMode: true
      },
      integrationId: "f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1",
      mockMode: true,
      tenantId: "f2f2f2f2-f2f2-4f2f-8f2f-f2f2f2f2f2f2"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets).toHaveLength(2);
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(expect.arrayContaining(["AIModelAvailable"]));

    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: [
              {
                created_at: "2026-01-01T00:00:00Z",
                display_name: "Claude 3.5 Sonnet",
                id: "claude-3-5-sonnet-latest"
              }
            ]
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        )
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "apiKey",
      config: {
        apiKey: "anthropic-secret-key",
        baseUrl: "https://api.anthropic.com",
        connectorKey: "anthropic",
        version: "2023-06-01"
      },
      integrationId: "f3f3f3f3-f3f3-4f3f-8f3f-f3f3f3f3f3f3",
      mockMode: false,
      tenantId: "f4f4f4f4-f4f4-4f4f-8f4f-f4f4f4f4f4f4"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets).toHaveLength(1);
    expect(liveResult.assets[0]?.identifiers).toMatchObject({
      modelId: "claude-3-5-sonnet-latest",
      resourceKind: "AnthropicModel"
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/models",
      expect.objectContaining({
        headers: expect.objectContaining({
          "anthropic-version": "2023-06-01",
          "x-api-key": "anthropic-secret-key"
        })
      })
    );
    expect(JSON.stringify(liveResult)).not.toContain("anthropic-secret-key");
  });

  it("runs Azure OpenAI sync with read-only deployment inventory signals", async () => {
    const connector = getConnectorByKey("azure-openai");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiKey"]));

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "azure-openai",
        mockMode: true
      },
      integrationId: "98989898-9898-4989-8989-989898989898",
      mockMode: true,
      tenantId: "a8a8a8a8-a8a8-4a8a-8a8a-a8a8a8a8a8a8"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets[0]?.assetType).toBe("Application");
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(expect.arrayContaining(["AIDeploymentAvailable"]));

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      expect(String(input)).toBe(
        "https://periscan-ai.openai.azure.com/openai/deployments?api-version=2024-02-15-preview"
      );

      return new Response(
        JSON.stringify({
          data: [
            {
              id: "periscan-safe-validation",
              model: {
                name: "gpt-5-mini"
              },
              status: "succeeded"
            }
          ]
        }),
        {
          headers: {
            "content-type": "application/json"
          },
          status: 200
        }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "apiKey",
      config: {
        apiKey: "azure-openai-secret-key",
        connectorKey: "azure-openai",
        endpoint: "https://periscan-ai.openai.azure.com"
      },
      integrationId: "b8b8b8b8-b8b8-4b8b-8b8b-b8b8b8b8b8b8",
      mockMode: false,
      tenantId: "c8c8c8c8-c8c8-4c8c-8c8c-c8c8c8c8c8c8"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://periscan-ai.openai.azure.com/openai/deployments?api-version=2024-02-15-preview",
      expect.objectContaining({
        headers: expect.objectContaining({
          "api-key": "azure-openai-secret-key"
        })
      })
    );
    expect(JSON.stringify(liveResult)).not.toContain("azure-openai-secret-key");
  });

  it("runs Google Vertex AI sync with read-only endpoint and publisher model inventory signals", async () => {
    const connector = getConnectorByKey("vertex-ai");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "accessToken"]));

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "vertex-ai",
        mockMode: true
      },
      integrationId: "f8f8f8f8-f8f8-4f8f-8f8f-f8f8f8f8f8f8",
      mockMode: true,
      tenantId: "e8e8e8e8-e8e8-4e8e-8e8e-e8e8e8e8e8e8"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets).toHaveLength(2);
    expect(mockResult.assets[0]?.identifiers).toMatchObject({
      resourceKind: "VertexAIEndpoint"
    });
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "AIEndpointAvailable",
        "AIPublisherModelAvailable"
      ])
    );

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);

      expect(url).not.toMatch(
        /\/(?:predict|rawPredict|directPredict|generateContent|streamGenerateContent|deployModel|undeployModel|mutateDeployedModel|batchPredict|trainingPipelines|tuningJobs)\b/u
      );

      if (
        url ===
        "https://aiplatform.googleapis.test/v1/projects/periscan-prod/locations/us-central1/endpoints?pageSize=2"
      ) {
        return new Response(
          JSON.stringify({
            endpoints: [
              {
                deployedModels: [
                  {
                    id: "deployed-gemini-15-pro",
                    model:
                      "projects/periscan-prod/locations/us-central1/models/gemini-15-pro"
                  }
                ],
                displayName: "customer-rag-endpoint",
                name: "projects/periscan-prod/locations/us-central1/endpoints/123"
              }
            ]
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }

      expect(url).toBe(
        "https://aiplatform.googleapis.test/v1beta1/publishers/google/models?pageSize=2"
      );

      return new Response(
        JSON.stringify({
          publisherModels: [
            {
              displayName: "Gemini 1.5 Pro",
              name: "publishers/google/models/gemini-1.5-pro",
              versionId: "001"
            }
          ]
        }),
        {
          headers: {
            "content-type": "application/json"
          },
          status: 200
        }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "accessToken",
      config: {
        accessToken: "vertex-access-token",
        apiBaseUrl: "https://aiplatform.googleapis.test",
        connectorKey: "vertex-ai",
        location: "us-central1",
        projectId: "periscan-prod",
        publisher: "google",
        queryLimit: 2
      },
      integrationId: "d8d8d8d8-d8d8-4d8d-8d8d-d8d8d8d8d8d8",
      mockMode: false,
      tenantId: "c8c8c8c8-c8c8-4c8c-8c8c-c8c8c8c8c8c8"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets).toHaveLength(2);
    expect(liveResult.assets[0]?.name).toBe(
      "vertex-ai-endpoint/customer-rag-endpoint"
    );
    expect(liveResult.signals.map((signal) => signal.sourceType)).toEqual(
      expect.arrayContaining([
        "vertex_ai.endpoints.endpoint",
        "vertex_ai.publisher_models.model"
      ])
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://aiplatform.googleapis.test/v1/projects/periscan-prod/locations/us-central1/endpoints?pageSize=2",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer vertex-access-token"
        })
      })
    );
    expect(JSON.stringify(liveResult)).not.toContain("vertex-access-token");
  });

  it("runs Pinecone sync with read-only vector index inventory signals", async () => {
    const connector = getConnectorByKey("pinecone");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiKey"]));

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "pinecone",
        mockMode: true
      },
      integrationId: "f7f7f7f7-f7f7-4f7f-8f7f-f7f7f7f7f7f7",
      mockMode: true,
      tenantId: "e7e7e7e7-e7e7-4e7e-8e7e-e7e7e7e7e7e7"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets).toHaveLength(2);
    expect(mockResult.assets[0]?.identifiers).toMatchObject({
      resourceKind: "PineconeIndex"
    });
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "VectorIndexAvailable",
        "VectorIndexNotReady",
        "VectorIndexDeletionProtectionDisabled"
      ])
    );

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);

      expect(url).toBe("https://api.pinecone.test/indexes");
      expect(url).not.toMatch(
        /\/(?:query|search|vectors|records|upsert|delete|embed|rerank)\b/u
      );

      return new Response(
        JSON.stringify({
          indexes: [
            {
              deletion_protection: "enabled",
              dimension: 1536,
              host: "customer-rag-prod.svc.us-east-1-aws.pinecone.io",
              metric: "cosine",
              name: "customer-rag-prod",
              spec: {
                serverless: {
                  cloud: "aws",
                  region: "us-east-1"
                }
              },
              status: {
                ready: true,
                state: "Ready"
              },
              tags: {
                environment: "production"
              },
              vector_type: "dense"
            }
          ]
        }),
        {
          headers: {
            "content-type": "application/json"
          },
          status: 200
        }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "apiKey",
      config: {
        apiBaseUrl: "https://api.pinecone.test",
        apiKey: "pinecone-secret-key",
        apiVersion: "2026-04",
        connectorKey: "pinecone"
      },
      integrationId: "d7d7d7d7-d7d7-4d7d-8d7d-d7d7d7d7d7d7",
      mockMode: false,
      tenantId: "c7c7c7c7-c7c7-4c7c-8c7c-c7c7c7c7c7c7"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets).toHaveLength(1);
    expect(liveResult.assets[0]?.name).toBe("pinecone-index/customer-rag-prod");
    expect(liveResult.signals[0]?.sourceType).toBe("pinecone.indexes.index");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.pinecone.test/indexes",
      expect.objectContaining({
        headers: expect.objectContaining({
          "Api-Key": "pinecone-secret-key",
          "X-Pinecone-Api-Version": "2026-04"
        })
      })
    );
    expect(JSON.stringify(liveResult)).not.toContain("pinecone-secret-key");
  });

  it("runs Weaviate sync with read-only schema and metadata signals", async () => {
    const connector = getConnectorByKey("weaviate");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiKey"]));

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "weaviate",
        mockMode: true
      },
      integrationId: "f6f6f6f6-f6f6-4f6f-8f6f-f6f6f6f6f6f6",
      mockMode: true,
      tenantId: "e6e6e6e6-e6e6-4e6e-8e6e-e6e6e6e6e6e6"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets).toHaveLength(2);
    expect(mockResult.assets[0]?.identifiers).toMatchObject({
      resourceKind: "WeaviateCollection"
    });
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "VectorCollectionAvailable",
        "VectorCollectionSingleTenant",
        "VectorizerConfigured"
      ])
    );

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);

      expect(url).toMatch(
        /^https:\/\/weaviate\.example\.test\/v1\/(?:schema|meta)$/u
      );
      expect(url).not.toMatch(
        /\/(?:graphql|objects|batch|backups|classifications|nodes|tenants|replicate|search|query)\b/u
      );

      if (url.endsWith("/v1/schema")) {
        return new Response(
          JSON.stringify({
            classes: [
              {
                class: "CustomerDocument",
                description: "Customer RAG documents",
                multiTenancyConfig: {
                  enabled: true
                },
                properties: [
                  {
                    dataType: ["text"],
                    name: "title"
                  },
                  {
                    dataType: ["text"],
                    name: "body"
                  }
                ],
                replicationConfig: {
                  factor: 3
                },
                vectorIndexType: "hnsw",
                vectorizer: "text2vec-openai"
              }
            ]
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }

      return new Response(
        JSON.stringify({
          hostname: "weaviate-prod",
          modules: {
            "generative-openai": {},
            "text2vec-openai": {}
          },
          version: "1.32.0"
        }),
        {
          headers: {
            "content-type": "application/json"
          },
          status: 200
        }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "apiKey",
      config: {
        apiKey: "weaviate-secret-key",
        baseUrl: "https://weaviate.example.test",
        connectorKey: "weaviate"
      },
      integrationId: "d6d6d6d6-d6d6-4d6d-8d6d-d6d6d6d6d6d6",
      mockMode: false,
      tenantId: "c6c6c6c6-c6c6-4c6c-8c6c-c6c6c6c6c6c6"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets).toHaveLength(1);
    expect(liveResult.assets[0]?.name).toBe(
      "weaviate-collection/CustomerDocument"
    );
    expect(liveResult.signals.map((signal) => signal.sourceType)).toEqual(
      expect.arrayContaining([
        "weaviate.schema.collection",
        "weaviate.schema.vectorizer"
      ])
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://weaviate.example.test/v1/schema",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer weaviate-secret-key"
        })
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://weaviate.example.test/v1/meta",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer weaviate-secret-key"
        })
      })
    );
    expect(JSON.stringify(liveResult)).not.toContain("weaviate-secret-key");
  });

  it("runs Azure AI Search sync with read-only index metadata signals", async () => {
    const connector = getConnectorByKey("azure-ai-search");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiKey"]));

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "azure-ai-search",
        mockMode: true
      },
      integrationId: "a6a6a6a6-a6a6-4a6a-8a6a-a6a6a6a6a6a6",
      mockMode: true,
      tenantId: "b6b6b6b6-b6b6-4b6b-8b6b-b6b6b6b6b6b6"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets).toHaveLength(2);
    expect(mockResult.assets[0]?.identifiers).toMatchObject({
      resourceKind: "AzureAISearchIndex"
    });
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "SearchIndexAvailable",
        "VectorSearchConfigured",
        "SemanticSearchConfigured",
        "SearchIndexCorsEnabled",
        "SearchServiceStatsAvailable"
      ])
    );

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);

      expect(url).toMatch(
        /^https:\/\/periscan-search\.search\.windows\.net\/(?:indexes|servicestats)\?api-version=2025-09-01$/u
      );
      expect(url).not.toMatch(
        /\/(?:docs|documents|search|suggest|autocomplete|indexers|skillsets|datasources|synonymmaps|analyze)(?:\b|\/|\?)/u
      );
      expect(url).not.toMatch(
        /(?:^|[?&])(?:search|searchMode|searchFields|select|filter|orderby)=/u
      );

      if (url.includes("/indexes?")) {
        return new Response(
          JSON.stringify({
            value: [
              {
                fields: [
                  {
                    key: true,
                    name: "id",
                    searchable: false,
                    type: "Edm.String"
                  },
                  {
                    name: "content",
                    searchable: true,
                    type: "Edm.String"
                  },
                  {
                    dimensions: 1536,
                    name: "contentVector",
                    searchable: true,
                    type: "Collection(Edm.Single)",
                    vectorSearchProfile: "rag-vector-profile"
                  }
                ],
                name: "customer-rag-index",
                scoringProfiles: [],
                semantic: {
                  configurations: [
                    {
                      name: "semantic-rag"
                    }
                  ]
                },
                suggesters: [],
                vectorSearch: {
                  profiles: [
                    {
                      name: "rag-vector-profile"
                    }
                  ]
                }
              }
            ]
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }

      return new Response(
        JSON.stringify({
          counters: {
            documentCounter: {
              usage: 900
            },
            indexCounter: {
              usage: 1
            }
          },
          storageSize: {
            usage: 67108864
          },
          vectorIndexSize: {
            usage: 33554432
          }
        }),
        {
          headers: {
            "content-type": "application/json"
          },
          status: 200
        }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "apiKey",
      config: {
        apiKey: "azure-search-secret-key",
        apiVersion: "2025-09-01",
        connectorKey: "azure-ai-search",
        endpoint: "https://periscan-search.search.windows.net"
      },
      integrationId: "c6c6c6c6-c6c6-4c6c-8c6c-c6c6c6c6c6c6",
      mockMode: false,
      tenantId: "d6d6d6d6-d6d6-4d6d-8d6d-d6d6d6d6d6d6"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets).toHaveLength(1);
    expect(liveResult.assets[0]?.name).toBe(
      "azure-ai-search-index/customer-rag-index"
    );
    expect(liveResult.signals.map((signal) => signal.sourceType)).toEqual(
      expect.arrayContaining([
        "azure_ai_search.indexes.index",
        "azure_ai_search.indexes.vector_search",
        "azure_ai_search.indexes.semantic_search",
        "azure_ai_search.service.stats"
      ])
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://periscan-search.search.windows.net/indexes?api-version=2025-09-01",
      expect.objectContaining({
        headers: expect.objectContaining({
          "api-key": "azure-search-secret-key"
        })
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://periscan-search.search.windows.net/servicestats?api-version=2025-09-01",
      expect.objectContaining({
        headers: expect.objectContaining({
          "api-key": "azure-search-secret-key"
        })
      })
    );
    expect(JSON.stringify(liveResult)).not.toContain("azure-search-secret-key");
  });

  it("runs Chroma sync with read-only collection metadata signals", async () => {
    const connector = getConnectorByKey("chroma");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiKey"]));

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "chroma",
        mockMode: true
      },
      integrationId: "a5a5a5a5-a5a5-4a5a-8a5a-a5a5a5a5a5a5",
      mockMode: true,
      tenantId: "b5b5b5b5-b5b5-4b5b-8b5b-b5b5b5b5b5b5"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets).toHaveLength(2);
    expect(mockResult.assets[0]?.identifiers).toMatchObject({
      resourceKind: "ChromaCollection"
    });
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "VectorCollectionAvailable",
        "VectorIndexConfigured",
        "SparseVectorIndexConfigured",
        "FullTextIndexConfigured",
        "CollectionCountAvailable"
      ])
    );

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);

        expect(url).toMatch(
          /^https:\/\/api\.trychroma\.test\/api\/v2\/tenants\/tenant-123\/databases\/prod-db\/(?:collections\?limit=100&offset=0|collections_count)$/u
        );
        expect(url).not.toMatch(
          /\/(?:get|query|search|add|update|upsert|delete|fork|reset|records|embeddings)(?:\b|\/|\?)/u
        );
        expect(init?.method ?? "GET").toBe("GET");
        expect(init?.body).toBeUndefined();

        if (url.endsWith("/collections_count")) {
          return new Response(JSON.stringify(1), {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          });
        }

        return new Response(
          JSON.stringify([
            {
              configuration_json: {
                embedding_function: {
                  type: "openai"
                },
                hnsw: {
                  space: "cosine"
                }
              },
              database: "prod-db",
              dimension: 1536,
              id: "33333333-3333-4333-8333-333333333333",
              metadata: {
                environment: "production",
                owner: "ai-platform"
              },
              name: "customer-documents",
              schema: {
                defaults: {
                  float_list: {
                    vector_index: {
                      enabled: true
                    }
                  },
                  sparse_vector: {
                    sparse_vector_index: {
                      enabled: true
                    }
                  },
                  string: {
                    fts_index: {
                      enabled: true
                    }
                  }
                }
              },
              tenant: "tenant-123",
              version: 4
            }
          ]),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "apiKey",
      config: {
        apiKey: "chroma-secret-key",
        baseUrl: "https://api.trychroma.test",
        connectorKey: "chroma",
        database: "prod-db",
        limit: 100,
        tenant: "tenant-123"
      },
      integrationId: "c5c5c5c5-c5c5-4c5c-8c5c-c5c5c5c5c5c5",
      mockMode: false,
      tenantId: "d5d5d5d5-d5d5-4d5d-8d5d-d5d5d5d5d5d5"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets).toHaveLength(1);
    expect(liveResult.assets[0]?.name).toBe(
      "chroma-collection/customer-documents"
    );
    expect(liveResult.signals.map((signal) => signal.sourceType)).toEqual(
      expect.arrayContaining([
        "chroma.collections.collection",
        "chroma.collections.vector_index",
        "chroma.collections.sparse_vector_index",
        "chroma.collections.full_text_index",
        "chroma.collections.count"
      ])
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.trychroma.test/api/v2/tenants/tenant-123/databases/prod-db/collections?limit=100&offset=0",
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-chroma-token": "chroma-secret-key"
        })
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.trychroma.test/api/v2/tenants/tenant-123/databases/prod-db/collections_count",
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-chroma-token": "chroma-secret-key"
        })
      })
    );
    expect(JSON.stringify(liveResult)).not.toContain("chroma-secret-key");
  });

  it("runs LangChain sync from imported metadata without executing app runtime behavior", async () => {
    const connector = getConnectorByKey("langchain");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "configImport"]));

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "langchain",
        mockMode: true
      },
      integrationId: "e7e7e7e7-e7e7-4e7e-8e7e-e7e7e7e7e7e7",
      mockMode: true,
      tenantId: "f7f7f7f7-f7f7-4f7f-8f7f-f7f7f7f7f7f7"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets).toHaveLength(2);
    expect(mockResult.assets[0]?.identifiers).toMatchObject({
      resourceKind: "LangChainApplication",
      tools: 1,
      vectorStores: 1
    });
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "LangChainApplicationDeclared",
        "LangChainChainDeclared",
        "LangChainAgentDeclared",
        "LangChainToolDeclared",
        "LangChainRetrieverDeclared",
        "LangChainVectorStoreDeclared",
        "LangChainCallbackDeclared",
        "LangChainRunnableDeclared",
        "LangChainToolApprovalRequired",
        "LangChainSensitiveToolDeclared"
      ])
    );

    const fetchMock = vi.fn(async () => {
      throw new Error("LangChain config import must not call network APIs.");
    });
    vi.stubGlobal("fetch", fetchMock);

    const importedResult = await connector!.sync({
      authType: "configImport",
      config: {
        agents: [
          {
            componentType: "tool-calling-agent",
            metadata: {
              owner: "ai-platform"
            },
            name: "incident-response-agent",
            provider: "openai"
          }
        ],
        applicationName: "incident-response-assistant",
        chains: [
          {
            componentType: "retrieval-chain",
            metadata: {
              environment: "production"
            },
            name: "incident-rag-chain"
          }
        ],
        environment: "production",
        retrievers: [
          {
            componentType: "vectorstore-retriever",
            name: "incident-doc-retriever",
            provider: "Chroma"
          }
        ],
        tools: [
          {
            inputSchemaKnown: true,
            metadata: {
              apiKey: "lc-secret-from-import",
              approvalTier: "human"
            },
            name: "disable-user",
            provider: "Okta",
            requiresHumanApproval: true,
            sensitive: true
          }
        ],
        vectorStores: [
          {
            componentType: "Chroma",
            metadata: {
              collectionName: "incident-docs"
            },
            name: "incident-doc-vector-store"
          }
        ]
      },
      integrationId: "a8a8a8a8-a8a8-4a8a-8a8a-a8a8a8a8a8a8",
      mockMode: false,
      tenantId: "b8b8b8b8-b8b8-4b8b-8b8b-b8b8b8b8b8b8"
    });

    expect(importedResult.health).toMatchObject({
      authorizationVerified: true,
      status: "Healthy"
    });
    expect(importedResult.assets[0]?.name).toBe(
      "langchain-app/incident-response-assistant"
    );
    expect(importedResult.signals.map((signal) => signal.sourceType)).toEqual(
      expect.arrayContaining([
        "langchain.metadata.application",
        "langchain.metadata.agent",
        "langchain.metadata.chain",
        "langchain.metadata.tool",
        "langchain.metadata.retriever",
        "langchain.metadata.vector_store",
        "langchain.metadata.tool_approval",
        "langchain.metadata.sensitive_tool"
      ])
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.stringify(importedResult)).not.toContain(
      "lc-secret-from-import"
    );
  });

  it("runs LlamaIndex sync from imported metadata without executing query or agent runtime behavior", async () => {
    const connector = getConnectorByKey("llamaindex");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "configImport"]));

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "llamaindex",
        mockMode: true
      },
      integrationId: "c8c8c8c8-c8c8-4c8c-8c8c-c8c8c8c8c8c8",
      mockMode: true,
      tenantId: "d8d8d8d8-d8d8-4d8d-8d8d-d8d8d8d8d8d8"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets).toHaveLength(2);
    expect(mockResult.assets[0]?.identifiers).toMatchObject({
      queryEngines: 1,
      resourceKind: "LlamaIndexApplication",
      vectorStores: 1
    });
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "LlamaIndexApplicationDeclared",
        "LlamaIndexIndexDeclared",
        "LlamaIndexQueryEngineDeclared",
        "LlamaIndexRetrieverDeclared",
        "LlamaIndexAgentDeclared",
        "LlamaIndexToolDeclared",
        "LlamaIndexDataSourceDeclared",
        "LlamaIndexVectorStoreDeclared",
        "LlamaIndexWorkflowDeclared"
      ])
    );

    const fetchMock = vi.fn(async () => {
      throw new Error("LlamaIndex config import must not call network APIs.");
    });
    vi.stubGlobal("fetch", fetchMock);

    const importedResult = await connector!.sync({
      authType: "configImport",
      config: {
        agents: [
          {
            componentType: "OpenAIAgent",
            metadata: {
              owner: "ai-platform"
            },
            name: "incident-agent",
            provider: "openai"
          }
        ],
        applicationName: "incident-rag",
        dataSources: [
          {
            componentType: "S3Reader",
            metadata: {
              bucket: "redacted-in-real-evidence"
            },
            name: "incident-runbooks"
          }
        ],
        environment: "production",
        indexes: [
          {
            componentType: "VectorStoreIndex",
            metadata: {
              persistDir: "/not/stored/as/value"
            },
            name: "incident-index"
          }
        ],
        queryEngines: [
          {
            componentType: "RetrieverQueryEngine",
            name: "incident-query-engine"
          }
        ],
        retrievers: [
          {
            componentType: "VectorIndexRetriever",
            name: "incident-retriever",
            provider: "Pinecone"
          }
        ],
        tools: [
          {
            inputSchemaKnown: true,
            metadata: {
              apiKey: "llamaindex-imported-secret",
              approvalTier: "human"
            },
            name: "query-runbooks",
            provider: "LlamaIndex",
            requiresHumanApproval: true,
            sensitive: true
          }
        ],
        vectorStores: [
          {
            componentType: "PineconeVectorStore",
            metadata: {
              indexName: "incident-docs"
            },
            name: "incident-vector-store"
          }
        ],
        workflows: [
          {
            componentType: "Workflow",
            name: "incident-response-workflow"
          }
        ]
      },
      integrationId: "e8e8e8e8-e8e8-4e8e-8e8e-e8e8e8e8e8e8",
      mockMode: false,
      tenantId: "f8f8f8f8-f8f8-4f8f-8f8f-f8f8f8f8f8f8"
    });

    expect(importedResult.health).toMatchObject({
      authorizationVerified: true,
      status: "Healthy"
    });
    expect(importedResult.assets[0]?.name).toBe("llamaindex-app/incident-rag");
    expect(importedResult.signals.map((signal) => signal.sourceType)).toEqual(
      expect.arrayContaining([
        "llamaindex.metadata.application",
        "llamaindex.metadata.agent",
        "llamaindex.metadata.data_source",
        "llamaindex.metadata.index",
        "llamaindex.metadata.query_engine",
        "llamaindex.metadata.retriever",
        "llamaindex.metadata.tool",
        "llamaindex.metadata.vector_store",
        "llamaindex.metadata.workflow",
        "llamaindex.metadata.tool_approval",
        "llamaindex.metadata.sensitive_tool"
      ])
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.stringify(importedResult)).not.toContain(
      "llamaindex-imported-secret"
    );
    expect(JSON.stringify(importedResult)).not.toContain(
      "/not/stored/as/value"
    );
  });

  it("runs Guardrails AI sync from imported metadata without executing guards or validators", async () => {
    const connector = getConnectorByKey("guardrails-ai");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "configImport"]));

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "guardrails-ai",
        mockMode: true
      },
      integrationId: "a9a9a9a9-a9a9-4a9a-8a9a-a9a9a9a9a9a9",
      mockMode: true,
      tenantId: "b9b9b9b9-b9b9-4b9b-8b9b-b9b9b9b9b9b9"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets).toHaveLength(3);
    expect(mockResult.assets[0]?.identifiers).toMatchObject({
      guards: 2,
      resourceKind: "GuardrailsAIApplication",
      validators: 2
    });
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "GuardrailsAIApplicationDeclared",
        "GuardrailsAIGuardDeclared",
        "GuardrailsAIValidatorDeclared",
        "GuardrailsAIRailSpecDeclared",
        "GuardrailsAIPolicyDeclared",
        "GuardrailsAIServerEndpointDeclared",
        "GuardrailsAITelemetrySinkDeclared",
        "GuardrailsAIInputGuardConfigured",
        "GuardrailsAIOutputGuardConfigured",
        "GuardrailsAIOnFailPolicyConfigured",
        "GuardrailsAIRuntimeMetadataRequired",
        "GuardrailsAISensitiveValidatorDeclared"
      ])
    );

    const fetchMock = vi.fn(async () => {
      throw new Error(
        "Guardrails AI config import must not call network APIs."
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const importedResult = await connector!.sync({
      authType: "configImport",
      config: {
        applicationName: "incident-guardrails",
        environment: "production",
        guards: [
          {
            appliesTo: "messages",
            componentType: "InputGuard",
            metadata: {
              owner: "ai-platform"
            },
            name: "incident-input-guard"
          },
          {
            appliesTo: "output",
            componentType: "OutputGuard",
            name: "incident-output-guard"
          }
        ],
        policies: [
          {
            appliesTo: "output",
            componentType: "OnFailPolicy",
            name: "block-sensitive-output"
          }
        ],
        railSpecs: [
          {
            componentType: "RAIL",
            metadata: {
              railBody: "must-not-leak"
            },
            name: "incident-output-rail"
          }
        ],
        serverEndpoints: [
          {
            componentType: "GuardrailsServer",
            metadata: {
              apiKey: "guardrails-imported-secret",
              baseUrl: "https://guardrails.example.test"
            },
            name: "guardrails-server"
          }
        ],
        validators: [
          {
            appliesTo: "messages",
            componentType: "DetectPII",
            metadata: {
              piiEntities: ["EMAIL_ADDRESS"]
            },
            name: "detect-pii",
            onFailPolicy: "exception",
            provider: "hub://guardrails/detect_pii",
            requiresRuntimeMetadata: true,
            sensitive: true,
            validationMethod: "sentence"
          }
        ]
      },
      integrationId: "c9c9c9c9-c9c9-4c9c-8c9c-c9c9c9c9c9c9",
      mockMode: false,
      tenantId: "d9d9d9d9-d9d9-4d9d-8d9d-d9d9d9d9d9d9"
    });

    expect(importedResult.health).toMatchObject({
      authorizationVerified: true,
      status: "Healthy"
    });
    expect(importedResult.assets[0]?.name).toBe(
      "guardrails-ai-app/incident-guardrails"
    );
    expect(importedResult.signals.map((signal) => signal.sourceType)).toEqual(
      expect.arrayContaining([
        "guardrails_ai.metadata.application",
        "guardrails_ai.metadata.guard",
        "guardrails_ai.metadata.validator",
        "guardrails_ai.metadata.rail_spec",
        "guardrails_ai.metadata.policy",
        "guardrails_ai.metadata.server_endpoint",
        "guardrails_ai.metadata.guard_scope",
        "guardrails_ai.metadata.on_fail_policy",
        "guardrails_ai.metadata.runtime_metadata",
        "guardrails_ai.metadata.sensitive_validator"
      ])
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.stringify(importedResult)).not.toContain(
      "guardrails-imported-secret"
    );
    expect(JSON.stringify(importedResult)).not.toContain("must-not-leak");
  });

  it("runs Lakera Guard sync with read-only project and policy metadata without screening prompts", async () => {
    const connector = getConnectorByKey("lakera");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiKey"]));
    expect(connector!.manifest).toMatchObject({
      availability: "Beta",
      connectable: true,
      marketplaceCategory: "AI Stack",
      product: "Lakera Guard"
    });

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "lakera",
        mockMode: true
      },
      integrationId: "aa0a0a0a-aa0a-4a0a-8a0a-aa0a0a0a0a0a",
      mockMode: true,
      tenantId: "bb0b0b0b-bb0b-4b0b-8b0b-bb0b0b0b0b0b"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets.map((asset) => asset.name)).toEqual(
      expect.arrayContaining([
        "lakera-project/customer-support-ai",
        "lakera-policy/customer-support-policy"
      ])
    );
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "LakeraProjectDeclared",
        "LakeraPolicyDeclared",
        "LakeraProjectPolicyMapped",
        "LakeraInputDetectorConfigured",
        "LakeraOutputDetectorConfigured",
        "LakeraPromptDefenseConfigured",
        "LakeraDataLeakageDefenseConfigured",
        "LakeraMaliciousLinkDefenseConfigured",
        "LakeraBlockingPolicyConfigured"
      ])
    );

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const parsedUrl = new URL(url);

      expect(init?.method).toBe("GET");
      expect(init).not.toHaveProperty("body");
      expect(parsedUrl.origin).toBe("https://platform.lakera.test");
      expect(parsedUrl.pathname).not.toMatch(
        /\/v2\/guard|\/guard\/results|\/guard$/u
      );
      expect(init?.headers).toMatchObject({
        authorization: "Bearer lakera-secret-key"
      });

      if (parsedUrl.pathname.endsWith("/projects/project-1")) {
        return new Response(
          JSON.stringify({
            id: "project-1",
            metadata: {
              environment: "production",
              owner: "ai-platform"
            },
            name: "support-agent",
            policy_id: "policy-1"
          }),
          {
            status: 200
          }
        );
      }

      if (parsedUrl.pathname.endsWith("/policies/policy-1")) {
        return new Response(
          JSON.stringify({
            id: "policy-1",
            input_detectors: [
              {
                threshold: "strict",
                type: "prompt_injection"
              }
            ],
            mode: "blocking",
            name: "support-agent-policy",
            output_detectors: [
              {
                allowed_domains: ["internal.example.com"],
                threshold: "balanced",
                type: "malicious_links"
              },
              {
                threshold: "strict",
                type: "data_loss"
              }
            ]
          }),
          {
            status: 200
          }
        );
      }

      return new Response(JSON.stringify({}), {
        status: 404
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.sync({
      authType: "apiKey",
      config: {
        apiKey: "lakera-secret-key",
        platformBaseUrl: "https://platform.lakera.test/api/v1-beta",
        policyIds: [],
        projectIds: ["project-1"]
      },
      integrationId: "cc0c0c0c-cc0c-4c0c-8c0c-cc0c0c0c0c0c",
      mockMode: false,
      tenantId: "dd0d0d0d-dd0d-4d0d-8d0d-dd0d0d0d0d0d"
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(liveResult.health).toMatchObject({
      authorizationVerified: true,
      status: "Healthy"
    });
    expect(liveResult.assets[0]?.identifiers).toMatchObject({
      metadataKeys: ["environment", "owner"],
      policyId: "policy-1",
      resourceKind: "LakeraGuardProject"
    });
    expect(liveResult.signals.map((signal) => signal.sourceType)).toEqual(
      expect.arrayContaining([
        "lakera.platform.project",
        "lakera.platform.policy",
        "lakera.platform.project_policy",
        "lakera.platform.input_detector",
        "lakera.platform.output_detector",
        "lakera.platform.detector_coverage",
        "lakera.platform.policy_mode"
      ])
    );
    expect(JSON.stringify(liveResult)).not.toContain("lakera-secret-key");
    expect(JSON.stringify(liveResult)).not.toContain("internal.example.com");
  });

  it("runs AWS Bedrock sync with read-only foundation model inventory signals", async () => {
    const connector = getConnectorByKey("aws-bedrock");

    expect(connector).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(
      expect.arrayContaining(["mock", "staticCredentials", "assumeRole"])
    );

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "aws-bedrock",
        mockMode: true
      },
      integrationId: "b9b9b9b9-b9b9-4b9b-8b9b-b9b9b9b9b9b9",
      mockMode: true,
      tenantId: "c9c9c9c9-c9c9-4c9c-8c9c-c9c9c9c9c9c9"
    });

    expect(mockResult.health.status).toBe("Healthy");
    expect(mockResult.assets).toHaveLength(1);
    expect(mockResult.assets[0]?.identifiers).toMatchObject({
      providerName: "Anthropic",
      resourceKind: "AWSBedrockFoundationModel"
    });
    expect(
      mockResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(expect.arrayContaining(["AIFoundationModelAvailable"]));

    const sendSpy = vi
      .spyOn(BedrockClient.prototype, "send")
      .mockResolvedValue({
        modelSummaries: [
          {
            inputModalities: ["TEXT"],
            modelArn:
              "arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-text-lite-v1",
            modelId: "amazon.titan-text-lite-v1",
            modelName: "Titan Text Lite",
            outputModalities: ["TEXT"],
            providerName: "Amazon",
            responseStreamingSupported: true
          }
        ]
      } as never);

    const liveResult = await connector!.sync({
      authType: "staticCredentials",
      config: {
        accessKeyId: "AKIA1234567890BEDROCK",
        connectorKey: "aws-bedrock",
        region: "us-east-1",
        secretAccessKey: "bedrock-secret-key"
      },
      integrationId: "d9d9d9d9-d9d9-4d9d-8d9d-d9d9d9d9d9d9",
      mockMode: false,
      tenantId: "e9e9e9e9-e9e9-4e9e-8e9e-e9e9e9e9e9e9"
    });

    expect(liveResult.health.status).toBe("Healthy");
    expect(liveResult.assets[0]?.name).toBe(
      "aws-bedrock-model/amazon.titan-text-lite-v1"
    );
    expect(liveResult.signals[0]?.sourceType).toBe(
      "aws_bedrock.foundation_models.model"
    );
    expect(sendSpy).toHaveBeenCalledWith(
      expect.any(ListFoundationModelsCommand)
    );
    expect(JSON.stringify(liveResult)).not.toContain("bedrock-secret-key");

    sendSpy.mockRestore();
  });

  it("exposes mock Splunk control observation verdicts", async () => {
    const connector = getConnectorByKey("splunk");

    expect(connector?.observeControl).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiToken"]));

    const result = await connector!.observeControl!({
      authType: "mock",
      config: {
        connectorKey: "splunk",
        fixtureOutcome: "Missed",
        mockMode: true
      },
      integrationId: "77777777-7777-4777-8777-777777777777",
      mockMode: true,
      tenantId: "88888888-8888-4888-8888-888888888888"
    });

    expect(result).toMatchObject({
      outcome: "NoEvidence",
      sourceType: "splunk.search.observer"
    });

    const fetchMock = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) => {
        void _input;
        void _init;

        return new Response(
          JSON.stringify({
            result: {
              _raw: "Periscan validation event technique=T1059 logged by SIEM"
            }
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.observeControl!({
      authType: "apiToken",
      config: {
        baseUrl: "https://splunk.example.com:8089",
        connectorKey: "splunk",
        index: "security",
        techniqueId: "T1059",
        token: "splunk-secret-token"
      },
      integrationId: "79797979-7979-4797-8797-797979797979",
      mockMode: false,
      tenantId: "80808080-8080-4808-8808-808080808080"
    });

    expect(liveResult).toMatchObject({
      outcome: "Logged",
      sourceType: "splunk.search.observer"
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://splunk.example.com:8089/services/search/jobs/export",
      expect.objectContaining({
        method: "POST"
      })
    );

    const requestInit = fetchMock.mock.calls[0]?.[1];

    expect(requestInit).toBeDefined();
    expect((requestInit!.headers as Record<string, string>).authorization).toBe(
      "Bearer splunk-secret-token"
    );
    expect(String(requestInit!.body)).toContain("T1059");
    expect(JSON.stringify(liveResult)).not.toContain("splunk-secret-token");

    const failedFetchMock = vi.fn(async () => {
      throw new Error("network unavailable");
    });
    vi.stubGlobal("fetch", failedFetchMock);

    const failedResult = await connector!.observeControl!({
      authType: "apiToken",
      config: {
        baseUrl: "https://splunk.example.com:8089",
        connectorKey: "splunk",
        token: "splunk-secret-token"
      },
      integrationId: "79797979-7979-4797-8797-797979797979",
      mockMode: false,
      tenantId: "80808080-8080-4808-8808-808080808080"
    });

    expect(failedResult).toMatchObject({
      outcome: "NoEvidence",
      sourceType: "splunk.search.observer"
    });
    expect(failedResult.detail).toContain("network unavailable");
    expect(JSON.stringify(failedResult)).not.toContain("splunk-secret-token");
  });

  it("exposes Elastic Security read-only control observation verdicts", async () => {
    const connector = getConnectorByKey("elastic-security");

    expect(connector?.observeControl).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiToken"]));

    const result = await connector!.observeControl!({
      authType: "mock",
      config: {
        connectorKey: "elastic-security",
        fixtureOutcome: "Logged",
        mockMode: true
      },
      integrationId: "8e8e8e8e-8e8e-48e8-88e8-8e8e8e8e8e8e",
      mockMode: true,
      tenantId: "8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f8f"
    });

    expect(result).toMatchObject({
      outcome: "Logged",
      sourceType: "elastic_security.alerts.observer"
    });

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);

        expect(url).toBe(
          "https://elastic.example.com/.alerts-security.alerts-default/_search"
        );
        expect(init?.method).toBe("POST");
        expect(
          (init?.headers as Record<string, string> | undefined)?.authorization
        ).toBe("ApiKey elastic-secret-key");
        expect(String(init?.body)).toContain("T1059");

        return new Response(
          JSON.stringify({
            hits: {
              hits: [
                {
                  _id: "alert-1",
                  _source: {
                    "kibana.alert.rule.name": "Periscan validation observed"
                  }
                }
              ],
              total: {
                relation: "eq",
                value: 1
              }
            }
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.observeControl!({
      authType: "apiToken",
      config: {
        apiKey: "elastic-secret-key",
        baseUrl: "https://elastic.example.com",
        connectorKey: "elastic-security",
        techniqueId: "T1059"
      },
      integrationId: "90909090-9090-4909-8909-909090909090",
      mockMode: false,
      tenantId: "91919191-9191-4919-8919-919191919191"
    });

    expect(liveResult).toMatchObject({
      outcome: "Alerted",
      sourceType: "elastic_security.alerts.observer"
    });
    expect(
      fetchMock.mock.calls
        .map((call) => String(call[0]))
        .some((url) =>
          /\/(?:_bulk|_delete_by_query|_update|_doc|api\/detection_engine|api\/cases|api\/actions|api\/console|credentials)(?:\b|\/|\?)/u.test(
            url
          )
        )
    ).toBe(false);
    expect(JSON.stringify(liveResult)).not.toContain("elastic-secret-key");

    const failedFetchMock = vi.fn(async () => {
      throw new Error("elastic unavailable");
    });
    vi.stubGlobal("fetch", failedFetchMock);

    const failedResult = await connector!.observeControl!({
      authType: "apiToken",
      config: {
        apiKey: "elastic-secret-key",
        baseUrl: "https://elastic.example.com",
        connectorKey: "elastic-security"
      },
      integrationId: "90909090-9090-4909-8909-909090909090",
      mockMode: false,
      tenantId: "91919191-9191-4919-8919-919191919191"
    });

    expect(failedResult).toMatchObject({
      outcome: "NoEvidence",
      sourceType: "elastic_security.alerts.observer"
    });
    expect(failedResult.detail).toContain("elastic unavailable");
    expect(JSON.stringify(failedResult)).not.toContain("elastic-secret-key");
  });

  it("exposes Datadog Cloud SIEM read-only control observation verdicts", async () => {
    const connector = getConnectorByKey("datadog-siem");

    expect(connector?.observeControl).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiToken"]));

    const result = await connector!.observeControl!({
      authType: "mock",
      config: {
        connectorKey: "datadog-siem",
        fixtureOutcome: "Logged",
        mockMode: true
      },
      integrationId: "9a9a9a9a-9a9a-49a9-89a9-9a9a9a9a9a9a",
      mockMode: true,
      tenantId: "9b9b9b9b-9b9b-49b9-89b9-9b9b9b9b9b9b"
    });

    expect(result).toMatchObject({
      outcome: "Logged",
      sourceType: "datadog_siem.security_signals.observer"
    });

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);

        expect(url).toBe(
          "https://api.datadoghq.com/api/v2/security_monitoring/signals/search"
        );
        expect(init?.method).toBe("POST");
        expect(
          (init?.headers as Record<string, string> | undefined)?.["DD-API-KEY"]
        ).toBe("datadog-secret-api-key");
        expect(
          (init?.headers as Record<string, string> | undefined)?.[
            "DD-APPLICATION-KEY"
          ]
        ).toBe("datadog-secret-application-key");
        expect(String(init?.body)).toContain("T1059");

        return new Response(
          JSON.stringify({
            data: [
              {
                attributes: {
                  title: "Periscan validation observed"
                },
                id: "signal-1",
                type: "security_signal"
              }
            ],
            meta: {
              page: {
                total_count: 1
              }
            }
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.observeControl!({
      authType: "apiToken",
      config: {
        apiBaseUrl: "https://api.datadoghq.com",
        apiKey: "datadog-secret-api-key",
        applicationKey: "datadog-secret-application-key",
        connectorKey: "datadog-siem",
        techniqueId: "T1059"
      },
      integrationId: "9c9c9c9c-9c9c-49c9-89c9-9c9c9c9c9c9c",
      mockMode: false,
      tenantId: "9d9d9d9d-9d9d-49d9-89d9-9d9d9d9d9d9d"
    });

    expect(liveResult).toMatchObject({
      outcome: "Alerted",
      sourceType: "datadog_siem.security_signals.observer"
    });
    expect(
      fetchMock.mock.calls
        .map((call) => String(call[0]))
        .some((url) =>
          /(?:\/api\/v1\/monitor|\/api\/v2\/security_monitoring\/rules|\/api\/v2\/incidents|\/api\/v1\/events|\/api\/v1\/logs|\/api\/v2\/logs\/events)/u.test(
            url
          )
        )
    ).toBe(false);
    expect(JSON.stringify(liveResult)).not.toContain("datadog-secret-api-key");
    expect(JSON.stringify(liveResult)).not.toContain(
      "datadog-secret-application-key"
    );

    const failedFetchMock = vi.fn(async () => {
      throw new Error("datadog unavailable");
    });
    vi.stubGlobal("fetch", failedFetchMock);

    const failedResult = await connector!.observeControl!({
      authType: "apiToken",
      config: {
        apiBaseUrl: "https://api.datadoghq.com",
        apiKey: "datadog-secret-api-key",
        applicationKey: "datadog-secret-application-key",
        connectorKey: "datadog-siem"
      },
      integrationId: "9c9c9c9c-9c9c-49c9-89c9-9c9c9c9c9c9c",
      mockMode: false,
      tenantId: "9d9d9d9d-9d9d-49d9-89d9-9d9d9d9d9d9d"
    });

    expect(failedResult).toMatchObject({
      outcome: "NoEvidence",
      sourceType: "datadog_siem.security_signals.observer"
    });
    expect(failedResult.detail).toContain("datadog unavailable");
    expect(JSON.stringify(failedResult)).not.toContain(
      "datadog-secret-api-key"
    );
    expect(JSON.stringify(failedResult)).not.toContain(
      "datadog-secret-application-key"
    );
  });

  it("exposes Google SecOps read-only UDM search observation verdicts", async () => {
    const connector = getConnectorByKey("google-chronicle");

    expect(connector?.observeControl).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "accessToken"]));

    const result = await connector!.observeControl!({
      authType: "mock",
      config: {
        connectorKey: "google-chronicle",
        fixtureOutcome: "Alerted",
        mockMode: true
      },
      integrationId: "9e9e9e9e-9e9e-49e9-89e9-9e9e9e9e9e9e",
      mockMode: true,
      tenantId: "9f9f9f9f-9f9f-49f9-89f9-9f9f9f9f9f9f"
    });

    expect(result).toMatchObject({
      outcome: "Alerted",
      sourceType: "google_secops.udm_search.observer"
    });

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input));

        expect(`${url.origin}${url.pathname}`).toBe(
          "https://chronicle.googleapis.com/v1alpha/projects/secops-project/locations/us/instances/customer-instance:udmSearch"
        );
        expect(url.searchParams.get("query")).toContain("T1059");
        expect(url.searchParams.get("timeRange.startTime")).toBe(
          "2026-06-03T00:00:00.000Z"
        );
        expect(url.searchParams.get("timeRange.endTime")).toBe(
          "2026-06-04T00:00:00.000Z"
        );
        expect(url.searchParams.get("limit")).toBe("5");
        expect(url.searchParams.get("queryDialect")).toBe("YL2");
        expect(init?.method).toBe("GET");
        expect(init?.body).toBeUndefined();
        expect(
          (init?.headers as Record<string, string> | undefined)?.authorization
        ).toBe("Bearer google-secops-access-token");

        return new Response(
          JSON.stringify({
            events: [
              {
                metadata: {
                  eventType: "USER_LOGIN",
                  id: "event-1"
                },
                securityResult: [
                  {
                    ruleName: "Periscan validation observed"
                  }
                ]
              }
            ],
            moreDataAvailable: false
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.observeControl!({
      authType: "accessToken",
      config: {
        accessToken: "google-secops-access-token",
        apiBaseUrl: "https://chronicle.googleapis.com",
        connectorKey: "google-chronicle",
        from: "2026-06-03T00:00:00.000Z",
        instance:
          "projects/secops-project/locations/us/instances/customer-instance",
        limit: 5,
        techniqueId: "T1059",
        to: "2026-06-04T00:00:00.000Z"
      },
      integrationId: "a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0",
      mockMode: false,
      tenantId: "a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1"
    });

    expect(liveResult).toMatchObject({
      outcome: "Logged",
      sourceType: "google_secops.udm_search.observer"
    });
    expect(
      fetchMock.mock.calls
        .map((call) => String(call[0]))
        .some((url) =>
          /(?:\/events:import|\/rules|\/cases|\/feeds|\/forwarders|\/playbooks|\/dashboards|\/dataExports|\/ingestion|\/webhooks)/u.test(
            url
          )
        )
    ).toBe(false);
    expect(JSON.stringify(liveResult)).not.toContain(
      "google-secops-access-token"
    );

    const failedFetchMock = vi.fn(async () => {
      throw new Error("google secops unavailable");
    });
    vi.stubGlobal("fetch", failedFetchMock);

    const failedResult = await connector!.observeControl!({
      authType: "accessToken",
      config: {
        accessToken: "google-secops-access-token",
        connectorKey: "google-chronicle",
        instance:
          "projects/secops-project/locations/us/instances/customer-instance"
      },
      integrationId: "a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0",
      mockMode: false,
      tenantId: "a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1"
    });

    expect(failedResult).toMatchObject({
      outcome: "NoEvidence",
      sourceType: "google_secops.udm_search.observer"
    });
    expect(failedResult.detail).toContain("google secops unavailable");
    expect(JSON.stringify(failedResult)).not.toContain(
      "google-secops-access-token"
    );
  });

  it("exposes Sumo Logic read-only search job observation verdicts", async () => {
    const connector = getConnectorByKey("sumo-logic");

    expect(connector?.observeControl).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "basicAuth"]));

    const result = await connector!.observeControl!({
      authType: "mock",
      config: {
        connectorKey: "sumo-logic",
        fixtureOutcome: "Alerted",
        mockMode: true
      },
      integrationId: "a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2",
      mockMode: true,
      tenantId: "a3a3a3a3-a3a3-4a3a-8a3a-a3a3a3a3a3a3"
    });

    expect(result).toMatchObject({
      outcome: "Alerted",
      sourceType: "sumo_logic.search_job.observer"
    });

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        const headers = init?.headers as Record<string, string> | undefined;

        expect(headers?.authorization).toBe(
          `Basic ${Buffer.from("sumo-access-id:sumo-access-key").toString(
            "base64"
          )}`
        );

        if (url === "https://api.sumologic.com/api/v1/search/jobs") {
          expect(init?.method).toBe("POST");
          expect(String(init?.body)).toContain("T1059");
          expect(String(init?.body)).toContain("UTC");

          return new Response(
            JSON.stringify({
              id: "sumo-search-job-1"
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (
          url ===
          "https://api.sumologic.com/api/v1/search/jobs/sumo-search-job-1"
        ) {
          expect(init?.method).toBe("GET");

          return new Response(
            JSON.stringify({
              messageCount: 1,
              state: "DONE GATHERING RESULTS"
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        expect(url).toBe(
          "https://api.sumologic.com/api/v1/search/jobs/sumo-search-job-1/messages?offset=0&limit=5"
        );
        expect(init?.method).toBe("GET");

        return new Response(
          JSON.stringify({
            messages: [
              {
                map: {
                  _raw: "Periscan validation event technique=T1059 logged"
                }
              }
            ]
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.observeControl!({
      authType: "basicAuth",
      config: {
        accessId: "sumo-access-id",
        accessKey: "sumo-access-key",
        apiBaseUrl: "https://api.sumologic.com",
        connectorKey: "sumo-logic",
        from: "2026-06-03T00:00:00.000Z",
        limit: 5,
        maxStatusPolls: 1,
        statusPollMs: 0,
        techniqueId: "T1059",
        to: "2026-06-04T00:00:00.000Z"
      },
      integrationId: "a4a4a4a4-a4a4-4a4a-8a4a-a4a4a4a4a4a4",
      mockMode: false,
      tenantId: "a5a5a5a5-a5a5-4a5a-8a5a-a5a5a5a5a5a5"
    });

    expect(liveResult).toMatchObject({
      outcome: "Logged",
      sourceType: "sumo_logic.search_job.observer"
    });
    expect(
      fetchMock.mock.calls
        .map((call) => String(call[0]))
        .some((url) =>
          /(?:\/collectors|\/monitors|\/content|\/users|\/roles|\/connections|\/dashboards|\/ingest|\/receivers|\/rules|\/cases)/u.test(
            url
          )
        )
    ).toBe(false);
    expect(JSON.stringify(liveResult)).not.toContain("sumo-access-id");
    expect(JSON.stringify(liveResult)).not.toContain("sumo-access-key");

    const failedFetchMock = vi.fn(async () => {
      throw new Error("sumo unavailable");
    });
    vi.stubGlobal("fetch", failedFetchMock);

    const failedResult = await connector!.observeControl!({
      authType: "basicAuth",
      config: {
        accessId: "sumo-access-id",
        accessKey: "sumo-access-key",
        connectorKey: "sumo-logic"
      },
      integrationId: "a4a4a4a4-a4a4-4a4a-8a4a-a4a4a4a4a4a4",
      mockMode: false,
      tenantId: "a5a5a5a5-a5a5-4a5a-8a5a-a5a5a5a5a5a5"
    });

    expect(failedResult).toMatchObject({
      outcome: "NoEvidence",
      sourceType: "sumo_logic.search_job.observer"
    });
    expect(failedResult.detail).toContain("sumo unavailable");
    expect(JSON.stringify(failedResult)).not.toContain("sumo-access-id");
    expect(JSON.stringify(failedResult)).not.toContain("sumo-access-key");
  });

  it("exposes Rapid7 InsightIDR read-only log search observation verdicts", async () => {
    const connector = getConnectorByKey("rapid7-insightidr");

    expect(connector?.observeControl).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiKey"]));

    const result = await connector!.observeControl!({
      authType: "mock",
      config: {
        connectorKey: "rapid7-insightidr",
        fixtureOutcome: "Alerted",
        mockMode: true
      },
      integrationId: "b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1",
      mockMode: true,
      tenantId: "b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2"
    });

    expect(result).toMatchObject({
      outcome: "Alerted",
      sourceType: "rapid7_insightidr.log_search.observer"
    });

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input));
        const headers = init?.headers as Record<string, string> | undefined;

        expect(url.origin).toBe("https://us.rest.logs.insight.rapid7.com");
        expect(url.pathname).toBe("/query/logsets");
        expect(init?.method).toBe("GET");
        expect(init?.body).toBeUndefined();
        expect(headers?.["x-api-key"]).toBe("rapid7-secret-api-key");
        expect(url.searchParams.get("query")).toContain("T1059");
        expect(url.searchParams.get("from")).toBe(
          String(Date.parse("2026-06-03T00:00:00.000Z"))
        );
        expect(url.searchParams.get("to")).toBe(
          String(Date.parse("2026-06-04T00:00:00.000Z"))
        );
        expect(url.searchParams.get("per_page")).toBe("5");
        expect(url.searchParams.getAll("logset_name")).toEqual(["InsightIDR"]);
        expect(url.searchParams.getAll("label")).toEqual(["security"]);

        return new Response(
          JSON.stringify({
            events: [
              {
                id: "event-1",
                message: "Periscan validation event technique=T1059 logged"
              }
            ]
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.observeControl!({
      authType: "apiKey",
      config: {
        apiBaseUrl: "https://us.rest.logs.insight.rapid7.com",
        apiKey: "rapid7-secret-api-key",
        connectorKey: "rapid7-insightidr",
        from: "2026-06-03T00:00:00.000Z",
        labels: ["security"],
        logsetNames: ["InsightIDR"],
        perPage: 5,
        techniqueId: "T1059",
        to: "2026-06-04T00:00:00.000Z"
      },
      integrationId: "b3b3b3b3-b3b3-4b3b-8b3b-b3b3b3b3b3b3",
      mockMode: false,
      tenantId: "b4b4b4b4-b4b4-4b4b-8b4b-b4b4b4b4b4b4"
    });

    expect(liveResult).toMatchObject({
      outcome: "Logged",
      sourceType: "rapid7_insightidr.log_search.observer"
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      fetchMock.mock.calls
        .map((call) => String(call[0]))
        .some((url) =>
          /(?:\/alerts|\/investigations|\/saved_queries|\/exports|\/reports|\/collectors|\/users|\/roles|\/ingest|\/management|\/detections|\/query\/jobs)/u.test(
            url
          )
        )
    ).toBe(false);
    expect(JSON.stringify(liveResult)).not.toContain("rapid7-secret-api-key");

    const failedFetchMock = vi.fn(async () => {
      throw new Error("rapid7 unavailable");
    });
    vi.stubGlobal("fetch", failedFetchMock);

    const failedResult = await connector!.observeControl!({
      authType: "apiKey",
      config: {
        apiKey: "rapid7-secret-api-key",
        connectorKey: "rapid7-insightidr"
      },
      integrationId: "b3b3b3b3-b3b3-4b3b-8b3b-b3b3b3b3b3b3",
      mockMode: false,
      tenantId: "b4b4b4b4-b4b4-4b4b-8b4b-b4b4b4b4b4b4"
    });

    expect(failedResult).toMatchObject({
      outcome: "NoEvidence",
      sourceType: "rapid7_insightidr.log_search.observer"
    });
    expect(failedResult.detail).toContain("rapid7 unavailable");
    expect(JSON.stringify(failedResult)).not.toContain("rapid7-secret-api-key");
  });

  it("exposes IBM QRadar read-only Ariel search observation verdicts", async () => {
    const connector = getConnectorByKey("ibm-qradar");

    expect(connector?.observeControl).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiToken"]));

    const result = await connector!.observeControl!({
      authType: "mock",
      config: {
        connectorKey: "ibm-qradar",
        fixtureOutcome: "Alerted",
        mockMode: true
      },
      integrationId: "b5b5b5b5-b5b5-4b5b-8b5b-b5b5b5b5b5b5",
      mockMode: true,
      tenantId: "b6b6b6b6-b6b6-4b6b-8b6b-b6b6b6b6b6b6"
    });

    expect(result).toMatchObject({
      outcome: "Alerted",
      sourceType: "ibm_qradar.ariel_search.observer"
    });

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        const headers = init?.headers as Record<string, string> | undefined;

        expect(headers?.SEC).toBe("qradar-sec-token");
        expect(headers?.Version).toBe("20.0");

        if (url === "https://qradar.example.com/api/ariel/searches") {
          expect(init?.method).toBe("POST");
          expect(String(init?.body)).toContain("query_expression=");
          expect(decodeURIComponent(String(init?.body))).toContain("T1059");

          return new Response(
            JSON.stringify({
              search_id: "qradar-search-1"
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (
          url ===
          "https://qradar.example.com/api/ariel/searches/qradar-search-1"
        ) {
          expect(init?.method).toBe("GET");

          return new Response(
            JSON.stringify({
              status: "COMPLETED"
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        expect(url).toBe(
          "https://qradar.example.com/api/ariel/searches/qradar-search-1/results"
        );
        expect(init?.method).toBe("GET");
        expect(headers?.Range).toBe("items=0-4");

        return new Response(
          JSON.stringify({
            events: [
              {
                event_name: "Periscan validation event technique=T1059 logged"
              }
            ]
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.observeControl!({
      authType: "apiToken",
      config: {
        apiBaseUrl: "https://qradar.example.com",
        apiToken: "qradar-sec-token",
        apiVersion: "20.0",
        connectorKey: "ibm-qradar",
        limit: 5,
        maxStatusPolls: 1,
        statusPollMs: 0,
        techniqueId: "T1059",
        timeRange: "LAST 24 HOURS"
      },
      integrationId: "b7b7b7b7-b7b7-4b7b-8b7b-b7b7b7b7b7b7",
      mockMode: false,
      tenantId: "b8b8b8b8-b8b8-4b8b-8b8b-b8b8b8b8b8b8"
    });

    expect(liveResult).toMatchObject({
      outcome: "Logged",
      sourceType: "ibm_qradar.ariel_search.observer"
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(
      fetchMock.mock.calls
        .map((call) => String(call[0]))
        .some((url) =>
          /(?:\/api\/siem|\/api\/analytics|\/api\/config|\/api\/reference_data|\/api\/staged_config|\/api\/scanner|\/api\/system|\/offenses|\/rules|\/notes|\/closing_reasons|\/deploy)/u.test(
            url
          )
        )
    ).toBe(false);
    expect(JSON.stringify(liveResult)).not.toContain("qradar-sec-token");

    const failedFetchMock = vi.fn(async () => {
      throw new Error("qradar unavailable");
    });
    vi.stubGlobal("fetch", failedFetchMock);

    const failedResult = await connector!.observeControl!({
      authType: "apiToken",
      config: {
        apiBaseUrl: "https://qradar.example.com",
        apiToken: "qradar-sec-token",
        connectorKey: "ibm-qradar"
      },
      integrationId: "b7b7b7b7-b7b7-4b7b-8b7b-b7b7b7b7b7b7",
      mockMode: false,
      tenantId: "b8b8b8b8-b8b8-4b8b-8b8b-b8b8b8b8b8b8"
    });

    expect(failedResult).toMatchObject({
      outcome: "NoEvidence",
      sourceType: "ibm_qradar.ariel_search.observer"
    });
    expect(failedResult.detail).toContain("qradar unavailable");
    expect(JSON.stringify(failedResult)).not.toContain("qradar-sec-token");
  });

  it("exposes Microsoft Defender XDR read-only Advanced Hunting observation verdicts", async () => {
    const connector = getConnectorByKey("microsoft-defender-xdr");

    expect(connector?.observeControl).toBeDefined();
    expect(connector!.manifest.marketplaceCategory).toBe("EDR/XDR");
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "oauth2ClientCredentials"]));

    const result = await connector!.observeControl!({
      authType: "mock",
      config: {
        connectorKey: "microsoft-defender-xdr",
        fixtureOutcome: "Detected",
        mockMode: true
      },
      integrationId: "b9b9b9b9-b9b9-4b9b-8b9b-b9b9b9b9b9b9",
      mockMode: true,
      tenantId: "babaaaab-baaa-4aaa-8aaa-babaaaababaa"
    });

    expect(result).toMatchObject({
      outcome: "Detected",
      sourceType: "microsoft_defender_xdr.advanced_hunting.observer"
    });

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);

        if (url.includes("/oauth2/v2.0/token")) {
          expect(url).toBe(
            "https://login.microsoftonline.com/tenant-123/oauth2/v2.0/token"
          );
          expect(init?.method).toBe("POST");
          expect(decodeURIComponent(String(init?.body))).toContain(
            "scope=https://api.security.microsoft.com/.default"
          );
          expect(String(init?.body)).toContain(
            "client_secret=defender-xdr-secret"
          );

          return new Response(
            JSON.stringify({
              access_token: "defender-xdr-access-token"
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        expect(url).toBe(
          "https://api.security.microsoft.com/api/advancedhunting/run"
        );
        expect(init?.method).toBe("POST");
        expect(
          (init?.headers as Record<string, string> | undefined)?.authorization
        ).toBe("Bearer defender-xdr-access-token");
        expect(String(init?.body)).toContain("Query");
        expect(String(init?.body)).toContain("T1059");

        return new Response(
          JSON.stringify({
            Results: [
              {
                AttackTechniques: "T1059",
                Timestamp: "2026-06-01T13:00:00Z",
                Title: "Periscan validation event alerted by Defender XDR"
              }
            ],
            Schema: []
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.observeControl!({
      authType: "oauth2ClientCredentials",
      config: {
        clientId: "defender-xdr-client-id",
        clientSecret: "defender-xdr-secret",
        connectorKey: "microsoft-defender-xdr",
        techniqueId: "T1059",
        tenantId: "tenant-123"
      },
      integrationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      mockMode: false,
      tenantId: "bcbcbcbc-bcbc-4bcb-8bcb-bcbcbcbcbcbc"
    });

    expect(liveResult).toMatchObject({
      outcome: "Alerted",
      sourceType: "microsoft_defender_xdr.advanced_hunting.observer"
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      fetchMock.mock.calls
        .map((call) => String(call[0]))
        .some((url) =>
          /(?:\/api\/incidents|\/api\/alerts|\/api\/machines|\/api\/indicators|\/api\/customdetections|\/api\/libraryfiles|\/api\/machineactions|\/api\/liveResponse|\/api\/advancedhunting\/rules|isolate|runliveresponse|offboard|stopandquarantine|remediate)/iu.test(
            url
          )
        )
    ).toBe(false);
    expect(JSON.stringify(liveResult)).not.toContain("defender-xdr-secret");
    expect(JSON.stringify(liveResult)).not.toContain(
      "defender-xdr-access-token"
    );

    const failedFetchMock = vi.fn(async () => {
      throw new Error("defender xdr unavailable");
    });
    vi.stubGlobal("fetch", failedFetchMock);

    const failedResult = await connector!.observeControl!({
      authType: "oauth2ClientCredentials",
      config: {
        clientId: "defender-xdr-client-id",
        clientSecret: "defender-xdr-secret",
        connectorKey: "microsoft-defender-xdr",
        tenantId: "tenant-123"
      },
      integrationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      mockMode: false,
      tenantId: "bcbcbcbc-bcbc-4bcb-8bcb-bcbcbcbcbcbc"
    });

    expect(failedResult).toMatchObject({
      outcome: "NoEvidence",
      sourceType: "microsoft_defender_xdr.advanced_hunting.observer"
    });
    expect(failedResult.detail).toContain("defender xdr unavailable");
    expect(JSON.stringify(failedResult)).not.toContain("defender-xdr-secret");
  });

  it("exposes SentinelOne read-only threat observation verdicts", async () => {
    const connector = getConnectorByKey("sentinelone");

    expect(connector?.observeControl).toBeDefined();
    expect(connector!.manifest.marketplaceCategory).toBe("EDR/XDR");
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiToken"]));

    const result = await connector!.observeControl!({
      authType: "mock",
      config: {
        connectorKey: "sentinelone",
        fixtureOutcome: "Blocked",
        mockMode: true
      },
      integrationId: "bdbdbdbd-bdbd-4bdb-8bdb-bdbdbdbdbdbd",
      mockMode: true,
      tenantId: "bebebebe-bebe-4beb-8beb-bebebebebebe"
    });

    expect(result).toMatchObject({
      outcome: "Blocked",
      sourceType: "sentinelone.threats.observer"
    });

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);

        expect(url).toContain(
          "https://tenant.sentinelone.net/web/api/v2.1/threats"
        );
        expect(init?.method).toBe("GET");
        expect(
          (init?.headers as Record<string, string> | undefined)?.authorization
        ).toBe("ApiToken sentinelone-secret-token");
        expect(url).toContain("limit=5");
        expect(decodeURIComponent(url)).toContain("T1059");

        return new Response(
          JSON.stringify({
            data: [
              {
                id: "threat-live-1",
                threatInfo: {
                  analystVerdict: "true_positive",
                  classification: "malware",
                  createdAt: "2026-06-01T14:00:00Z",
                  mitigationStatus: "mitigated",
                  threatName: "Periscan validation event"
                }
              }
            ],
            pagination: {
              totalItems: 1
            }
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.observeControl!({
      authType: "apiToken",
      config: {
        apiToken: "sentinelone-secret-token",
        baseUrl: "https://tenant.sentinelone.net",
        connectorKey: "sentinelone",
        limit: 5,
        siteIds: ["site-1"],
        techniqueId: "T1059"
      },
      integrationId: "bfbfbfbf-bfbf-4bfb-8bfb-bfbfbfbfbfbf",
      mockMode: false,
      tenantId: "c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c0c0c0"
    });

    expect(liveResult).toMatchObject({
      outcome: "Blocked",
      sourceType: "sentinelone.threats.observer"
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      fetchMock.mock.calls
        .map((call) => String(call[0]))
        .some((url) =>
          /(?:\/mitigate|\/restrictions|\/exclusions|\/remote-scripts|\/actions|mark-as|blacklist|quarantine|rollback|\/policy|\/firewall-control|\/device-control|\/ranger|\/upload|fetch-file)/iu.test(
            url
          )
        )
    ).toBe(false);
    expect(JSON.stringify(liveResult)).not.toContain(
      "sentinelone-secret-token"
    );

    const failedFetchMock = vi.fn(async () => {
      throw new Error("sentinelone unavailable");
    });
    vi.stubGlobal("fetch", failedFetchMock);

    const failedResult = await connector!.observeControl!({
      authType: "apiToken",
      config: {
        apiToken: "sentinelone-secret-token",
        baseUrl: "https://tenant.sentinelone.net",
        connectorKey: "sentinelone"
      },
      integrationId: "bfbfbfbf-bfbf-4bfb-8bfb-bfbfbfbfbfbf",
      mockMode: false,
      tenantId: "c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c0c0c0"
    });

    expect(failedResult).toMatchObject({
      outcome: "NoEvidence",
      sourceType: "sentinelone.threats.observer"
    });
    expect(failedResult.detail).toContain("sentinelone unavailable");
    expect(JSON.stringify(failedResult)).not.toContain(
      "sentinelone-secret-token"
    );
  });

  it("exposes Carbon Black read-only Alerts v7 observation verdicts", async () => {
    const connector = getConnectorByKey("vmware-carbon-black");

    expect(connector?.observeControl).toBeDefined();
    expect(connector!.manifest.marketplaceCategory).toBe("EDR/XDR");
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiToken"]));

    const result = await connector!.observeControl!({
      authType: "mock",
      config: {
        connectorKey: "vmware-carbon-black",
        fixtureOutcome: "Blocked",
        mockMode: true
      },
      integrationId: "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1",
      mockMode: true,
      tenantId: "c2c2c2c2-c2c2-4c2c-8c2c-c2c2c2c2c2c2"
    });

    expect(result).toMatchObject({
      outcome: "Blocked",
      sourceType: "carbon_black.alerts.observer"
    });

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);

        expect(url).toBe(
          "https://defense.example.com/api/alerts/v7/orgs/ORG123/alerts/_search"
        );
        expect(init?.method).toBe("POST");
        expect(
          (init?.headers as Record<string, string> | undefined)?.[
            "X-AUTH-TOKEN"
          ]
        ).toBe("carbonblack-secret/APIID123");
        expect(String(init?.body)).toContain("T1059");
        expect(String(init?.body)).toContain('"rows":5');

        return new Response(
          JSON.stringify({
            num_found: 1,
            results: [
              {
                backend_timestamp: "2026-06-01T15:00:00Z",
                determination: "KNOWN_MALWARE",
                id: "alert-live-1",
                policy_action: "DENY",
                reason: "Periscan validation event blocked"
              }
            ]
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.observeControl!({
      authType: "apiToken",
      config: {
        apiId: "APIID123",
        apiSecretKey: "carbonblack-secret",
        baseUrl: "https://defense.example.com",
        connectorKey: "vmware-carbon-black",
        limit: 5,
        orgKey: "ORG123",
        query: "periscan T1059"
      },
      integrationId: "c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3",
      mockMode: false,
      tenantId: "c4c4c4c4-c4c4-4c4c-8c4c-c4c4c4c4c4c4"
    });

    expect(liveResult).toMatchObject({
      outcome: "Blocked",
      sourceType: "carbon_black.alerts.observer"
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      fetchMock.mock.calls
        .map((call) => String(call[0]))
        .some((url) =>
          /(?:\/notes|\/workflow|\/devices|\/device_actions|\/live-response|\/policy|\/rules|\/reputation|\/remediation|\/isolate|\/quarantine|\/dismiss|\/threats\/[^/]+\/history)/iu.test(
            url
          )
        )
    ).toBe(false);
    expect(JSON.stringify(liveResult)).not.toContain("carbonblack-secret");

    const failedFetchMock = vi.fn(async () => {
      throw new Error("carbon black unavailable");
    });
    vi.stubGlobal("fetch", failedFetchMock);

    const failedResult = await connector!.observeControl!({
      authType: "apiToken",
      config: {
        apiId: "APIID123",
        apiSecretKey: "carbonblack-secret",
        baseUrl: "https://defense.example.com",
        connectorKey: "vmware-carbon-black",
        orgKey: "ORG123"
      },
      integrationId: "c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3",
      mockMode: false,
      tenantId: "c4c4c4c4-c4c4-4c4c-8c4c-c4c4c4c4c4c4"
    });

    expect(failedResult).toMatchObject({
      outcome: "NoEvidence",
      sourceType: "carbon_black.alerts.observer"
    });
    expect(failedResult.detail).toContain("carbon black unavailable");
    expect(JSON.stringify(failedResult)).not.toContain("carbonblack-secret");
  });

  it("exposes Sophos Central read-only alert observation verdicts", async () => {
    const connector = getConnectorByKey("sophos-intercept-x");

    expect(connector?.observeControl).toBeDefined();
    expect(connector!.manifest.marketplaceCategory).toBe("EDR/XDR");
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "oauth2ClientCredentials"]));

    const result = await connector!.observeControl!({
      authType: "mock",
      config: {
        connectorKey: "sophos-intercept-x",
        fixtureOutcome: "Blocked",
        mockMode: true
      },
      integrationId: "d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1",
      mockMode: true,
      tenantId: "d2d2d2d2-d2d2-4d2d-8d2d-d2d2d2d2d2d2"
    });

    expect(result).toMatchObject({
      outcome: "Blocked",
      sourceType: "sophos.alerts.observer"
    });

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);

        if (url === "https://id.sophos.test/oauth2/token") {
          expect(init?.method).toBe("POST");
          expect(String(init?.body)).toContain("grant_type=client_credentials");
          expect(String(init?.body)).toContain("scope=token");
          expect(String(init?.body)).toContain("client_secret=sophos-secret");

          return new Response(
            JSON.stringify({
              access_token: "sophos-access-token"
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (url === "https://api.central.sophos.test/whoami/v1") {
          expect(init?.method).toBe("GET");
          expect(
            (init?.headers as Record<string, string> | undefined)?.authorization
          ).toBe("Bearer sophos-access-token");

          return new Response(
            JSON.stringify({
              dataRegion: "https://api-us03.central.sophos.com",
              id: "tenant-sophos-1"
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        expect(url).toBe(
          "https://api-us03.central.sophos.com/common/v1/alerts/search"
        );
        expect(init?.method).toBe("POST");
        expect(
          (init?.headers as Record<string, string> | undefined)?.["X-Tenant-ID"]
        ).toBe("tenant-sophos-1");
        expect(
          (init?.headers as Record<string, string> | undefined)?.authorization
        ).toBe("Bearer sophos-access-token");
        expect(String(init?.body)).toContain('"pageSize":5');
        expect(String(init?.body)).toContain('"endpoint"');
        expect(String(init?.body)).toContain('"runtimeDetections"');

        return new Response(
          JSON.stringify({
            items: [
              {
                category: "runtimeDetections",
                description: "Periscan validation event blocked",
                id: "sophos-alert-live-1",
                product: "endpoint",
                raisedAt: "2026-06-01T16:00:00Z",
                severity: "high",
                type: "Blocked malware"
              }
            ]
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.observeControl!({
      authType: "oauth2ClientCredentials",
      config: {
        categories: ["runtimeDetections"],
        clientId: "sophos-client-id",
        clientSecret: "sophos-secret",
        connectorKey: "sophos-intercept-x",
        limit: 5,
        tokenUrl: "https://id.sophos.test/oauth2/token",
        whoamiUrl: "https://api.central.sophos.test/whoami/v1"
      },
      integrationId: "d3d3d3d3-d3d3-4d3d-8d3d-d3d3d3d3d3d3",
      mockMode: false,
      tenantId: "d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4"
    });

    expect(liveResult).toMatchObject({
      outcome: "Blocked",
      sourceType: "sophos.alerts.observer"
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(
      fetchMock.mock.calls
        .map((call) => String(call[0]))
        .some((url) =>
          /(?:\/actions|\/endpoints|\/scans|\/isolation|\/policy|\/cleanup|\/remediation|\/acknowledge|\/resolve|\/delete|\/update|\/devices\/[^/]+\/actions)/iu.test(
            url
          )
        )
    ).toBe(false);
    expect(JSON.stringify(liveResult)).not.toContain("sophos-secret");

    const failedFetchMock = vi.fn(async () => {
      throw new Error("sophos unavailable");
    });
    vi.stubGlobal("fetch", failedFetchMock);

    const failedResult = await connector!.observeControl!({
      authType: "oauth2ClientCredentials",
      config: {
        clientId: "sophos-client-id",
        clientSecret: "sophos-secret",
        connectorKey: "sophos-intercept-x"
      },
      integrationId: "d3d3d3d3-d3d3-4d3d-8d3d-d3d3d3d3d3d3",
      mockMode: false,
      tenantId: "d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4"
    });

    expect(failedResult).toMatchObject({
      outcome: "NoEvidence",
      sourceType: "sophos.alerts.observer"
    });
    expect(failedResult.detail).toContain("sophos unavailable");
    expect(JSON.stringify(failedResult)).not.toContain("sophos-secret");
  });

  it("exposes Trend Vision One read-only Workbench alert observation verdicts", async () => {
    const connector = getConnectorByKey("trend-vision-one");

    expect(connector?.observeControl).toBeDefined();
    expect(connector!.manifest.marketplaceCategory).toBe("EDR/XDR");
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiToken"]));

    const result = await connector!.observeControl!({
      authType: "mock",
      config: {
        connectorKey: "trend-vision-one",
        fixtureOutcome: "Blocked",
        mockMode: true
      },
      integrationId: "e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1",
      mockMode: true,
      tenantId: "e2e2e2e2-e2e2-4e2e-8e2e-e2e2e2e2e2e2"
    });

    expect(result).toMatchObject({
      outcome: "Blocked",
      sourceType: "trend_micro.workbench_alerts.observer"
    });

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input));

        expect(url.origin).toBe("https://api.xdr.trendmicro.test");
        expect(url.pathname).toBe("/v3.0/workbench/alerts");
        expect(url.searchParams.get("dateTimeTarget")).toBe("createdDateTime");
        expect(url.searchParams.get("orderBy")).toBe("createdDateTime desc");
        expect(url.searchParams.get("startDateTime")).toBe(
          "2026-06-01T00:00:00Z"
        );
        expect(url.searchParams.get("top")).toBe("5");
        expect(init?.method).toBe("GET");
        expect(
          (init?.headers as Record<string, string> | undefined)?.authorization
        ).toBe("Bearer trend-token");
        expect(
          (init?.headers as Record<string, string> | undefined)?.["TMV1-Filter"]
        ).toBe("contains(matchedRules.name,'Periscan')");

        return new Response(
          JSON.stringify({
            items: [
              {
                createdDateTime: "2026-06-01T17:00:00Z",
                id: "WB-1-20260601-00001",
                investigationResult: "True Positive",
                matchedRules: [
                  {
                    matchedFilters: {
                      mitreTechniqueIds: ["T1059"]
                    },
                    name: "Periscan validation model"
                  }
                ],
                modelSeverity: "high",
                score: 82,
                status: "Closed - prevented"
              }
            ]
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.observeControl!({
      authType: "apiToken",
      config: {
        apiToken: "trend-token",
        baseUrl: "https://api.xdr.trendmicro.test",
        connectorKey: "trend-vision-one",
        filter: "contains(matchedRules.name,'Periscan')",
        limit: 5,
        startDateTime: "2026-06-01T00:00:00Z"
      },
      integrationId: "e3e3e3e3-e3e3-4e3e-8e3e-e3e3e3e3e3e3",
      mockMode: false,
      tenantId: "e4e4e4e4-e4e4-4e4e-8e4e-e4e4e4e4e4e4"
    });

    expect(liveResult).toMatchObject({
      outcome: "Blocked",
      sourceType: "trend_micro.workbench_alerts.observer"
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      fetchMock.mock.calls
        .map((call) => String(call[0]))
        .some((url) =>
          /(?:\/response|\/playbooks|\/actions|\/isolate|\/remediate|\/models|\/suspiciousObject|\/workbench\/alerts\/[^/?]+|\/accounts|\/roles)/iu.test(
            url
          )
        )
    ).toBe(false);
    expect(JSON.stringify(liveResult)).not.toContain("trend-token");

    const failedFetchMock = vi.fn(async () => {
      throw new Error("trend unavailable");
    });
    vi.stubGlobal("fetch", failedFetchMock);

    const failedResult = await connector!.observeControl!({
      authType: "apiToken",
      config: {
        apiToken: "trend-token",
        connectorKey: "trend-vision-one"
      },
      integrationId: "e3e3e3e3-e3e3-4e3e-8e3e-e3e3e3e3e3e3",
      mockMode: false,
      tenantId: "e4e4e4e4-e4e4-4e4e-8e4e-e4e4e4e4e4e4"
    });

    expect(failedResult).toMatchObject({
      outcome: "NoEvidence",
      sourceType: "trend_micro.workbench_alerts.observer"
    });
    expect(failedResult.detail).toContain("trend unavailable");
    expect(JSON.stringify(failedResult)).not.toContain("trend-token");
  });

  it("exposes Palo Alto Cortex XDR read-only incident observation verdicts", async () => {
    const connector = getConnectorByKey("palo-cortex-xdr");

    expect(connector?.observeControl).toBeDefined();
    expect(connector!.manifest.marketplaceCategory).toBe("EDR/XDR");
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiToken"]));

    const result = await connector!.observeControl!({
      authType: "mock",
      config: {
        connectorKey: "palo-cortex-xdr",
        fixtureOutcome: "Blocked",
        mockMode: true
      },
      integrationId: "f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1",
      mockMode: true,
      tenantId: "f2f2f2f2-f2f2-4f2f-8f2f-f2f2f2f2f2f2"
    });

    expect(result).toMatchObject({
      outcome: "Blocked",
      sourceType: "palo_alto_cortex_xdr.incidents.observer"
    });

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input));
        const body = JSON.parse(String(init?.body)) as {
          request_data: {
            filters: Array<Record<string, unknown>>;
            search_from: number;
            search_to: number;
            sort: {
              field: string;
              keyword: string;
            };
          };
        };

        expect(url.origin).toBe("https://api-acme.xdr.us.paloaltonetworks.com");
        expect(url.pathname).toBe("/public_api/v1/incidents/get_incidents");
        expect(init?.method).toBe("POST");
        expect(
          (init?.headers as Record<string, string> | undefined)?.authorization
        ).toBe("cortex-secret-key");
        expect(
          (init?.headers as Record<string, string> | undefined)?.[
            "x-xdr-auth-id"
          ]
        ).toBe("42");
        expect(body.request_data.search_from).toBe(0);
        expect(body.request_data.search_to).toBe(5);
        expect(body.request_data.sort).toEqual({
          field: "creation_time",
          keyword: "desc"
        });
        expect(body.request_data.filters).toEqual(
          expect.arrayContaining([
            {
              field: "creation_time",
              operator: "gte",
              value: 1780313600000
            },
            {
              field: "status",
              operator: "in",
              value: ["new", "under_investigation"]
            }
          ])
        );

        return new Response(
          JSON.stringify({
            reply: {
              incidents: [
                {
                  alert_categories: ["Credential Access"],
                  creation_time: 1780317200000,
                  high_severity_alert_count: 1,
                  incident_id: "9001",
                  incident_name: "Periscan validation incident",
                  incident_sources: ["XDR Agent"],
                  severity: "high",
                  status: "resolved_prevented"
                }
              ]
            }
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.observeControl!({
      authType: "apiToken",
      config: {
        apiKey: "cortex-secret-key",
        baseUrl: "https://api-acme.xdr.us.paloaltonetworks.com",
        connectorKey: "palo-cortex-xdr",
        creationTimeGte: 1780313600000,
        incidentStatuses: ["new", "under_investigation"],
        limit: 5,
        xdrAuthId: "42"
      },
      integrationId: "f3f3f3f3-f3f3-4f3f-8f3f-f3f3f3f3f3f3",
      mockMode: false,
      tenantId: "f4f4f4f4-f4f4-4f4f-8f4f-f4f4f4f4f4f4"
    });

    expect(liveResult).toMatchObject({
      outcome: "Blocked",
      sourceType: "palo_alto_cortex_xdr.incidents.observer"
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      fetchMock.mock.calls
        .map((call) => String(call[0]))
        .some((url) =>
          /(?:\/response|\/actions|\/endpoints\/isolate|\/scripts|\/blocklist|\/allowlist|\/policies|\/remediation|\/incidents\/(?:update|resolve|assign|add))/iu.test(
            url
          )
        )
    ).toBe(false);
    expect(JSON.stringify(liveResult)).not.toContain("cortex-secret-key");

    const failedFetchMock = vi.fn(async () => {
      throw new Error("cortex unavailable");
    });
    vi.stubGlobal("fetch", failedFetchMock);

    const failedResult = await connector!.observeControl!({
      authType: "apiToken",
      config: {
        apiKey: "cortex-secret-key",
        baseUrl: "https://api-acme.xdr.us.paloaltonetworks.com",
        connectorKey: "palo-cortex-xdr",
        xdrAuthId: "42"
      },
      integrationId: "f3f3f3f3-f3f3-4f3f-8f3f-f3f3f3f3f3f3",
      mockMode: false,
      tenantId: "f4f4f4f4-f4f4-4f4f-8f4f-f4f4f4f4f4f4"
    });

    expect(failedResult).toMatchObject({
      outcome: "NoEvidence",
      sourceType: "palo_alto_cortex_xdr.incidents.observer"
    });
    expect(failedResult.detail).toContain("cortex unavailable");
    expect(JSON.stringify(failedResult)).not.toContain("cortex-secret-key");
  });

  it("exposes Fastly Next-Gen WAF read-only event observation verdicts", async () => {
    const connector = getConnectorByKey("fastly-next-gen-waf");

    expect(connector?.observeControl).toBeDefined();
    expect(connector!.manifest.marketplaceCategory).toBe("WAF/Firewall");
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiToken"]));

    const result = await connector!.observeControl!({
      authType: "mock",
      config: {
        connectorKey: "fastly-next-gen-waf",
        fixtureOutcome: "Blocked",
        mockMode: true
      },
      integrationId: "fafafa10-fafa-4afa-8afa-fafafafafa10",
      mockMode: true,
      tenantId: "fafafa20-fafa-4afa-8afa-fafafafafa20"
    });

    expect(result).toMatchObject({
      outcome: "Blocked",
      sourceType: "fastly_next_gen_waf.events.observer"
    });

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input));

        expect(url.origin).toBe("https://dashboard.signalsciences.test");
        expect(url.pathname).toBe("/api/v0/corps/acme/sites/app/events");
        expect(url.searchParams.get("from")).toBe("1780313600");
        expect(url.searchParams.get("until")).toBe("1780317200");
        expect(url.searchParams.get("limit")).toBe("5");
        expect(init?.method).toBe("GET");
        expect(
          (init?.headers as Record<string, string> | undefined)?.["x-api-user"]
        ).toBe("waf-owner@example.com");
        expect(
          (init?.headers as Record<string, string> | undefined)?.["x-api-token"]
        ).toBe("fastly-secret-token");

        return new Response(
          JSON.stringify({
            data: [
              {
                action: "blocked",
                created: "2026-06-01T18:00:00Z",
                id: "event-1",
                requestCount: 1,
                signal: ["SQLI"]
              }
            ]
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.observeControl!({
      authType: "apiToken",
      config: {
        apiToken: "fastly-secret-token",
        baseUrl: "https://dashboard.signalsciences.test/api/v0",
        connectorKey: "fastly-next-gen-waf",
        corpName: "acme",
        email: "waf-owner@example.com",
        from: 1780313600,
        limit: 5,
        siteName: "app",
        until: 1780317200
      },
      integrationId: "fafafa30-fafa-4afa-8afa-fafafafafa30",
      mockMode: false,
      tenantId: "fafafa40-fafa-4afa-8afa-fafafafafa40"
    });

    expect(liveResult).toMatchObject({
      outcome: "Blocked",
      sourceType: "fastly_next_gen_waf.events.observer"
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      fetchMock.mock.calls
        .map((call) => String(call[0]))
        .some((url) =>
          /(?:\/rules|\/lists|\/redactions|\/alerts|\/keys|\/simulator|\/edgeDeployment|\/deliveryIntegration|\/blacklist|\/whitelist|\/monitors)/iu.test(
            url
          )
        )
    ).toBe(false);
    expect(JSON.stringify(liveResult)).not.toContain("fastly-secret-token");

    const failedFetchMock = vi.fn(async () => {
      throw new Error("fastly unavailable");
    });
    vi.stubGlobal("fetch", failedFetchMock);

    const failedResult = await connector!.observeControl!({
      authType: "apiToken",
      config: {
        apiToken: "fastly-secret-token",
        connectorKey: "fastly-next-gen-waf",
        corpName: "acme",
        email: "waf-owner@example.com",
        siteName: "app"
      },
      integrationId: "fafafa30-fafa-4afa-8afa-fafafafafa30",
      mockMode: false,
      tenantId: "fafafa40-fafa-4afa-8afa-fafafafafa40"
    });

    expect(failedResult).toMatchObject({
      outcome: "NoEvidence",
      sourceType: "fastly_next_gen_waf.events.observer"
    });
    expect(failedResult.detail).toContain("fastly unavailable");
    expect(JSON.stringify(failedResult)).not.toContain("fastly-secret-token");
  });

  it("exposes Akamai Kona read-only SIEM security event observation verdicts", async () => {
    const connector = getConnectorByKey("akamai-kona");

    expect(connector?.observeControl).toBeDefined();
    expect(connector!.manifest.marketplaceCategory).toBe("WAF/Firewall");
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "edgeGrid"]));

    const result = await connector!.observeControl!({
      authType: "mock",
      config: {
        connectorKey: "akamai-kona",
        fixtureOutcome: "Blocked",
        mockMode: true
      },
      integrationId: "ababab10-abab-4aba-8aba-ababababab10",
      mockMode: true,
      tenantId: "ababab20-abab-4aba-8aba-ababababab20"
    });

    expect(result).toMatchObject({
      outcome: "Blocked",
      sourceType: "akamai_kona.siem_events.observer"
    });

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input));
        const headers = init?.headers as Record<string, string> | undefined;

        expect(url.origin).toBe("https://akab-test.luna.akamaiapis.net");
        expect(url.pathname).toBe("/siem/v1/configs/12345");
        expect(url.searchParams.get("from")).toBe("1780313600");
        expect(url.searchParams.get("to")).toBe("1780317200");
        expect(url.searchParams.get("limit")).toBe("5");
        expect(init?.method).toBe("GET");
        expect(headers?.authorization).toContain("EG1-HMAC-SHA256");
        expect(headers?.authorization).toContain(
          "client_token=akab-client-token"
        );
        expect(headers?.authorization).toContain(
          "access_token=akab-access-token"
        );
        expect(headers?.authorization).not.toContain("akamai-client-secret");

        return new Response(
          [
            JSON.stringify({
              action: "deny",
              attackData: {
                ruleId: "981176",
                ruleMessage: "SQL Injection Attack"
              },
              eventTime: "2026-06-01T18:30:00Z",
              requestId: "req-1"
            }),
            JSON.stringify({
              ResponseContext: {
                offset: "next-offset"
              }
            })
          ].join("\n"),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.observeControl!({
      authType: "edgeGrid",
      config: {
        accessToken: "akab-access-token",
        clientSecret: "akamai-client-secret",
        clientToken: "akab-client-token",
        configId: "12345",
        connectorKey: "akamai-kona",
        from: 1780313600,
        host: "akab-test.luna.akamaiapis.net",
        limit: 5,
        to: 1780317200
      },
      integrationId: "ababab30-abab-4aba-8aba-ababababab30",
      mockMode: false,
      tenantId: "ababab40-abab-4aba-8aba-ababababab40"
    });

    expect(liveResult).toMatchObject({
      outcome: "Blocked",
      sourceType: "akamai_kona.siem_events.observer"
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      fetchMock.mock.calls
        .map((call) => String(call[0]))
        .some((url) =>
          /(?:\/appsec\/|\/policies|\/versions|\/rules|\/activations|\/network-list|\/rate-policies|\/match-targets|\/bypass|\/remediation)/iu.test(
            url
          )
        )
    ).toBe(false);
    expect(JSON.stringify(liveResult)).not.toContain("akamai-client-secret");
    expect(JSON.stringify(liveResult)).not.toContain("akab-access-token");

    const failedFetchMock = vi.fn(async () => {
      throw new Error("akamai unavailable");
    });
    vi.stubGlobal("fetch", failedFetchMock);

    const failedResult = await connector!.observeControl!({
      authType: "edgeGrid",
      config: {
        accessToken: "akab-access-token",
        clientSecret: "akamai-client-secret",
        clientToken: "akab-client-token",
        configId: "12345",
        connectorKey: "akamai-kona",
        host: "akab-test.luna.akamaiapis.net"
      },
      integrationId: "ababab30-abab-4aba-8aba-ababababab30",
      mockMode: false,
      tenantId: "ababab40-abab-4aba-8aba-ababababab40"
    });

    expect(failedResult).toMatchObject({
      outcome: "NoEvidence",
      sourceType: "akamai_kona.siem_events.observer"
    });
    expect(failedResult.detail).toContain("akamai unavailable");
    expect(JSON.stringify(failedResult)).not.toContain("akamai-client-secret");
  });

  it("exposes Imperva Cloud WAF read-only site posture observation verdicts", async () => {
    const connector = getConnectorByKey("imperva");

    expect(connector?.observeControl).toBeDefined();
    expect(connector!.manifest.marketplaceCategory).toBe("WAF/Firewall");
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiKey"]));

    const result = await connector!.observeControl!({
      authType: "mock",
      config: {
        connectorKey: "imperva",
        fixtureOutcome: "Blocked",
        mockMode: true
      },
      integrationId: "cdcdcd10-cdcd-4cdc-8cdc-cdcdcdcdcd10",
      mockMode: true,
      tenantId: "cdcdcd20-cdcd-4cdc-8cdc-cdcdcdcdcd20"
    });

    expect(result).toMatchObject({
      outcome: "Blocked",
      sourceType: "imperva.cloud_waf.observer"
    });

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const body = init?.body as URLSearchParams;

        expect(String(input)).toBe(
          "https://my.imperva.test/api/prov/v1/sites/list"
        );
        expect(init?.method).toBe("POST");
        expect(body.get("api_id")).toBe("12345");
        expect(body.get("api_key")).toBe("imperva-secret-key");
        expect(body.get("page_num")).toBe("0");
        expect(body.get("page_size")).toBe("50");

        return new Response(
          JSON.stringify({
            res: 0,
            res_message: "OK",
            sites: [
              {
                account_id: 12345,
                active: "active",
                domain: "app.example.com",
                display_name: "app.example.com",
                security: {
                  waf: {
                    rules: [
                      {
                        action: "api.threats.action.block",
                        action_text: "Block",
                        id: "api.threats.sql_injection",
                        name: "SQL Injection"
                      }
                    ]
                  }
                },
                site_creation_date: 1780315200000,
                site_id: 67890
              }
            ]
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.observeControl!({
      authType: "apiKey",
      config: {
        apiKey: "imperva-secret-key",
        accessId: "12345",
        baseUrl: "https://my.imperva.test",
        connectorKey: "imperva",
        pageSize: 50
      },
      integrationId: "cdcdcd30-cdcd-4cdc-8cdc-cdcdcdcdcd30",
      mockMode: false,
      tenantId: "cdcdcd40-cdcd-4cdc-8cdc-cdcdcdcdcd40"
    });

    expect(liveResult).toMatchObject({
      outcome: "Blocked",
      sourceType: "imperva.cloud_waf.observer"
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      fetchMock.mock.calls
        .map((call) => String(call[0]))
        .some((url) =>
          /(?:\/add|\/edit|\/delete|\/configure|\/incapRules\/add|\/incapRules\/delete|\/ssl|\/cache|\/dns|\/ddos|\/siem.*(?:add|edit|delete))/iu.test(
            url
          )
        )
    ).toBe(false);
    expect(JSON.stringify(liveResult)).not.toContain("imperva-secret-key");

    const syncResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "imperva",
        fixtureOutcome: "Blocked",
        mockMode: true
      },
      integrationId: "cdcdcd50-cdcd-4cdc-8cdc-cdcdcdcdcd50",
      mockMode: true,
      tenantId: "cdcdcd60-cdcd-4cdc-8cdc-cdcdcdcdcd60"
    });

    expect(syncResult.assets[0]?.assetType).toBe("Domain");
    expect(
      syncResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(expect.arrayContaining(["WafProtectedSite", "WafRuleBlocking"]));

    const failedFetchMock = vi.fn(async () => {
      throw new Error("imperva unavailable");
    });
    vi.stubGlobal("fetch", failedFetchMock);

    const failedResult = await connector!.observeControl!({
      authType: "apiKey",
      config: {
        apiKey: "imperva-secret-key",
        accessId: "12345",
        connectorKey: "imperva"
      },
      integrationId: "cdcdcd30-cdcd-4cdc-8cdc-cdcdcdcdcd30",
      mockMode: false,
      tenantId: "cdcdcd40-cdcd-4cdc-8cdc-cdcdcdcdcd40"
    });

    expect(failedResult).toMatchObject({
      outcome: "NoEvidence",
      sourceType: "imperva.cloud_waf.observer"
    });
    expect(failedResult.detail).toContain("imperva unavailable");
    expect(JSON.stringify(failedResult)).not.toContain("imperva-secret-key");
  });

  it("exposes Palo Alto Panorama read-only firewall log observation verdicts", async () => {
    const connector = getConnectorByKey("palo-panorama");

    expect(connector?.observeControl).toBeDefined();
    expect(connector!.manifest.marketplaceCategory).toBe("WAF/Firewall");
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiKey"]));

    const result = await connector!.observeControl!({
      authType: "mock",
      config: {
        connectorKey: "palo-panorama",
        fixtureOutcome: "Blocked",
        mockMode: true
      },
      integrationId: "ededed10-eded-4ede-8ede-ededededed10",
      mockMode: true,
      tenantId: "ededed20-eded-4ede-8ede-ededededed20"
    });

    expect(result).toMatchObject({
      outcome: "Blocked",
      sourceType: "palo_alto_panorama.logs.observer"
    });

    const requestBodies: string[] = [];
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const body = init?.body as URLSearchParams;
        const bodyString = body.toString();

        requestBodies.push(bodyString);
        expect(String(input)).toBe("https://panorama.example.test/api/");
        expect(init?.method).toBe("POST");
        expect(body.get("type")).toBe("log");
        expect(body.get("action")).toBe("get");
        expect(body.get("key")).toBe("panorama-secret-key");

        if (fetchMock.mock.calls.length === 1) {
          expect(body.get("log-type")).toBe("threat");
          expect(body.get("query")).toBe("(addr.src eq 198.51.100.10)");
          expect(body.get("nlogs")).toBe("5");

          return new Response(
            '<response status="success"><result><job>123</job></result></response>',
            {
              headers: {
                "content-type": "application/xml"
              },
              status: 200
            }
          );
        }

        expect(body.get("job-id")).toBe("123");

        return new Response(
          [
            '<response status="success">',
            "<result>",
            "<log>",
            "<logs>",
            '<entry logid="1">',
            "<receive_time>2026/06/01 19:00:00</receive_time>",
            "<seqno>200001</seqno>",
            "<action>deny</action>",
            "<severity>high</severity>",
            "<rule>periscan-validation</rule>",
            "<src>198.51.100.10</src>",
            "<dst>203.0.113.10</dst>",
            "<threatid>Periscan validation event</threatid>",
            "</entry>",
            "</logs>",
            "</log>",
            "</result>",
            "</response>"
          ].join(""),
          {
            headers: {
              "content-type": "application/xml"
            },
            status: 200
          }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.observeControl!({
      authType: "apiKey",
      config: {
        apiKey: "panorama-secret-key",
        baseUrl: "https://panorama.example.test",
        connectorKey: "palo-panorama",
        limit: 5,
        logType: "threat",
        maxPolls: 2,
        query: "(addr.src eq 198.51.100.10)"
      },
      integrationId: "ededed30-eded-4ede-8ede-ededededed30",
      mockMode: false,
      tenantId: "ededed40-eded-4ede-8ede-ededededed40"
    });

    expect(liveResult).toMatchObject({
      outcome: "Blocked",
      sourceType: "palo_alto_panorama.logs.observer"
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      requestBodies.some((body) =>
        /(?:type=(?:config|commit|op|user-id|import|export)|action=(?:set|edit|delete|move|rename|clone|complete)|policy|rulebase|address|object)/iu.test(
          body
        )
      )
    ).toBe(false);
    expect(JSON.stringify(liveResult)).not.toContain("panorama-secret-key");

    const syncResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "palo-panorama",
        fixtureOutcome: "Blocked",
        logType: "threat",
        mockMode: true
      },
      integrationId: "ededed50-eded-4ede-8ede-ededededed50",
      mockMode: true,
      tenantId: "ededed60-eded-4ede-8ede-ededededed60"
    });

    expect(syncResult.assets[0]?.assetType).toBe("Service");
    expect(
      syncResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining(["FirewallLogObservation", "FirewallLogBlocked"])
    );

    const failedFetchMock = vi.fn(async () => {
      throw new Error("panorama unavailable");
    });
    vi.stubGlobal("fetch", failedFetchMock);

    const failedResult = await connector!.observeControl!({
      authType: "apiKey",
      config: {
        apiKey: "panorama-secret-key",
        baseUrl: "https://panorama.example.test",
        connectorKey: "palo-panorama"
      },
      integrationId: "ededed30-eded-4ede-8ede-ededededed30",
      mockMode: false,
      tenantId: "ededed40-eded-4ede-8ede-ededededed40"
    });

    expect(failedResult).toMatchObject({
      outcome: "NoEvidence",
      sourceType: "palo_alto_panorama.logs.observer"
    });
    expect(failedResult.detail).toContain("panorama unavailable");
    expect(JSON.stringify(failedResult)).not.toContain("panorama-secret-key");
  });

  it("exposes Fortinet FortiGate read-only firewall policy observation verdicts", async () => {
    const connector = getConnectorByKey("fortinet-fortigate");

    expect(connector?.observeControl).toBeDefined();
    expect(connector!.manifest.marketplaceCategory).toBe("WAF/Firewall");
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "apiToken"]));

    const result = await connector!.observeControl!({
      authType: "mock",
      config: {
        connectorKey: "fortinet-fortigate",
        fixtureOutcome: "Blocked",
        mockMode: true
      },
      integrationId: "fefeef10-fefe-4efe-8efe-fefeefefe010",
      mockMode: true,
      tenantId: "fefeef20-fefe-4efe-8efe-fefeefefe020"
    });

    expect(result).toMatchObject({
      outcome: "Blocked",
      sourceType: "fortinet_fortigate.firewall_policy.observer"
    });

    const requestUrls: string[] = [];
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input));

        requestUrls.push(String(input));
        expect(init?.method).toBe("GET");
        expect(init?.headers).toMatchObject({
          authorization: "Bearer fortigate-secret-token"
        });
        expect(url.searchParams.get("access_token")).toBeNull();
        expect(url.searchParams.get("vdom")).toBe("root");

        if (url.pathname === "/api/v2/monitor/firewall/security-policy") {
          expect(url.searchParams.get("count")).toBe("5");

          return new Response(
            JSON.stringify({
              http_method: "GET",
              name: "security-policy",
              path: "firewall",
              results: [
                {
                  action: "deny",
                  bytes: 4096,
                  hit_count: 42,
                  name: "Periscan deny validation",
                  policyid: 7,
                  uuid: "fortigate-live-policy"
                }
              ],
              status: "success"
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        return new Response(
          JSON.stringify({
            results: {
              build: 2573,
              hostname: "fortigate-live",
              serial: "FGT123456789",
              version: "v7.4.6"
            },
            status: "success"
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.observeControl!({
      authType: "apiToken",
      config: {
        apiToken: "fortigate-secret-token",
        baseUrl: "https://fortigate.example.test",
        connectorKey: "fortinet-fortigate",
        limit: 5,
        vdom: "root"
      },
      integrationId: "fefeef30-fefe-4efe-8efe-fefeefefe030",
      mockMode: false,
      tenantId: "fefeef40-fefe-4efe-8efe-fefeefefe040"
    });

    expect(liveResult).toMatchObject({
      outcome: "Blocked",
      sourceType: "fortinet_fortigate.firewall_policy.observer"
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      requestUrls.some((url) =>
        /(?:\/api\/v2\/cmdb|\/close|\/update|\/set|\/edit|\/delete|\/import|\/export|\/cli|\/config|\/session\/close|address-fabric)/iu.test(
          url
        )
      )
    ).toBe(false);
    expect(JSON.stringify(liveResult)).not.toContain("fortigate-secret-token");

    const syncResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "fortinet-fortigate",
        fixtureOutcome: "Blocked",
        mockMode: true
      },
      integrationId: "fefeef50-fefe-4efe-8efe-fefeefefe050",
      mockMode: true,
      tenantId: "fefeef60-fefe-4efe-8efe-fefeefefe060"
    });

    expect(syncResult.assets[0]?.assetType).toBe("Service");
    expect(
      syncResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "FirewallSystemStatusObservation",
        "FirewallPolicyBlocking"
      ])
    );

    const failedFetchMock = vi.fn(async () => {
      throw new Error("fortigate unavailable");
    });
    vi.stubGlobal("fetch", failedFetchMock);

    const failedResult = await connector!.observeControl!({
      authType: "apiToken",
      config: {
        apiToken: "fortigate-secret-token",
        baseUrl: "https://fortigate.example.test",
        connectorKey: "fortinet-fortigate"
      },
      integrationId: "fefeef30-fefe-4efe-8efe-fefeefefe030",
      mockMode: false,
      tenantId: "fefeef40-fefe-4efe-8efe-fefeefefe040"
    });

    expect(failedResult).toMatchObject({
      outcome: "NoEvidence",
      sourceType: "fortinet_fortigate.firewall_policy.observer"
    });
    expect(failedResult.detail).toContain("fortigate unavailable");
    expect(JSON.stringify(failedResult)).not.toContain(
      "fortigate-secret-token"
    );
  });

  it("exposes Zscaler ZIA read-only firewall filtering policy observation verdicts", async () => {
    const connector = getConnectorByKey("zscaler-zia");

    expect(connector?.observeControl).toBeDefined();
    expect(connector!.manifest.marketplaceCategory).toBe("WAF/Firewall");
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "oauth2ClientCredentials"]));

    const result = await connector!.observeControl!({
      authType: "mock",
      config: {
        connectorKey: "zscaler-zia",
        fixtureOutcome: "Blocked",
        mockMode: true
      },
      integrationId: "efefef10-efef-4efe-8efe-efefefefef10",
      mockMode: true,
      tenantId: "efefef20-efef-4efe-8efe-efefefefef20"
    });

    expect(result).toMatchObject({
      outcome: "Blocked",
      sourceType: "zscaler_zia.firewall_filtering_rules.observer"
    });

    const requestUrls: string[] = [];
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input));

        requestUrls.push(String(input));

        if (url.pathname === "/oauth2/token") {
          const body = init?.body as URLSearchParams;

          expect(init?.method).toBe("POST");
          expect(body.get("grant_type")).toBe("client_credentials");
          expect(body.get("client_id")).toBe("zia-client-id");
          expect(body.get("client_secret")).toBe("zia-client-secret");
          expect(body.get("scope")).toBe("zia.firewall.read");

          return new Response(
            JSON.stringify({
              access_token: "zia-access-token",
              expires_in: 3600,
              token_type: "Bearer"
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        expect(init?.method).toBe("GET");
        expect(init?.headers).toMatchObject({
          authorization: "Bearer zia-access-token"
        });

        if (url.pathname === "/zia/api/v1/firewallFilteringRules") {
          expect(url.searchParams.get("page")).toBe("1");
          expect(url.searchParams.get("pageSize")).toBe("5");

          return new Response(
            JSON.stringify([
              {
                action: "BLOCK_DROP",
                id: 1000,
                name: "Periscan block validation",
                order: 1,
                rank: 1
              }
            ]),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        return new Response(JSON.stringify({ count: 1 }), {
          headers: {
            "content-type": "application/json"
          },
          status: 200
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.observeControl!({
      authType: "oauth2ClientCredentials",
      config: {
        apiBaseUrl: "https://api.zscaler.example.test/zia/api/v1",
        clientId: "zia-client-id",
        clientSecret: "zia-client-secret",
        connectorKey: "zscaler-zia",
        pageSize: 5,
        scope: "zia.firewall.read",
        tokenUrl: "https://identity.zscaler.example.test/oauth2/token"
      },
      integrationId: "efefef30-efef-4efe-8efe-efefefefef30",
      mockMode: false,
      tenantId: "efefef40-efef-4efe-8efe-efefefefef40"
    });

    expect(liveResult).toMatchObject({
      outcome: "Blocked",
      sourceType: "zscaler_zia.firewall_filtering_rules.observer"
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      requestUrls.some((url) =>
        /(?:method=(?:post|put|delete)|\/activate|\/exportPolicies|\/urlLookup|\/zscsb\/submit|\/firewallFilteringRules\/\d+|\/firewallDnsRules|\/firewallIpsRules|\/dnatRules|\/forwardingRules|\/vpnCredentials|\/pacFiles)/iu.test(
          url
        )
      )
    ).toBe(false);
    expect(JSON.stringify(liveResult)).not.toContain("zia-client-secret");
    expect(JSON.stringify(liveResult)).not.toContain("zia-access-token");

    const syncResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: "zscaler-zia",
        fixtureOutcome: "Blocked",
        mockMode: true
      },
      integrationId: "efefef50-efef-4efe-8efe-efefefefef50",
      mockMode: true,
      tenantId: "efefef60-efef-4efe-8efe-efefefefef60"
    });

    expect(syncResult.assets[0]?.assetType).toBe("Service");
    expect(
      syncResult.signals.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining([
        "FirewallFilteringRuleCount",
        "FirewallFilteringRuleBlocking"
      ])
    );

    const failedFetchMock = vi.fn(async () => {
      throw new Error("zia unavailable");
    });
    vi.stubGlobal("fetch", failedFetchMock);

    const failedResult = await connector!.observeControl!({
      authType: "oauth2ClientCredentials",
      config: {
        apiBaseUrl: "https://api.zscaler.example.test/zia/api/v1",
        clientId: "zia-client-id",
        clientSecret: "zia-client-secret",
        connectorKey: "zscaler-zia",
        tokenUrl: "https://identity.zscaler.example.test/oauth2/token"
      },
      integrationId: "efefef30-efef-4efe-8efe-efefefefef30",
      mockMode: false,
      tenantId: "efefef40-efef-4efe-8efe-efefefefef40"
    });

    expect(failedResult).toMatchObject({
      outcome: "NoEvidence",
      sourceType: "zscaler_zia.firewall_filtering_rules.observer"
    });
    expect(failedResult.detail).toContain("zia unavailable");
    expect(JSON.stringify(failedResult)).not.toContain("zia-client-secret");
  });

  it("exposes Microsoft Sentinel read-only control observation verdicts", async () => {
    const connector = getConnectorByKey("microsoft-sentinel");

    expect(connector?.observeControl).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "oauth2ClientCredentials"]));

    const result = await connector!.observeControl!({
      authType: "mock",
      config: {
        connectorKey: "microsoft-sentinel",
        fixtureOutcome: "Alerted",
        mockMode: true
      },
      integrationId: "8a8a8a8a-8a8a-48a8-88a8-8a8a8a8a8a8a",
      mockMode: true,
      tenantId: "8b8b8b8b-8b8b-48b8-88b8-8b8b8b8b8b8b"
    });

    expect(result).toMatchObject({
      outcome: "Alerted",
      sourceType: "microsoft_sentinel.log_analytics.observer"
    });

    const fetchMock = vi.fn(
      async (input: string | URL | Request, _init?: RequestInit) => {
        void _init;

        const url = String(input);

        if (url.includes("/oauth2/v2.0/token")) {
          return new Response(
            JSON.stringify({
              access_token: "sentinel-access-token"
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        return new Response(
          JSON.stringify({
            tables: [
              {
                columns: [{ name: "EventText", type: "string" }],
                rows: [["Periscan validation event technique=T1059 logged"]]
              }
            ]
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.observeControl!({
      authType: "oauth2ClientCredentials",
      config: {
        clientId: "sentinel-client-id",
        clientSecret: "sentinel-secret-value",
        connectorKey: "microsoft-sentinel",
        techniqueId: "T1059",
        tenantId: "tenant-123",
        workspaceId: "workspace-456"
      },
      integrationId: "8c8c8c8c-8c8c-48c8-88c8-8c8c8c8c8c8c",
      mockMode: false,
      tenantId: "8d8d8d8d-8d8d-48d8-88d8-8d8d8d8d8d8d"
    });

    expect(liveResult).toMatchObject({
      outcome: "Logged",
      sourceType: "microsoft_sentinel.log_analytics.observer"
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://login.microsoftonline.com/tenant-123/oauth2/v2.0/token",
      expect.objectContaining({
        method: "POST"
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.loganalytics.io/v1/workspaces/workspace-456/query",
      expect.objectContaining({
        method: "POST"
      })
    );

    const queryRequest = fetchMock.mock.calls[1]?.[1];

    expect(queryRequest).toBeDefined();
    expect(
      (queryRequest!.headers as Record<string, string>).authorization
    ).toBe("Bearer sentinel-access-token");
    expect(String(queryRequest!.body)).toContain("T1059");
    expect(JSON.stringify(liveResult)).not.toContain("sentinel-secret-value");

    const failedFetchMock = vi.fn(async () => {
      throw new Error("sentinel unavailable");
    });
    vi.stubGlobal("fetch", failedFetchMock);

    const failedResult = await connector!.observeControl!({
      authType: "oauth2ClientCredentials",
      config: {
        clientId: "sentinel-client-id",
        clientSecret: "sentinel-secret-value",
        connectorKey: "microsoft-sentinel",
        tenantId: "tenant-123",
        workspaceId: "workspace-456"
      },
      integrationId: "8c8c8c8c-8c8c-48c8-88c8-8c8c8c8c8c8c",
      mockMode: false,
      tenantId: "8d8d8d8d-8d8d-48d8-88d8-8d8d8d8d8d8d"
    });

    expect(failedResult).toMatchObject({
      outcome: "NoEvidence",
      sourceType: "microsoft_sentinel.log_analytics.observer"
    });
    expect(failedResult.detail).toContain("sentinel unavailable");
    expect(JSON.stringify(failedResult)).not.toContain("sentinel-secret-value");
  });

  it("exposes mock CrowdStrike control observation verdicts", async () => {
    const connector = getConnectorByKey("crowdstrike");

    expect(connector?.observeControl).toBeDefined();
    expect(
      connector!.manifest.authMethods.map((authMethod) => authMethod.kind)
    ).toEqual(expect.arrayContaining(["mock", "oauth2ClientCredentials"]));

    const result = await connector!.observeControl!({
      authType: "mock",
      config: {
        connectorKey: "crowdstrike",
        fixtureOutcome: "Blocked",
        mockMode: true
      },
      integrationId: "99999999-9999-4999-8999-999999999999",
      mockMode: true,
      tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    });

    expect(result).toMatchObject({
      outcome: "Blocked",
      sourceType: "crowdstrike.falcon.observer"
    });

    const fetchMock = vi.fn(
      async (input: string | URL | Request, _init?: RequestInit) => {
        void _init;

        const url = String(input);

        if (url.endsWith("/oauth2/token")) {
          return new Response(
            JSON.stringify({
              access_token: "falcon-access-token"
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        if (url.includes("/detects/queries/detects/v1")) {
          return new Response(
            JSON.stringify({
              meta: {
                pagination: {
                  total: 1
                }
              },
              resources: ["ldt:123"]
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          );
        }

        return new Response(
          JSON.stringify({
            resources: [
              {
                behavior: {
                  technique_id: "T1059"
                },
                pattern_disposition: "prevented"
              }
            ]
          }),
          {
            headers: {
              "content-type": "application/json"
            },
            status: 200
          }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const liveResult = await connector!.observeControl!({
      authType: "oauth2ClientCredentials",
      config: {
        baseUrl: "https://api.us-2.crowdstrike.com",
        clientId: "falcon-client-id",
        clientSecret: "falcon-secret",
        connectorKey: "crowdstrike",
        techniqueId: "T1059"
      },
      integrationId: "99999999-9999-4999-8999-999999999999",
      mockMode: false,
      tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    });

    expect(liveResult).toMatchObject({
      outcome: "Blocked",
      sourceType: "crowdstrike.falcon.observer"
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.us-2.crowdstrike.com/oauth2/token"
    );
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(
      "/detects/queries/detects/v1"
    );
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("T1059");
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      "https://api.us-2.crowdstrike.com/detects/entities/summaries/GET/v1"
    );
    expect(JSON.stringify(fetchMock.mock.calls[1]?.[1])).not.toContain(
      "falcon-secret"
    );
    expect(JSON.stringify(liveResult)).not.toContain("falcon-secret");

    const failedFetchMock = vi.fn(async () => {
      throw new Error("falcon unavailable");
    });
    vi.stubGlobal("fetch", failedFetchMock);

    const failedResult = await connector!.observeControl!({
      authType: "oauth2ClientCredentials",
      config: {
        baseUrl: "https://api.us-2.crowdstrike.com",
        clientId: "falcon-client-id",
        clientSecret: "falcon-secret",
        connectorKey: "crowdstrike"
      },
      integrationId: "99999999-9999-4999-8999-999999999999",
      mockMode: false,
      tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    });

    expect(failedResult).toMatchObject({
      outcome: "Missed",
      sourceType: "crowdstrike.falcon.observer"
    });
    expect(failedResult.detail).toContain("falcon unavailable");
    expect(JSON.stringify(failedResult)).not.toContain("falcon-secret");
  });

  // Squad Zeta deep native baseline test: fabric ingest stub + manifest declaration
  // for "Validate from external finding" on CrowdStrike (PRD 3.12).
  it("exposes deep native fabric ingest for external finding seeds (CrowdStrike adapter)", async () => {
    const connector = getConnectorByKey("crowdstrike");
    expect(connector?.ingestExternalFinding).toBeDefined();
    expect(connector!.manifest.fabricIngestCapabilities ?? []).toEqual(
      expect.arrayContaining([
        "ValidateFromExternalFinding",
        "PillarValidationSeeding",
        "NoiseReductionCorrelation"
      ])
    );
    expect(connector!.manifest.validationCapabilities).toContain(
      "ValidateFromExternalFinding"
    );

    const seeds = await connector!.ingestExternalFinding!(
      {
        authType: "mock",
        config: { connectorKey: "crowdstrike", mockMode: true },
        integrationId: "99999999-9999-4999-8999-999999999999",
        mockMode: true,
        tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
      },
      {
        externalId: "cs-detect-123",
        severity: "high",
        relatedAssetHints: ["host-01.example"],
        techniqueIds: ["T1059"]
      }
    );

    expect(seeds.length).toBeGreaterThan(0);
    expect(seeds[0]!.sourceType).toContain("fabric.ingest");
    expect(seeds[0]!.signalCategory).toBe("ControlObservation");
    // Seeds ready for evidence graph pillar validation (no raw external dump)
    expect(JSON.stringify(seeds)).not.toContain("cs-detect-123"); // redacted/normalized
  });
  it("registers the market-leader connector buildout with unique, valid manifests", async () => {
    const catalog = getConnectorCatalog();
    const keys = catalog.map((manifest) => manifest.connectorKey);

    // No duplicate connector keys across the whole catalog.
    expect(new Set(keys).size).toBe(keys.length);

    // Representative leaders from each gap category are present.
    expect(keys).toEqual(
      expect.arrayContaining([
        "darktrace",
        "vectra-ai",
        "palo-cortex-xsoar",
        "splunk-soar",
        "tines",
        "netskope",
        "cisco-umbrella",
        "cybereason",
        "exabeam",
        "check-point",
        "snyk",
        "checkmarx",
        "veracode",
        "aqua-security",
        "sysdig",
        "sailpoint",
        "beyondtrust",
        "jamf",
        "microsoft-intune",
        "censys",
        "shodan",
        "anomali",
        "varonis",
        "hashicorp-vault",
        "xm-cyber",
        "cymulate",
        "pentera",
        "claroty",
        "nozomi-networks",
        "vanta",
        "hackerone",
        "teleport",
        "traceable",
        "panther",
        "rubrik",
        "nucleus-security",
        "venafi",
        "zimperium",
        "microsoft-defender-easm",
        "swimlane",
        "eset",
        "invicti",
        "omada",
        "ivanti-neurons",
        "druva",
        "zscaler-zpa",
        "cybersixgill",
        "cycognito",
        "keyfactor",
        "obsidian-security",
        "appomni",
        "valence-security",
        "salt-security",
        "noname-security",
        "42crunch",
        "island",
        "talon",
        "apiiro",
        "cycode",
        "endor-labs",
        "bigid",
        "sentra",
        "dig-security",
        "tenable-cloud-security",
        "stream-security",
        "sublime-security",
        "material-security",
        "cisco-secure-email-threat-defense",
        "detectify",
        "ionix",
        "securityscorecard",
        "bitsight"
      ])
    );

    // Catalog coverage remains mock-testable but cannot accept customer setup
    // before a vendor-specific live client and certification land.
    for (const key of ["darktrace", "sailpoint", "hashicorp-vault"]) {
      const manifest = catalog.find((entry) => entry.connectorKey === key);
      expect(manifest?.mockSupported).toBe(true);
      expect(manifest?.availability).toBe("Planned");
      expect(manifest?.connectable).toBe(false);
      expect(manifest?.executionReadiness).toBe("NotConnectable");
      expect(
        manifest?.authMethods.some((method) => method.kind === "mock")
      ).toBe(true);
    }

    // Mock observe + sync work for an observer connector.
    const darktrace = getConnectorByKey("darktrace");
    const context = {
      authType: "mock",
      config: { connectorKey: "darktrace" },
      integrationId: "11111111-1111-4111-8111-111111111111",
      mockMode: true,
      tenantId: "22222222-2222-4222-8222-222222222222"
    };
    const observed = await darktrace?.observeControl?.(context);
    expect(observed?.outcome).toBe("Detected");
    const synced = await darktrace?.sync(context);
    expect(synced?.signals.length).toBeGreaterThan(0);
    expect(synced?.signals[0]?.sourceVendor).toBe("Darktrace");

    // Mock sync works for a signal connector and never leaks config.
    const snyk = getConnectorByKey("snyk");
    const snykSync = await snyk?.sync({
      ...context,
      config: { connectorKey: "snyk" }
    });
    expect(snykSync?.signals[0]?.signalCategory).toBe("Exposure");
  });
});
