import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  COMMUNITY_AS_CODE_EXAMPLE_FILENAME,
  COMMUNITY_AS_CODE_FILENAME,
  COMMUNITY_AS_CODE_RUNTIME_BINDING,
  CommunityAsCodeError,
  communityAsCodeIsRuntimeBound,
  parseCommunityAsCodeYaml
} from "./community-as-code.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

const VALID_COMMUNITY_AS_CODE = `
version: 1
kind: CommunityAsCode
pack: community
safety:
  ceiling: ActiveNonInvasive
  require_verified_scope: true
nuclei:
  second_mission: true
engines:
  atomic: false
`.trim();

function expectInvalid(source: string, pathOrMessage: RegExp) {
  try {
    parseCommunityAsCodeYaml(source);
    throw new Error("expected CommunityAsCodeError");
  } catch (error) {
    expect(error).toBeInstanceOf(CommunityAsCodeError);
    expect((error as CommunityAsCodeError).code).toBe(
      "community_as_code_invalid"
    );
    expect((error as CommunityAsCodeError).message).toMatch(pathOrMessage);
  }
}

describe("Community-as-code document", () => {
  it("accepts the Community pack with an ActiveNonInvasive ceiling, verified scope, no Atomic, and Nuclei as a second mission", () => {
    const doc = parseCommunityAsCodeYaml(VALID_COMMUNITY_AS_CODE);

    expect(doc.pack).toBe("community");
    expect(doc.safety.ceiling).toBe("ActiveNonInvasive");
    expect(doc.safety.require_verified_scope).toBe(true);
    expect(doc.nuclei.second_mission).toBe(true);
    expect(doc.engines.atomic).toBe(false);
  });

  it("parses the committed GitHub example as that same Community ceiling", () => {
    const source = readFileSync(
      join(REPO_ROOT, COMMUNITY_AS_CODE_EXAMPLE_FILENAME),
      "utf8"
    );
    const doc = parseCommunityAsCodeYaml(source);

    expect(doc.pack).toBe("community");
    expect(doc.safety.ceiling).toBe("ActiveNonInvasive");
    expect(doc.safety.require_verified_scope).toBe(true);
    expect(doc.safety.deny_never_queues).toBe(true);
    expect(doc.safety.live_offensive).toBe(false);
    expect(doc.nuclei.second_mission).toBe(true);
    expect(doc.nuclei.include_in_primary_start).toBe(false);
    expect(doc.engines.atomic).toBe(false);
    expect(doc.engines.caldera).toBe(false);
    expect(doc.engines.sharphound).toBe(false);
    expect(doc.engines.sqlmap).toBe(false);
    expect(doc.engines.metasploit).toBe(false);
    expect(source).toMatch(/does not load/i);
  });

  it("rejects pack values other than community, including atomic", () => {
    expectInvalid(
      VALID_COMMUNITY_AS_CODE.replace("pack: community", "pack: atomic"),
      /pack/i
    );
  });

  it("rejects a safety ceiling above ActiveNonInvasive", () => {
    expectInvalid(
      VALID_COMMUNITY_AS_CODE.replace(
        "ceiling: ActiveNonInvasive",
        "ceiling: BASLite"
      ),
      /ceiling/i
    );
    expectInvalid(
      VALID_COMMUNITY_AS_CODE.replace(
        "ceiling: ActiveNonInvasive",
        "ceiling: AdvancedAdversarial"
      ),
      /ceiling/i
    );
  });

  it("rejects documents that do not require verified scope", () => {
    expectInvalid(
      VALID_COMMUNITY_AS_CODE.replace(
        "require_verified_scope: true",
        "require_verified_scope: false"
      ),
      /require_verified_scope/
    );
  });

  it("rejects Nuclei in the primary start set", () => {
    expectInvalid(
      VALID_COMMUNITY_AS_CODE.replace(
        "second_mission: true",
        "second_mission: false"
      ),
      /second_mission/
    );
  });

  it("rejects Atomic enabled as a Community engine", () => {
    expectInvalid(
      VALID_COMMUNITY_AS_CODE.replace("atomic: false", "atomic: true"),
      /atomic/
    );
  });

  it("is intent-only: the control plane does not load the overlay file", () => {
    expect(COMMUNITY_AS_CODE_FILENAME).toBe(".periscan.yaml");
    expect(COMMUNITY_AS_CODE_RUNTIME_BINDING).toBe("intent_only");
    expect(communityAsCodeIsRuntimeBound()).toBe(false);
  });

  it("documents that runtime still uses API and policy, Apache-2.0, not full BAS", () => {
    const docs = readFileSync(join(REPO_ROOT, "docs/PERISCAN_YAML.md"), "utf8");
    expect(docs).toMatch(/does not load/i);
    expect(docs).toMatch(/\/api\/v1\/community\/validation-runs/);
    expect(docs).toMatch(/policy/i);
    expect(docs).toMatch(/Apache-2\.0/i);
    expect(docs).toMatch(/not full BAS/i);
    expect(docs).toContain(COMMUNITY_AS_CODE_EXAMPLE_FILENAME);
  });
});
