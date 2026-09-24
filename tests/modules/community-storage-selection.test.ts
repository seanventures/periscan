import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const helper = join(repoRoot, "infra/lab/scripts/env.sh");

function select(root: string) {
  return execFileSync(
    "bash",
    ["-c", 'source "$1"; lab_community_deps_compose_file "$2"', "bash", helper, root],
    {
      encoding: "utf8",
      env: { ...process.env, PERISCAN_DEPS_COMPOSE_FILE: "" }
    }
  ).trim();
}

describe("Community storage selection", () => {
  it("uses isolated SeaweedFS for new installs and keeps old MinIO installs on their volume", () => {
    const root = mkdtempSync(join(tmpdir(), "periscan-storage-selection-"));
    try {
      expect(select(root)).toBe("infra/docker-compose/docker-compose.community-deps.yml");
      mkdirSync(join(root, ".periscan"));
      writeFileSync(join(root, ".periscan/community.env"), "DATABASE_URL=existing\n");
      expect(select(root)).toBe("infra/docker-compose/docker-compose.yml");
      writeFileSync(
        join(root, ".periscan/community.env"),
        "PERISCAN_DEPS_COMPOSE_FILE=infra/docker-compose/docker-compose.community-deps.yml\n"
      );
      expect(select(root)).toBe("infra/docker-compose/docker-compose.community-deps.yml");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reuses a saved collision-safe Compose project after the neighbor is gone", () => {
    const root = mkdtempSync(join(tmpdir(), "periscan-compose-project-"));
    try {
      mkdirSync(join(root, "infra", "docker-compose"), { recursive: true });
      const composeFile = join(
        root,
        "infra/docker-compose/docker-compose.community-deps.yml"
      );
      writeFileSync(composeFile, "name: periscan-community-deps\n");
      mkdirSync(join(root, ".periscan"));
      writeFileSync(
        join(root, ".periscan/community.env"),
        "COMPOSE_PROJECT_NAME=periscan-community-deps-12345\n"
      );
      const selected = execFileSync(
        "bash",
        [
          "-c",
          'source "$1"; lab_choose_clone_compose_project "$2"; printf "%s" "$COMPOSE_PROJECT_NAME"',
          "bash",
          helper,
          composeFile
        ],
        {
          encoding: "utf8",
          env: { ...process.env, COMPOSE_PROJECT_NAME: "" }
        }
      );
      expect(selected).toBe("periscan-community-deps-12345");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
