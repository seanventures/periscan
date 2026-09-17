import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import net from "node:net";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

const heldServers: net.Server[] = [];

function holdListenPort(port = 0): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(port, "0.0.0.0", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("listen did not bind a TCP port"));
        return;
      }
      heldServers.push(server);
      resolve(addr.port);
    });
    server.on("error", reject);
  });
}

async function closeHeldServers() {
  while (heldServers.length > 0) {
    const server = heldServers.pop();
    if (!server) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function bash(script: string, env: NodeJS.ProcessEnv = {}): string {
  return execFileSync("bash", ["-c", script], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, ...env }
  });
}

function readRepo(relativePath: string) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}

afterEach(async () => {
  await closeHeldServers();
});

describe("lab listen-port helpers (PERISCAN-557)", () => {
  it("lab_pick_free_tcp_port skips a bound port and any skip-list ports", async () => {
    const held = await holdListenPort(0);
    const out = bash(
      `set -euo pipefail
source infra/lab/scripts/env.sh
lab_pick_free_tcp_port ${held} ${held} $((${held} + 1))`
    ).trim();
    const picked = Number(out);
    expect(Number.isInteger(picked)).toBe(true);
    expect(picked).not.toBe(held);
    expect(picked).not.toBe(held + 1);
    expect(picked).toBeGreaterThan(held);
  });

  it("lab_remap_dev_listen_ports remaps API and rewrites PERISCAN_API_URL when the preferred port is busy", async () => {
    const heldApi = await holdListenPort(0);
    const heldWeb = await holdListenPort(0);
    const out = bash(
      `set -euo pipefail
source infra/lab/scripts/env.sh
export PERISCAN_API_PORT=${heldApi}
export PERISCAN_WEB_PORT=${heldWeb}
lab_remap_dev_listen_ports
echo "RESULT API=$PERISCAN_API_PORT URL=$PERISCAN_API_URL WEB=$PERISCAN_WEB_PORT WEBURL=$PERISCAN_WEB_URL"`
    );
    const result = out
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.startsWith("RESULT "));
    expect(result).toBeDefined();
    const parsed = Object.fromEntries(
      [...result!.matchAll(/(\w+)=(\S+)/g)].map((match) => [match[1], match[2]])
    );
    expect(parsed.API).not.toBe(String(heldApi));
    expect(parsed.WEB).not.toBe(String(heldWeb));
    expect(parsed.URL).toBe(`http://127.0.0.1:${parsed.API}`);
    expect(parsed.WEBURL).toBe(`http://127.0.0.1:${parsed.WEB}`);
    expect(out).toMatch(
      new RegExp(`:${heldApi} is in use — API will bind PERISCAN_API_PORT=${parsed.API}`)
    );
  });

  it("lab_select_deps_publish_ports does not adopt a neighbor postgres/redis bind", async () => {
    const heldPg = await holdListenPort(0);
    const heldRedis = await holdListenPort(0);
    const heldMinio = await holdListenPort(0);
    const heldConsole = await holdListenPort(0);
    const out = bash(
      `set -euo pipefail
source infra/lab/scripts/env.sh
export PERISCAN_POSTGRES_PUBLISHED_PORT=${heldPg}
export PERISCAN_REDIS_PUBLISHED_PORT=${heldRedis}
export PERISCAN_MINIO_PUBLISHED_PORT=${heldMinio}
export PERISCAN_MINIO_CONSOLE_PUBLISHED_PORT=${heldConsole}
lab_select_deps_publish_ports
echo "RESULT PG=$PERISCAN_POSTGRES_PUBLISHED_PORT REDIS=$PERISCAN_REDIS_PUBLISHED_PORT MINIO=$PERISCAN_MINIO_PUBLISHED_PORT CONSOLE=$PERISCAN_MINIO_CONSOLE_PUBLISHED_PORT DB=$DATABASE_URL REDISURL=$REDIS_URL"`
    );
    const result = out
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.startsWith("RESULT "));
    expect(result).toBeDefined();
    const parsed = Object.fromEntries(
      [...result!.matchAll(/(\w+)=(\S+)/g)].map((match) => [match[1], match[2]])
    );
    expect(parsed.PG).not.toBe(String(heldPg));
    expect(parsed.REDIS).not.toBe(String(heldRedis));
    expect(parsed.MINIO).not.toBe(String(heldMinio));
    expect(parsed.CONSOLE).not.toBe(String(heldConsole));
    expect(new Set([parsed.PG, parsed.REDIS, parsed.MINIO, parsed.CONSOLE]).size).toBe(
      4
    );
    expect(parsed.DB).toBe(
      `postgresql://periscan:periscan@127.0.0.1:${parsed.PG}/periscan`
    );
    expect(parsed.REDISURL).toBe(`redis://127.0.0.1:${parsed.REDIS}`);
    expect(out).toMatch(/busy — Postgres publish/);
  });
});

describe("pnpm lab:dev packaging (PERISCAN-557)", () => {
  it("control-plane-dev remaps API like web and can dry-run without starting processes", () => {
    const script = readRepo("infra/lab/scripts/control-plane-dev.sh");
    expect(script).toContain("lab_remap_dev_listen_ports");
    expect(script).toContain("PERISCAN_LAB_DEV_DRY_RUN");
    expect(script).toContain("PERISCAN_API_PORT");
    expect(script).toContain("export PERISCAN_API_PORT");

    const out = execFileSync("bash", ["infra/lab/scripts/control-plane-dev.sh"], {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, PERISCAN_LAB_DEV_DRY_RUN: "1" }
    });
    expect(out).toMatch(/PERISCAN_LAB_MODE=1\s+API=http:\/\/127\.0\.0\.1:\d+/);
    expect(out).not.toMatch(/EADDRINUSE/);
    expect(out).not.toMatch(/starting api \+ worker \+ web/);
  });

  it("documented lab:dev dry-run leaves :3001 in place when it is already bound", () => {
    const script = readRepo("infra/lab/scripts/control-plane-dev.sh");
    if (!script.includes("PERISCAN_LAB_DEV_DRY_RUN")) {
      throw new Error("missing PERISCAN_LAB_DEV_DRY_RUN (do not exec lab:dev)");
    }
    const out = execFileSync("bash", ["infra/lab/scripts/control-plane-dev.sh"], {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, PERISCAN_LAB_DEV_DRY_RUN: "1" }
    });
    const apiMatch = out.match(/API=http:\/\/127\.0\.0\.1:(\d+)/);
    expect(apiMatch).not.toBeNull();
    const apiPort = apiMatch![1];
    const listen3001 = bash(
      `lsof -nP -iTCP:3001 -sTCP:LISTEN >/dev/null 2>&1 && echo busy || echo free`
    ).trim();
    if (listen3001 === "busy") {
      expect(apiPort).not.toBe("3001");
      expect(out).toMatch(/:3001 is in use — API will bind PERISCAN_API_PORT=/);
    }
    const webMatch = out.match(/WEB=http:\/\/127\.0\.0\.1:(\d+)/);
    expect(webMatch).not.toBeNull();
    const listen3000 = bash(
      `lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1 && echo busy || echo free`
    ).trim();
    if (listen3000 === "busy") {
      expect(webMatch![1]).not.toBe("3000");
    }
  });
});

describe("community-first-hour packaging (PERISCAN-557)", () => {
  it("does not skip compose just because a neighbor publishes :5434", () => {
    const script = readRepo("scripts/community-first-hour.sh");
    expect(script).not.toContain("5434->5432");
    expect(script).not.toMatch(/skipping compose create/);
    expect(script).toContain("lab_select_deps_publish_ports");
    expect(script).toContain("PERISCAN_FIRST_HOUR_DRY_RUN");
    expect(script).toContain("docker compose");
    expect(script).toContain("PERISCAN_POSTGRES_PUBLISHED_PORT");
  });

  it("first-hour dry-run picks a free postgres port when :5434 is busy and still plans compose", () => {
    const script = readRepo("scripts/community-first-hour.sh");
    if (!script.includes("PERISCAN_FIRST_HOUR_DRY_RUN")) {
      throw new Error("missing PERISCAN_FIRST_HOUR_DRY_RUN (do not exec first-hour)");
    }
    const out = execFileSync("bash", ["scripts/community-first-hour.sh"], {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        PERISCAN_FIRST_HOUR_DRY_RUN: "1"
      }
    });
    expect(out).not.toMatch(/skipping compose/i);
    expect(out).toMatch(/COMPOSE=up/);
    const pgMatch = out.match(/PERISCAN_POSTGRES_PUBLISHED_PORT=(\d+)/);
    expect(pgMatch).not.toBeNull();
    const pgPort = pgMatch![1];
    const listen5434 = bash(
      `lsof -nP -iTCP:5434 -sTCP:LISTEN >/dev/null 2>&1 && echo busy || echo free`
    ).trim();
    if (listen5434 === "busy") {
      expect(pgPort).not.toBe("5434");
    }
    const redisMatch = out.match(/PERISCAN_REDIS_PUBLISHED_PORT=(\d+)/);
    expect(redisMatch).not.toBeNull();
    const listen6379 = bash(
      `lsof -nP -iTCP:6379 -sTCP:LISTEN >/dev/null 2>&1 && echo busy || echo free`
    ).trim();
    if (listen6379 === "busy") {
      expect(redisMatch![1]).not.toBe("6379");
    }
    expect(out).toMatch(
      new RegExp(
        `DATABASE_URL=postgresql://periscan:periscan@127\\.0\\.0\\.1:${pgPort}/periscan`
      )
    );
  });
});

describe("clone docs mention API remap (PERISCAN-557)", () => {
  it("USING.md documents lab:dev API auto-shift", () => {
    const using = readRepo("USING.md");
    expect(using).toMatch(/PERISCAN_API_PORT/);
    expect(using).toMatch(/auto-shift/i);
    expect(using).toMatch(/:3001/);
    expect(using).toMatch(/free API port|auto-shift|binds the next/i);
  });
});
