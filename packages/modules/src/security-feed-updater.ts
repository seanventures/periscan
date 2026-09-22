import { createHash } from "node:crypto";

import {
  OpenSourceToolIdSchema,
  applySecurityFeedYaml,
  checkSecurityFeeds,
  listPinnedCalderaAbilities,
  listSecurityFeeds,
  type SecurityFeed,
  type SecurityFeedCheckResult,
  type SecurityFeedObservation
} from "@periscan/shared";

import { ATOMIC_HOSTNAME_LAB } from "./bas-local-lab.js";
import { getOpenSourceToolDefinition } from "./toolchain.js";

/**
 * Worker helper around the shared security-feed registry.
 * Binds pins to toolchain / Atomic SHA / Caldera ability hashes.
 * Checks do not mutate executable pins or evaluate YAML.
 */

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function overlayToolchainPin(feed: SecurityFeed): SecurityFeed {
  if (
    !feed.toolId ||
    feed.pin.kind === "unpinned" ||
    feed.id === "atomic-yaml"
  ) {
    return feed;
  }
  const toolId = OpenSourceToolIdSchema.safeParse(feed.toolId);
  if (!toolId.success) {
    return feed;
  }
  const tool = getOpenSourceToolDefinition(toolId.data);
  if (!tool?.defaultVersion) {
    return feed;
  }
  return {
    ...feed,
    pin: {
      kind: feed.pin.kind,
      value: tool.defaultVersion
    }
  };
}

function overlayAtomicPin(feed: SecurityFeed): SecurityFeed {
  if (feed.id !== "atomic-yaml") {
    return feed;
  }
  return {
    ...feed,
    lastDigest: ATOMIC_HOSTNAME_LAB.contentSha256,
    pin: {
      kind: "sha",
      value: ATOMIC_HOSTNAME_LAB.sourceRevision
    }
  };
}

function overlayCalderaAbilityDigest(feed: SecurityFeed): SecurityFeed {
  if (feed.id !== "caldera-abilities") {
    return feed;
  }
  const digest = sha256(
    listPinnedCalderaAbilities()
      .map((ability) => ability.abilityId)
      .sort()
      .join(",")
  );
  return {
    ...feed,
    lastDigest: digest
  };
}

export function listToolchainBoundSecurityFeeds(): SecurityFeed[] {
  return listSecurityFeeds()
    .map(overlayToolchainPin)
    .map(overlayAtomicPin)
    .map(overlayCalderaAbilityDigest);
}

export function checkManagedSecurityFeeds(input: {
  byFeedId?: Record<string, Omit<SecurityFeedObservation, "checkedAt">>;
  checkedAt: string;
  yamlAttempts?: Record<string, string>;
}): SecurityFeedCheckResult[] {
  const feeds = listToolchainBoundSecurityFeeds();
  const byFeedId = { ...(input.byFeedId ?? {}) };
  if (input.yamlAttempts) {
    for (const [feedId, yaml] of Object.entries(input.yamlAttempts)) {
      byFeedId[feedId] = {
        ...(byFeedId[feedId] ?? {}),
        yaml
      };
      const feed = feeds.find((item) => item.id === feedId);
      if (feed) {
        applySecurityFeedYaml({ feed, yaml });
      }
    }
  }
  return checkSecurityFeeds(feeds, {
    byFeedId,
    checkedAt: input.checkedAt
  });
}
