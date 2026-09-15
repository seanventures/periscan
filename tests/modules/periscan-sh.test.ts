import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

function readRepo(relativePath: string) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}

function runPeriscan(args: string[], env: NodeJS.ProcessEnv = {}) {
  return spawnSync("bash", ["scripts/periscan.sh", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, ...env }
  });
}

describe("scripts/periscan.sh (PERISCAN-560)", { timeout: 20_000 }, () => {
  it("help lists subcommands", () => {
    const result = runPeriscan(["help"]);
    expect(result.status).toBe(0);
    const out = `${result.stdout}${result.stderr}`;
    for (const command of ["install", "start", "status", "update", "down", "help"]) {
      expect(out).toContain(command);
    }
  });

  it("dry-run install prints DATABASE_URL and COMPOSE=up without starting", () => {
    const result = runPeriscan(["install"], { PERISCAN_PERISCAN_SH_DRY_RUN: "1" });
    expect(result.status).toBe(0);
    const out = `${result.stdout}${result.stderr}`;
    expect(out).toMatch(/COMPOSE=up/);
    const pgMatch = out.match(/PERISCAN_POSTGRES_PUBLISHED_PORT=(\d+)/);
    expect(pgMatch).not.toBeNull();
    expect(out).toMatch(
      new RegExp(
        `DATABASE_URL=postgresql://periscan:periscan@127\\.0\\.0\\.1:${pgMatch![1]}/periscan`
      )
    );
    expect(out).not.toMatch(/skipping compose/i);
    expect(out).not.toMatch(/==> docker compose up/);
    expect(out).not.toMatch(/starting api \+ worker \+ web/);
    expect(out).not.toMatch(/pnpm --filter @periscan\/db db:migrate:deploy/);
  });

  it("unknown subcommand exits non-zero", () => {
    const result = runPeriscan(["definitely-not-a-command"]);
    expect(result.status).not.toBe(0);
    expect(result.status).not.toBeNull();
    const out = `${result.stdout}${result.stderr}`;
    expect(out).toMatch(/unknown/i);
  });

  it("Makefile and package.json community scripts exist", () => {
    const makefile = readRepo("Makefile");
    const pkg = JSON.parse(readRepo("package.json")) as {
      scripts?: Record<string, string>;
    };
    const scripts = pkg.scripts ?? {};

    for (const target of ["install", "start", "status", "update", "down"]) {
      expect(makefile).toMatch(new RegExp(`^${target}:`, "m"));
      expect(makefile).toContain(`scripts/periscan.sh ${target}`);
      expect(scripts[`community:${target}`]).toBe(
        `bash ./scripts/periscan.sh ${target}`
      );
    }
  });

  it("reuses first-hour, env.sh, and lab:dev and never tears down volumes", () => {
    const script = readRepo("scripts/periscan.sh");
    expect(script).toContain("set -euo pipefail");
    expect(script).toContain("scripts/community-first-hour.sh");
    expect(script).toContain("lab_select_deps_publish_ports");
    expect(script).toContain("infra/lab/scripts/control-plane-dev.sh");
    expect(script).toContain("infra/docker-compose/docker-compose.yml");
    expect(script).toContain("PERISCAN_PERISCAN_SH_DRY_RUN");
    expect(script).toContain("PERISCAN_FIRST_HOUR_DRY_RUN");
    expect(script).not.toMatch(/docker compose -f compose\.yaml/);
    expect(script).not.toMatch(/compose down -v/);
    expect(script).not.toMatch(/seed:demo/);
    expect(script).not.toMatch(/FLUSHDB/);
    expect(script).not.toMatch(/\bAtomic\b/);
  });

  it("dry-run start prints ports without starting lab:dev", () => {
    const result = runPeriscan(["start"], { PERISCAN_PERISCAN_SH_DRY_RUN: "1" });
    expect(result.status).toBe(0);
    const out = `${result.stdout}${result.stderr}`;
    expect(out).toMatch(/PERISCAN_API_PORT=\d+/);
    expect(out).toMatch(/API=http:\/\/127\.0\.0\.1:\d+/);
    expect(out).not.toMatch(/starting api \+ worker \+ web/);
  });

  it("dry-run update prints restart with start and skips git pull", () => {
    const result = runPeriscan(["update"], { PERISCAN_PERISCAN_SH_DRY_RUN: "1" });
    expect(result.status).toBe(0);
    const out = `${result.stdout}${result.stderr}`;
    expect(out).toMatch(/restart with start/);
    expect(out).toMatch(/DATABASE_URL=/);
    expect(out).not.toMatch(/==> git pull/);
    expect(out).not.toMatch(/==> pnpm install/);
    expect(out).not.toMatch(/==> docker compose up/);
  });
});
