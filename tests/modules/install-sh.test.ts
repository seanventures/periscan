import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

const cloneHomes: string[] = [];
const servers: net.Server[] = [];
const childProcs: ChildProcess[] = [];

afterEach(async () => {
  for (const child of childProcs.splice(0)) {
    child.kill("SIGTERM");
  }
  while (servers.length > 0) {
    const server = servers.pop();
    if (!server) {
      continue;
    }
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
  while (cloneHomes.length > 0) {
    const home = cloneHomes.pop();
    if (home) {
      rmSync(home, { recursive: true, force: true });
    }
  }
});

function withoutLabPorts(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of [
    "PERISCAN_API_PORT",
    "PERISCAN_WEB_PORT",
    "PERISCAN_API_URL",
    "PERISCAN_WEB_URL",
    "PERISCAN_POSTGRES_PUBLISHED_PORT",
    "PERISCAN_REDIS_PUBLISHED_PORT",
    "PERISCAN_MINIO_PUBLISHED_PORT",
    "PERISCAN_MINIO_CONSOLE_PUBLISHED_PORT",
    "DATABASE_URL",
    "REDIS_URL",
    "PERISCAN_INSTALL_DRY_RUN",
    "PERISCAN_PERISCAN_SH_DRY_RUN",
    "PERISCAN_FIRST_HOUR_DRY_RUN",
    "PERISCAN_LAB_DEV_DRY_RUN",
    "PERISCAN_HOME"
  ]) {
    delete env[key];
  }
  return { ...env, ...extra };
}

function listenTcp(port: number, host = "127.0.0.1"): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(port, host, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("listen did not bind a TCP port"));
        return;
      }
      servers.push(server);
      resolve(addr.port);
    });
  });
}

function spawnHealthServer(port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    // Child process: spawnSync in the test blocks this event loop, so an
    // in-process http.Server cannot accept the install.sh curl probe.
    const child = spawn(
      process.execPath,
      [
        "-e",
        `const http=require("http");
         const want=Number(process.env.PORT);
         const server=http.createServer((req,res)=>{
           const ok=(req.url||"").includes("/health");
           res.writeHead(ok?200:404,{"content-type":"application/json"});
           res.end(ok?JSON.stringify({status:"ok"}):"{}");
         });
         server.on("error",(err)=>{console.error(err);process.exit(1)});
         server.listen(want,"127.0.0.1",()=>{
           process.stdout.write("ready "+server.address().port+"\\n");
         });`
      ],
      {
        env: { ...process.env, PORT: String(port) },
        stdio: ["ignore", "pipe", "pipe"]
      }
    );
    childProcs.push(child);
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill("SIGTERM");
      reject(new Error("health server did not become ready"));
    }, 3000);
    let buf = "";
    child.stdout?.on("data", (chunk: Buffer | string) => {
      buf += String(chunk);
      const match = buf.match(/ready (\d+)/);
      if (match && !settled) {
        settled = true;
        clearTimeout(timer);
        resolve(Number(match[1]));
      }
    });
    child.once("exit", (code) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      reject(new Error(`health server exited ${code}`));
    });
  });
}

async function bindPreferredOrEphemeral(
  preferred: number,
  listen: (port: number) => Promise<number>
): Promise<number> {
  try {
    return await listen(preferred);
  } catch {
    return listen(0);
  }
}

function makeCloneWithState(apiPort: number, webPort: number): string {
  const home = mkdtempSync(join(tmpdir(), "periscan-install-health-"));
  cloneHomes.push(home);
  mkdirSync(join(home, "scripts"));
  mkdirSync(join(home, "infra/docker-compose"), { recursive: true });
  mkdirSync(join(home, "infra/lab/scripts"), { recursive: true });
  mkdirSync(join(home, ".periscan"));
  cpSync(join(repoRoot, "install.sh"), join(home, "install.sh"));
  cpSync(join(repoRoot, "infra/lab/scripts/env.sh"), join(home, "infra/lab/scripts/env.sh"));
  writeFileSync(join(home, "scripts/periscan.sh"), "#!/usr/bin/env bash\nexit 0\n");
  writeFileSync(join(home, "package.json"), "{}\n");
  writeFileSync(
    join(home, "infra/docker-compose/docker-compose.yml"),
    "name: periscan-install-health-fixture\nservices: {}\n"
  );
  writeFileSync(
    join(home, ".periscan/community.env"),
    [
      "PERISCAN_POSTGRES_PUBLISHED_PORT=5437",
      "PERISCAN_REDIS_PUBLISHED_PORT=6382",
      "PERISCAN_MINIO_PUBLISHED_PORT=9014",
      "PERISCAN_MINIO_CONSOLE_PUBLISHED_PORT=9015",
      "DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5437/periscan",
      "REDIS_URL=redis://127.0.0.1:6382",
      `PERISCAN_API_PORT=${apiPort}`,
      `PERISCAN_WEB_PORT=${webPort}`,
      `PERISCAN_API_URL=http://127.0.0.1:${apiPort}`,
      `PERISCAN_WEB_URL=http://127.0.0.1:${webPort}`,
      ""
    ].join("\n")
  );
  return home;
}

function runInstallIn(
  home: string,
  args: string[],
  env: NodeJS.ProcessEnv = {}
) {
  return spawnSync("bash", ["install.sh", ...args], {
    cwd: home,
    encoding: "utf8",
    timeout: 15_000,
    env: withoutLabPorts(env)
  });
}

function readRepo(relativePath: string) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}

function runInstall(
  args: string[],
  env: NodeJS.ProcessEnv = {},
  script = "install.sh"
) {
  return spawnSync("bash", [script, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, ...env }
  });
}

function combined(result: ReturnType<typeof spawnSync>) {
  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}

describe("install.sh (PERISCAN-576)", { timeout: 20_000 }, () => {
  it("help lists doctor/health/install", () => {
    const result = runInstall(["--help"]);
    expect(result.status).toBe(0);
    const out = combined(result);
    for (const command of ["doctor", "health", "install"]) {
      expect(out).toContain(command);
    }
  });

  it("bash -s -- --help lists doctor/health/install", () => {
    const script = readRepo("install.sh");
    const result = spawnSync("bash", ["-s", "--", "--help"], {
      cwd: repoRoot,
      encoding: "utf8",
      input: script,
      env: process.env
    });
    expect(result.status).toBe(0);
    const out = combined(result);
    for (const command of ["doctor", "health", "install"]) {
      expect(out).toContain(command);
    }
  });

  it("dry-run exits 0 and mentions compose file + clone URL, does not docker compose up", () => {
    const result = runInstall(["--dry-run"]);
    expect(result.status).toBe(0);
    const out = combined(result);
    expect(out).toContain("infra/docker-compose/docker-compose.yml");
    expect(out).toContain("https://github.com/seanventures/periscan.git");
    expect(out).not.toMatch(/==> docker compose up/);
    expect(out).not.toMatch(/docker compose -f \S+ up/);
    expect(out).not.toMatch(/Cloning into/);
    expect(out).not.toMatch(/starting api \+ worker \+ web/);
  });

  it("unknown flag exits non-zero", () => {
    const result = runInstall(["--definitely-not-a-flag"]);
    expect(result.status).not.toBe(0);
    expect(result.status).not.toBeNull();
    expect(combined(result)).toMatch(/unknown/i);
  });

  it("doctor in dry-run prints checks", () => {
    const result = runInstall(["doctor", "--dry-run"]);
    expect(result.status).toBe(0);
    const out = combined(result);
    expect(out).toMatch(/check:.*node/i);
    expect(out).toMatch(/check:.*pnpm/i);
    expect(out).toMatch(/check:.*docker/i);
    expect(out).toMatch(/check:.*compose/i);
    expect(out).toMatch(/check:.*git/i);
    expect(out).toContain("infra/docker-compose/docker-compose.yml");
    expect(out).not.toMatch(/==> docker compose up/);
    expect(out).not.toMatch(/FLUSHDB/);
  });

  it("scripts/install.sh help and dry-run match the curl target", () => {
    const help = runInstall(["help"], {}, "scripts/install.sh");
    expect(help.status).toBe(0);
    const helpOut = combined(help);
    expect(helpOut).toContain("doctor");
    expect(helpOut).toContain("health");
    expect(helpOut).toContain("install");

    const dry = runInstall(["--dry-run"], {}, "scripts/install.sh");
    expect(dry.status).toBe(0);
    const dryOut = combined(dry);
    expect(dryOut).toContain("infra/docker-compose/docker-compose.yml");
    expect(dryOut).toContain("https://github.com/seanventures/periscan.git");
    expect(dryOut).not.toMatch(/==> docker compose up/);
  });

  it("reuses periscan.sh, first-hour, env.sh; never root compose.yaml, FLUSHDB, or Atomic", () => {
    const root = readRepo("install.sh");
    const nested = readRepo("scripts/install.sh");
    expect(root).toContain("set -euo pipefail");
    expect(root).toContain("scripts/periscan.sh");
    expect(root).toContain("scripts/community-first-hour.sh");
    expect(root).toContain("lab_select_deps_publish_ports");
    expect(root).toContain(".periscan/community.env");
    expect(root).toContain("infra/lab/scripts/env.sh");
    expect(root).toContain("infra/docker-compose/docker-compose.yml");
    expect(root).toContain("https://github.com/seanventures/periscan.git");
    expect(root).toMatch(/docs\.docker\.com\/get-docker/);
    expect(root).not.toMatch(/docker compose -f compose\.yaml/);
    expect(root).not.toMatch(/FLUSHDB/);
    expect(root).not.toMatch(/\bAtomic\b/);
    expect(root).toContain("drain-validation-queue.sh");
    expect(nested).toMatch(/install\.sh/);
  });

  it("README fold leads with the curl one-liner, then periscan.sh for an existing clone", () => {
    const readme = readRepo("README.md");
    const fold = readme.split("\n").slice(0, 55).join("\n");
    const curl =
      "curl -fsSL --proto '=https' --tlsv1.2 https://raw.githubusercontent.com/seanventures/periscan/main/install.sh | bash";
    expect(fold).toContain(curl);
    expect(fold).toContain("bash scripts/periscan.sh install");
    expect(fold).toContain("bash scripts/periscan.sh start");
    expect(fold.indexOf(curl)).toBeGreaterThanOrEqual(0);
    expect(fold.indexOf(curl)).toBeLessThan(fold.indexOf("bash scripts/periscan.sh install"));
    expect(readme).toMatch(/local clone path/i);
    expect(readme).toContain("Apache-2.0");
    expect(readme).toContain("github.com/org/repo");
  });

  it("health and doctor dry-run keep STATE_ENV API 3007 when that port is already healthy", async () => {
    const apiPort = await bindPreferredOrEphemeral(3007, spawnHealthServer);
    const webPort = await bindPreferredOrEphemeral(3017, listenTcp);
    const home = makeCloneWithState(apiPort, webPort);

    const dryHealth = runInstallIn(home, ["health", "--dry-run"]);
    expect(dryHealth.status).toBe(0);
    const dryHealthOut = combined(dryHealth);
    expect(dryHealthOut).toContain(`API: http://127.0.0.1:${apiPort}`);
    expect(dryHealthOut).toContain(`web: http://127.0.0.1:${webPort}`);
    expect(dryHealthOut).toContain("DATABASE_URL port: 5437");
    expect(dryHealthOut).not.toMatch(/is in use — API will bind PERISCAN_API_PORT=/);
    expect(dryHealthOut).not.toMatch(
      new RegExp(`API: http://127\\.0\\.0\\.1:(?!${apiPort}\\b)\\d+`)
    );

    const dryDoctor = runInstallIn(home, ["doctor", "--dry-run"]);
    expect(dryDoctor.status).toBe(0);
    const dryDoctorOut = combined(dryDoctor);
    expect(dryDoctorOut).toContain(`API: http://127.0.0.1:${apiPort}`);
    expect(dryDoctorOut).not.toMatch(/is in use — API will bind PERISCAN_API_PORT=/);
    expect(dryDoctorOut).not.toMatch(/FLUSHDB/);
    expect(dryDoctorOut).not.toMatch(
      new RegExp(`API: http://127\\.0\\.0\\.1:(?!${apiPort}\\b)\\d+`)
    );
  });

  it("health probes this clone's STATE_ENV API port, not the next free port", async () => {
    const apiPort = await bindPreferredOrEphemeral(3007, spawnHealthServer);
    const webPort = await bindPreferredOrEphemeral(3017, listenTcp);
    const home = makeCloneWithState(apiPort, webPort);

    const result = runInstallIn(home, ["health"]);
    const out = combined(result);
    expect(result.status).toBe(0);
    expect(out).toContain(`API: http://127.0.0.1:${apiPort} health=ok`);
    expect(out).toContain(`web: http://127.0.0.1:${webPort}`);
    expect(out).toContain("DATABASE_URL port: 5437");
    expect(out).not.toMatch(/is in use — API will bind PERISCAN_API_PORT=/);
    expect(out).not.toMatch(
      new RegExp(`API: http://127\\.0\\.0\\.1:(?!${apiPort}\\b)\\d+`)
    );
    expect(out).not.toContain("health=down");
  });
});
