import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  SARIF_AUTOMATION_ID,
  SARIF_VERSION
} from "../../packages/reports/src/sarif.js";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const actionYmlPath = path.join(repoRoot, "actions/community-proof/action.yml");
const fetchScriptPath = path.join(
  repoRoot,
  "actions/community-proof/fetch-sarif.py"
);
const readmePath = path.join(repoRoot, "actions/community-proof/README.md");
const examplePath = path.join(
  repoRoot,
  ".github/workflows/community-proof-example.yml"
);

const MISSION_ID = "55555555-5555-4555-8555-555555555555";

const EMPTY_SARIF = {
  version: SARIF_VERSION,
  runs: [{ results: [] }]
};

function read(filePath: string): string {
  return readFileSync(filePath, "utf8");
}

function inputBlock(actionYml: string, name: string): string {
  const match = actionYml.match(
    new RegExp(`^  ${name}:\\n(?:    .*\\n)*`, "m")
  );
  expect(match, `missing input ${name}`).toBeTruthy();
  return match![0];
}

function stepById(actionYml: string, id: string): string {
  const steps = actionYml.split(/^\s+- name:/m).slice(1);
  const step = steps.find((block) =>
    new RegExp(`^\\s+id:\\s+${id}\\s*$`, "m").test(block)
  );
  expect(step, `missing step id=${id}`).toBeTruthy();
  return step!;
}

function uploadSarifStep(actionYml: string): string {
  const steps = actionYml.split(/^\s+- name:/m).slice(1);
  const step = steps.find((block) =>
    block.includes("github/codeql-action/upload-sarif@v3")
  );
  expect(step, "missing upload-sarif@v3 step").toBeTruthy();
  return step!;
}

function listen(
  handler: (
    url: URL,
    authorization: string | undefined
  ) => { status: number; body: string }
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = createServer((request, response) => {
    const host = request.headers.host ?? "127.0.0.1";
    const url = new URL(request.url ?? "/", `http://${host}`);
    try {
      const result = handler(url, request.headers.authorization);
      const body = Buffer.from(result.body);
      response.writeHead(result.status, {
        connection: "close",
        "content-length": String(body.length),
        "content-type": "application/sarif+json"
      });
      response.end(body);
    } catch (error) {
      response.writeHead(500, { "content-type": "text/plain" });
      response.end(error instanceof Error ? error.message : String(error));
    }
  });
  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("expected TCP address"));
        return;
      }
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise((done, fail) =>
            server.close((error) => (error ? fail(error) : done()))
          )
      });
    });
  });
}

function runFetch(env: NodeJS.ProcessEnv) {
  return new Promise<{
    status: number | null;
    stderr: string;
    stdout: string;
  }>((resolve, reject) => {
    const child = spawn("python3", [fetchScriptPath], {
      env: {
        ...process.env,
        HTTP_PROXY: "",
        HTTPS_PROXY: "",
        http_proxy: "",
        https_proxy: "",
        NO_PROXY: "*",
        no_proxy: "*",
        ...env
      }
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`fetch-sarif.py timed out\n${stderr}`));
    }, 8000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (status) => {
      clearTimeout(timer);
      resolve({ status, stderr, stdout });
    });
  });
}

describe("community-proof optional Code Scanning SARIF upload", () => {
  it("defaults upload_sarif to false and fetches mission SARIF after a queued run", () => {
    const actionYml = read(actionYmlPath);
    const input = inputBlock(actionYml, "upload_sarif");
    expect(input).toMatch(/required:\s*false/);
    expect(input).toMatch(/default:\s*"false"/);

    const fetchStep = stepById(actionYml, "sarif");
    expect(fetchStep).toContain("fetch-sarif.py");
    expect(fetchStep).toContain("inputs.upload_sarif == 'true'");
    expect(fetchStep).toContain("steps.proof.outputs.denied != 'true'");
    expect(fetchStep).toContain("steps.proof.outputs.mission_id != ''");
    expect(fetchStep).toContain("steps.proof.outcome == 'success'");

    const uploadStep = uploadSarifStep(actionYml);
    expect(uploadStep).toContain("category: periscan-community");
    expect(uploadStep).toContain(`category: ${SARIF_AUTOMATION_ID}`);
    expect(uploadStep).toContain("sarif_file: periscan.sarif");
    expect(uploadStep).toContain("inputs.upload_sarif == 'true'");
    expect(uploadStep).toContain("steps.proof.outputs.denied != 'true'");
    expect(uploadStep).toContain("steps.sarif.outputs.sarif_path != ''");
  });

  it("does not treat a policy deny as a Code Scanning pass", () => {
    const actionYml = read(actionYmlPath);
    const fetchStep = stepById(actionYml, "sarif");
    const uploadStep = uploadSarifStep(actionYml);
    expect(fetchStep).toContain("denied != 'true'");
    expect(uploadStep).toContain("denied != 'true'");
    expect(actionYml).toMatch(/jobsQueued=0/);
    expect(actionYml.toLowerCase()).toContain("fake pass");
  });

  it("documents security-events: write and refuses certification/pentest claims", () => {
    const readme = read(readmePath);
    expect(readme).toContain("upload_sarif");
    expect(readme).toContain("security-events: write");
    expect(readme).toContain("/api/v1/findings.sarif?missionId=");
    expect(readme).toContain("periscan-community");
    expect(readme.toLowerCase()).toContain("not a certification");
    expect(readme.toLowerCase()).toContain("not a pentest");
    expect(readme).toMatch(/Do not say[\s\S]*certified/i);
    expect(readme).toMatch(/Do not say[\s\S]*automated pentest/i);

    const example = read(examplePath);
    expect(example).toMatch(/#\s*upload_sarif:\s*true/);
    expect(example).toMatch(/#\s*security-events:\s*write/);
    expect(example).not.toMatch(/^\s+security-events:\s+write\s*$/m);
    expect(example).not.toMatch(/^\s+upload_sarif:\s+true\s*$/m);
  });
});

describe("fetch-sarif.py", () => {
  it("writes periscan.sarif from GET /api/v1/findings.sarif?missionId=", async () => {
    const workspace = mkdtempSync(path.join(tmpdir(), "periscan-sarif-"));
    let requested: URL | undefined;
    let authorization: string | undefined;
    const server = await listen((url, header) => {
      requested = url;
      authorization = header;
      return { body: JSON.stringify(EMPTY_SARIF), status: 200 };
    });

    try {
      const result = await runFetch({
        GITHUB_OUTPUT: path.join(workspace, "github-output"),
        GITHUB_WORKSPACE: workspace,
        PERISCAN_API_TOKEN: "test-token",
        PERISCAN_API_URL: server.baseUrl,
        PERISCAN_DENIED: "false",
        PERISCAN_MISSION_ID: MISSION_ID
      });
      expect(result.status, result.stderr).toBe(0);
      expect(authorization).toBe("Bearer test-token");
      expect(requested?.pathname).toBe("/api/v1/findings.sarif");
      expect(requested?.searchParams.get("missionId")).toBe(MISSION_ID);

      const sarifPath = path.join(workspace, "periscan.sarif");
      const log = JSON.parse(readFileSync(sarifPath, "utf8")) as {
        version: string;
        runs: unknown[];
      };
      expect(log.version).toBe("2.1.0");
      expect(log.runs[0]).toEqual({ results: [] });
      expect(readFileSync(path.join(workspace, "github-output"), "utf8")).toBe(
        "sarif_path=periscan.sarif\n"
      );
    } finally {
      await server.close();
    }
  }, 20_000);

  it("does not write periscan.sarif when jobsQueued=0 was denied", async () => {
    const workspace = mkdtempSync(path.join(tmpdir(), "periscan-sarif-deny-"));
    let hits = 0;
    const server = await listen(() => {
      hits += 1;
      return { body: JSON.stringify(EMPTY_SARIF), status: 200 };
    });

    try {
      const result = await runFetch({
        GITHUB_OUTPUT: path.join(workspace, "github-output"),
        GITHUB_WORKSPACE: workspace,
        PERISCAN_API_TOKEN: "test-token",
        PERISCAN_API_URL: `${server.baseUrl}/api/v1`,
        PERISCAN_DENIED: "true",
        PERISCAN_MISSION_ID: MISSION_ID
      });
      expect(result.status, result.stderr).toBe(0);
      expect(hits).toBe(0);
      expect(result.stderr.toLowerCase()).toContain("fake pass");
      expect(existsSync(path.join(workspace, "periscan.sarif"))).toBe(false);
      expect(readFileSync(path.join(workspace, "github-output"), "utf8")).toBe(
        "sarif_path=\n"
      );
    } finally {
      await server.close();
    }
  });

  it("fails closed when the SARIF export is not HTTP 200", async () => {
    const workspace = mkdtempSync(path.join(tmpdir(), "periscan-sarif-fail-"));
    const server = await listen(() => ({
      body: JSON.stringify({ error: "nope" }),
      status: 500
    }));

    try {
      const result = await runFetch({
        GITHUB_WORKSPACE: workspace,
        PERISCAN_API_TOKEN: "test-token",
        PERISCAN_API_URL: server.baseUrl,
        PERISCAN_DENIED: "false",
        PERISCAN_MISSION_ID: MISSION_ID
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("HTTP 500");
      expect(existsSync(path.join(workspace, "periscan.sarif"))).toBe(false);
    } finally {
      await server.close();
    }
  }, 20_000);
});
