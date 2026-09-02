import type {
  OpenSourceToolDefinition,
  ToolUpstreamSourceKind
} from "@periscan/shared";

import { getOpenSourceToolEnvPrefix } from "./toolchain.js";

type JsonFetchResponse = {
  json(): Promise<unknown>;
  ok: boolean;
  status: number;
};

type JsonFetcher = (
  url: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal }
) => Promise<JsonFetchResponse>;

export type TrustedUpstreamVersionDiscovery = {
  discoveredVersion: string | null;
  error: string | null;
  metadata: Record<string, unknown>;
  sourceKind: ToolUpstreamSourceKind;
  sourceUrl: string | null;
};

type DiscoveryOptions = {
  env?: NodeJS.ProcessEnv;
  fetcher?: JsonFetcher;
  timeoutMs?: number;
};

function sanitizeVersion(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function githubRepoParts(gitRepo: string | null | undefined) {
  if (!gitRepo) {
    return null;
  }

  const match = gitRepo.match(
    /^https:\/\/github\.com\/([^/\s]+)\/([^/\s.]+)(?:\.git)?$/i
  );
  if (!match) {
    return null;
  }

  return {
    owner: match[1],
    repo: match[2]
  };
}

async function fetchJson(fetcher: JsonFetcher, url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetcher(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "periscan-tool-upstream-check"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      return {
        body: null,
        error: `Upstream returned HTTP ${response.status}.`
      };
    }

    return {
      body: await response.json(),
      error: null
    };
  } catch (error) {
    return {
      body: null,
      error:
        error instanceof Error
          ? error.message
          : "Unable to read trusted upstream metadata."
    };
  } finally {
    clearTimeout(timeout);
  }
}

function versionFromNpm(body: unknown) {
  if (
    body &&
    typeof body === "object" &&
    "version" in body &&
    typeof (body as { version: unknown }).version === "string"
  ) {
    return sanitizeVersion((body as { version: string }).version);
  }

  return null;
}

function versionFromPypi(body: unknown) {
  if (
    body &&
    typeof body === "object" &&
    "info" in body &&
    (body as { info: unknown }).info &&
    typeof (body as { info: unknown }).info === "object" &&
    "version" in ((body as { info: object }).info as Record<string, unknown>)
  ) {
    return sanitizeVersion(
      ((body as { info: Record<string, unknown> }).info as { version: unknown })
        .version
    );
  }

  return null;
}

function versionFromGithubRelease(body: unknown) {
  if (
    body &&
    typeof body === "object" &&
    "tag_name" in body &&
    typeof (body as { tag_name: unknown }).tag_name === "string"
  ) {
    return sanitizeVersion((body as { tag_name: string }).tag_name);
  }

  return null;
}

function versionFromGithubTags(body: unknown) {
  if (!Array.isArray(body) || !body.length) {
    return null;
  }

  const first = body[0];
  if (
    first &&
    typeof first === "object" &&
    "name" in first &&
    typeof (first as { name: unknown }).name === "string"
  ) {
    return sanitizeVersion((first as { name: string }).name);
  }

  return null;
}

export async function discoverTrustedUpstreamToolVersion(
  tool: OpenSourceToolDefinition,
  options: DiscoveryOptions = {}
): Promise<TrustedUpstreamVersionDiscovery> {
  const env = options.env ?? process.env;
  const timeoutMs = options.timeoutMs ?? 5000;
  const envPrefix = getOpenSourceToolEnvPrefix(tool.toolId);
  const configuredVersion = sanitizeVersion(
    env[`${envPrefix}_UPSTREAM_VERSION`]
  );

  if (configuredVersion) {
    return {
      discoveredVersion: configuredVersion,
      error: null,
      metadata: {
        configured: true
      },
      sourceKind: "ConfiguredOverride",
      sourceUrl: null
    };
  }

  const fetcher = options.fetcher ?? globalThis.fetch;
  if (!fetcher) {
    return {
      discoveredVersion: null,
      error: "No fetch implementation is available for upstream checks.",
      metadata: {},
      sourceKind: "CatalogOnly",
      sourceUrl: null
    };
  }

  if (tool.npmPackage) {
    const sourceUrl = `https://registry.npmjs.org/${encodeURIComponent(
      tool.npmPackage
    )}/latest`;
    const { body, error } = await fetchJson(fetcher, sourceUrl, timeoutMs);

    return {
      discoveredVersion: error ? null : versionFromNpm(body),
      error,
      metadata: {
        packageName: tool.npmPackage
      },
      sourceKind: "NpmRegistry",
      sourceUrl
    };
  }

  if (tool.pipPackage) {
    const sourceUrl = `https://pypi.org/pypi/${encodeURIComponent(
      tool.pipPackage
    )}/json`;
    const { body, error } = await fetchJson(fetcher, sourceUrl, timeoutMs);

    return {
      discoveredVersion: error ? null : versionFromPypi(body),
      error,
      metadata: {
        packageName: tool.pipPackage
      },
      sourceKind: "PypiRegistry",
      sourceUrl
    };
  }

  const github = githubRepoParts(tool.gitRepo);
  if (github) {
    const releaseUrl = `https://api.github.com/repos/${github.owner}/${github.repo}/releases/latest`;
    const release = await fetchJson(fetcher, releaseUrl, timeoutMs);
    if (!release.error) {
      return {
        discoveredVersion: versionFromGithubRelease(release.body),
        error: null,
        metadata: github,
        sourceKind: "GitHubRelease",
        sourceUrl: `https://github.com/${github.owner}/${github.repo}/releases/latest`
      };
    }

    const tagsUrl = `https://api.github.com/repos/${github.owner}/${github.repo}/tags?per_page=1`;
    const tags = await fetchJson(fetcher, tagsUrl, timeoutMs);
    return {
      discoveredVersion: tags.error ? null : versionFromGithubTags(tags.body),
      error: tags.error ?? release.error,
      metadata: github,
      sourceKind: "GitHubTag",
      sourceUrl: `https://github.com/${github.owner}/${github.repo}/tags`
    };
  }

  return {
    discoveredVersion: tool.defaultVersion,
    error: "No trusted upstream metadata source is configured for this tool.",
    metadata: {},
    sourceKind: "CatalogOnly",
    sourceUrl: null
  };
}

export function normalizeToolVersionForComparison(version: string) {
  return version
    .trim()
    .replace(/^refs\/tags\//i, "")
    .replace(/^v(?=\d)/i, "")
    .toLowerCase();
}

export function compareToolVersions(candidate: string, current: string) {
  const left = normalizeToolVersionForComparison(candidate);
  const right = normalizeToolVersionForComparison(current);
  const leftParts = left.split(".").map((part) => Number(part));
  const rightParts = right.split(".").map((part) => Number(part));
  const numeric =
    leftParts.length > 0 &&
    rightParts.length > 0 &&
    leftParts.every(Number.isFinite) &&
    rightParts.every(Number.isFinite);

  if (!numeric) {
    return left.localeCompare(right);
  }

  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;

    if (leftPart > rightPart) {
      return 1;
    }
    if (leftPart < rightPart) {
      return -1;
    }
  }

  return 0;
}
