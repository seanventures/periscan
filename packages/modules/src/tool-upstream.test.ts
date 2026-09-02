import { describe, expect, it } from "vitest";

import type { OpenSourceToolDefinition } from "@periscan/shared";

import {
  compareToolVersions,
  discoverTrustedUpstreamToolVersion
} from "./tool-upstream.js";

const baseTool: OpenSourceToolDefinition = {
  binaryName: "scanner",
  category: "Dependency",
  defaultVersion: "v1.2.3",
  displayName: "Scanner",
  dockerImage: "ghcr.io/example/scanner",
  docsUrl: "https://github.com/example/scanner",
  gitRepo: "https://github.com/example/scanner.git",
  license: "MIT",
  moduleIds: ["scanner.safe_scan"],
  notes: "Fixture scanner.",
  npmPackage: null,
  phase: "Current",
  pipPackage: null,
  policyStatus: "Enabled",
  runtimePreference: ["docker"],
  toolId: "gitleaks"
};

function jsonResponse(body: unknown, status = 200) {
  return {
    async json() {
      return body;
    },
    ok: status >= 200 && status < 300,
    status
  };
}

describe("trusted upstream tool version discovery", () => {
  it("uses platform configured upstream versions before network sources", async () => {
    const result = await discoverTrustedUpstreamToolVersion(baseTool, {
      env: {
        PERISCAN_GITLEAKS_UPSTREAM_VERSION: "v1.2.4"
      }
    });

    expect(result).toEqual(
      expect.objectContaining({
        discoveredVersion: "v1.2.4",
        sourceKind: "ConfiguredOverride",
        sourceUrl: null
      })
    );
  });

  it("reads npm latest metadata for tools with npm packages", async () => {
    const result = await discoverTrustedUpstreamToolVersion(
      {
        ...baseTool,
        gitRepo: null,
        npmPackage: "promptfoo"
      },
      {
        env: {},
        fetcher: async (url) => {
          expect(url).toBe("https://registry.npmjs.org/promptfoo/latest");
          return jsonResponse({ version: "0.122.0" });
        }
      }
    );

    expect(result).toEqual(
      expect.objectContaining({
        discoveredVersion: "0.122.0",
        sourceKind: "NpmRegistry"
      })
    );
  });

  it("reads PyPI metadata for tools with Python packages", async () => {
    const result = await discoverTrustedUpstreamToolVersion(
      {
        ...baseTool,
        gitRepo: null,
        pipPackage: "pyrit"
      },
      {
        env: {},
        fetcher: async (url) => {
          expect(url).toBe("https://pypi.org/pypi/pyrit/json");
          return jsonResponse({ info: { version: "0.14.0" } });
        }
      }
    );

    expect(result).toEqual(
      expect.objectContaining({
        discoveredVersion: "0.14.0",
        sourceKind: "PypiRegistry"
      })
    );
  });

  it("uses GitHub releases and falls back to tags", async () => {
    const urls: string[] = [];
    const result = await discoverTrustedUpstreamToolVersion(baseTool, {
      env: {},
      fetcher: async (url) => {
        urls.push(url);
        if (url.endsWith("/releases/latest")) {
          return jsonResponse({ message: "not found" }, 404);
        }

        return jsonResponse([{ name: "v1.2.4" }]);
      }
    });

    expect(urls).toEqual([
      "https://api.github.com/repos/example/scanner/releases/latest",
      "https://api.github.com/repos/example/scanner/tags?per_page=1"
    ]);
    expect(result).toEqual(
      expect.objectContaining({
        discoveredVersion: "v1.2.4",
        sourceKind: "GitHubTag",
        sourceUrl: "https://github.com/example/scanner/tags"
      })
    );
  });

  it("compares numeric versions with optional v prefixes", () => {
    expect(compareToolVersions("v1.10.0", "1.9.9")).toBeGreaterThan(0);
    expect(compareToolVersions("v1.2.0", "1.2")).toBe(0);
    expect(compareToolVersions("v1.1.0", "1.2.0")).toBeLessThan(0);
  });
});
