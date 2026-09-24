import { spawn, spawnSync } from "node:child_process";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse
} from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

const WINDOWS_RCE_GHSA = "GHSA-p293-qw3h-jr36";
const AVIF_RCE_GHSA = "GHSA-2xp9-vwfh-vxw4";

type Advisory = {
  id: number;
  severity: string;
  title: string;
  url: string;
  github_advisory_id?: string;
};

type AuditRun = {
  code: number | null;
  stdout: string;
  stderr: string;
};

const mockServers: Array<ReturnType<typeof createServer>> = [];

afterEach(async () => {
  await Promise.all(
    mockServers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        })
    )
  );
});

async function readRepoFile(relPath: string): Promise<string> {
  return readFile(path.join(repoRoot, relPath), "utf8");
}

function advisory(
  ghsa: string,
  severity: string,
  title: string,
  id: number
): Advisory {
  return {
    id,
    severity,
    title,
    url: `https://github.com/advisories/${ghsa}`
  };
}

function startMockRegistry(
  advisoriesByPackage: Record<string, Advisory[]>
): Promise<{ url: string }> {
  return new Promise((resolve, reject) => {
    const server = createServer(
      (request: IncomingMessage, response: ServerResponse) => {
        if (
          request.method === "POST" &&
          request.url === "/-/npm/v1/security/advisories/bulk"
        ) {
          response.writeHead(200, { "content-type": "application/json" });
          response.end(JSON.stringify(advisoriesByPackage));
          return;
        }
        response.writeHead(404);
        response.end();
      }
    );
    mockServers.push(server);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("mock registry did not bind a port"));
        return;
      }
      resolve({ url: `http://127.0.0.1:${address.port}` });
    });
  });
}

function runAudit(
  registryUrl: string,
  extraArgs: string[] = []
): Promise<AuditRun> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["scripts/audit-dependencies.mjs", ...extraArgs],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          PERISCAN_AUDIT_REGISTRY: registryUrl
        }
      }
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

describe("dependency audit GHSA gate (PERISCAN-580)", () => {
  it("process.exit(1)s on blocking findings instead of leaving a wrapper to guess", async () => {
    const source = await readRepoFile("scripts/audit-dependencies.mjs");
    expect(source).toMatch(
      /if \(blocking\.length > 0\) \{\s*process\.exit\(1\);/u
    );
    expect(source).not.toMatch(
      /if \(blocking\.length > 0\) process\.exitCode = 1;/u
    );
  });

  it("does not let verify.sh echo AUDIT_HIGH_OK after a failing high audit", async () => {
    const verify = await readRepoFile("scripts/verify.sh");
    expect(verify).toContain(
      "node scripts/audit-dependencies.mjs --audit-level high"
    );
    expect(verify).not.toMatch(/AUDIT_HIGH_OK/u);
    expect(verify).not.toMatch(
      /node scripts\/audit-dependencies\.mjs --audit-level high \|\|/u
    );
  });

  it("every ALLOWED_GHSA entry is a GHSA id that cites Plane 580", async () => {
    const { ALLOWED_GHSA } =
      await import("../../scripts/audit-dependencies.mjs");
    for (const [ghsa, reason] of Object.entries(
      ALLOWED_GHSA as Record<string, string>
    )) {
      expect(ghsa).toMatch(/^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/iu);
      expect(reason).toMatch(/PERISCAN-580/u);
    }
  });

  it("treats an unlisted critical as blocking even when another GHSA is allowlisted", async () => {
    const { selectBlockingFindings } =
      await import("../../scripts/audit-dependencies.mjs");
    const findings = [
      {
        packageName: "next",
        advisory: advisory(WINDOWS_RCE_GHSA, "critical", "Windows RCE", 1)
      },
      {
        packageName: "next",
        advisory: advisory(AVIF_RCE_GHSA, "critical", "AVIF RCE", 2)
      }
    ];
    const blocking = selectBlockingFindings(findings, "high", {
      [WINDOWS_RCE_GHSA]: "do not use in production — PERISCAN-580"
    });
    expect(
      blocking.map((item: { advisory: Advisory }) => item.advisory.url)
    ).toEqual([`https://github.com/advisories/${AVIF_RCE_GHSA}`]);
  });

  it("exits 1 when the registry returns an unlisted critical GHSA", async () => {
    const { url } = await startMockRegistry({
      next: [
        advisory(
          WINDOWS_RCE_GHSA,
          "critical",
          "Unauthenticated Remote Code Execution on windows-hosted servers",
          1193676
        )
      ]
    });
    const run = await runAudit(url, ["--audit-level", "high"]);
    expect(run.stderr).toBe("");
    expect(run.stdout).toContain("CRITICAL");
    expect(run.stdout).toContain(WINDOWS_RCE_GHSA);
    expect(run.stdout).toMatch(/1 at or above high/u);
    expect(run.code).toBe(1);
  });

  it("exits 0 when the registry returns no advisories at or above the audit level", async () => {
    const { url } = await startMockRegistry({
      nodemailer: [
        advisory(
          "GHSA-wmmp-3585-3rmp",
          "moderate",
          "IDN/Punycode domain allow-list bypass",
          1193770
        )
      ]
    });
    const run = await runAudit(url, ["--audit-level", "high"]);
    expect(run.stdout).toMatch(/0 at or above high/u);
    expect(run.code).toBe(0);
  });
});

describe("Dependabot HIGH pins (PERISCAN-490)", () => {
  it("pins @xmldom/xmldom 0.8.15 and deepmerge-ts 8.0.0 via pnpm overrides", async () => {
    const manifest = JSON.parse(await readRepoFile("package.json")) as {
      pnpm?: { overrides?: Record<string, string> };
    };
    expect(manifest.pnpm?.overrides?.["@xmldom/xmldom"]).toBe("0.8.15");
    expect(manifest.pnpm?.overrides?.["deepmerge-ts"]).toBe("8.0.0");
  });

  it("does not waive xmldom or deepmerge-ts GHSAs on the high gate", async () => {
    const { ALLOWED_GHSA } =
      await import("../../scripts/audit-dependencies.mjs");
    const allowed = Object.keys(ALLOWED_GHSA as Record<string, string>).map(
      (id) => id.toUpperCase()
    );
    expect(allowed).not.toContain("GHSA-GGR8-5VV4-36MX");
    expect(allowed).not.toContain("GHSA-X6WF-G6F9-QW9Q");
  });

  it("does not lock @xmldom/xmldom 0.8.13 or deepmerge-ts 7.1.5", async () => {
    const lockfile = await readRepoFile("pnpm-lock.yaml");
    expect(lockfile).toMatch(/['"]?@xmldom\/xmldom['"]?:\s*0\.8\.15/u);
    expect(lockfile).toMatch(/deepmerge-ts:\s*8\.0\.0/u);
    expect(lockfile).not.toMatch(/@xmldom\/xmldom@0\.8\.13/u);
    expect(lockfile).not.toMatch(/deepmerge-ts@7\.1\.5/u);
    expect(lockfile).toMatch(/@xmldom\/xmldom@0\.8\.15/u);
    expect(lockfile).toMatch(/deepmerge-ts@8\.0\.0/u);
  });

  it("pins apps/api fastify to a 5.12.1+ release", async () => {
    const manifest = JSON.parse(
      await readRepoFile("apps/api/package.json")
    ) as {
      dependencies?: Record<string, string>;
    };
    expect(manifest.dependencies?.fastify).toBe("^5.12.1");
  });
});

describe("P2-DEP vitest mocker pin (GHSA-82fw-gwwq-j7x9)", () => {
  it("pins vitest and @vitest/mocker 4.1.11 via pnpm overrides", async () => {
    const manifest = JSON.parse(await readRepoFile("package.json")) as {
      devDependencies?: Record<string, string>;
      pnpm?: { overrides?: Record<string, string> };
    };
    expect(manifest.devDependencies?.vitest).toBe("^4.1.11");
    expect(manifest.pnpm?.overrides?.vitest).toBe("4.1.11");
    expect(manifest.pnpm?.overrides?.["@vitest/mocker"]).toBe("4.1.11");
  });

  it("aligns TUI vitest with the patched 4.1.11 line (3.x is unmaintained)", async () => {
    const manifest = JSON.parse(
      await readRepoFile("apps/tui/package.json")
    ) as {
      devDependencies?: Record<string, string>;
    };
    expect(manifest.devDependencies?.vitest).toBe("^4.1.11");
  });

  it("does not waive GHSA-82fw-gwwq-j7x9 on the high gate", async () => {
    const { ALLOWED_GHSA } =
      await import("../../scripts/audit-dependencies.mjs");
    const allowed = Object.keys(ALLOWED_GHSA as Record<string, string>).map(
      (id) => id.toUpperCase()
    );
    expect(allowed).not.toContain("GHSA-82FW-GWWQ-J7X9");
  });

  it("does not lock vitest 4.1.10, vitest 3.2.7, or unpatched @vitest/mocker", async () => {
    const lockfile = await readRepoFile("pnpm-lock.yaml");
    expect(lockfile).toMatch(/vitest@4\.1\.11/u);
    expect(lockfile).toMatch(/['"]@vitest\/mocker@4\.1\.11['"]:/u);
    expect(lockfile).not.toMatch(/vitest@4\.1\.10/u);
    expect(lockfile).not.toMatch(/vitest@3\.2\.7/u);
    expect(lockfile).not.toMatch(/@vitest\/mocker@4\.1\.10/u);
    expect(lockfile).not.toMatch(/@vitest\/mocker@3\.2\.7/u);
  });
});

describe("P2-DEP public checkout includes the patched lockfile", () => {
  it("keeps pnpm-lock.yaml git-tracked so Dependabot can see the 4.1.11 pin", () => {
    const listed = spawnSync("git", ["ls-files", "--", "pnpm-lock.yaml"], {
      cwd: repoRoot,
      encoding: "utf8"
    });
    expect(listed.status, listed.stderr).toBe(0);
    expect(listed.stdout.trim()).toBe("pnpm-lock.yaml");
  });
});

describe("@types/node Fastify typecheck pin (PERISCAN-490)", () => {
  it("pins @types/node 20.19.43 in root devDependencies and pnpm overrides", async () => {
    const manifest = JSON.parse(await readRepoFile("package.json")) as {
      devDependencies?: Record<string, string>;
      pnpm?: { overrides?: Record<string, string> };
    };
    expect(manifest.devDependencies?.["@types/node"]).toBe("20.19.43");
    expect(manifest.pnpm?.overrides?.["@types/node"]).toBe("20.19.43");
  });

  it("locks @types/node 20.19.43 and does not lock 25.x", async () => {
    const lockfile = await readRepoFile("pnpm-lock.yaml");
    expect(lockfile).toMatch(/^  ['"]@types\/node['"]:\s*20\.19\.43$/mu);
    expect(lockfile).toMatch(/specifier: 20\.19\.43/u);
    expect(lockfile).toMatch(/@types\/node@20\.19\.43/u);
    expect(lockfile).not.toMatch(/@types\/node@25\./u);
    expect(lockfile).not.toMatch(/specifier: \^25\./u);
  });
});
