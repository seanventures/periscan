import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFile(new URL(`../../${path}`, import.meta.url), "utf8");

describe("BAS program and authorization contract", () => {
  it("permits development while requiring qualification and measured proof", async () => {
    const program = await read("docs/BAS_AEV_PROGRAM.md");
    for (const engine of ["Atomic", "Caldera", "SharpHound", "Metasploit"])
      expect(program).toContain(engine);
    expect(program).toMatch(/explicit Periscan product objectives/);
    expect(program).toMatch(/Fixed only after verification/);
    expect(program).toMatch(/denial before queue/);
  });
  it("documents the complete delivery matrix and current runtime readiness", async () => {
    const matrix = await read("docs/BAS_AEV_FEATURE_MATRIX.md");
    for (const feature of [
      "Endpoint BAS",
      "Identity AEV",
      "Network and segmentation",
      "Web/API and cloud",
      "Containers and workloads",
      "Detection engineering",
      "Campaign authoring",
      "Remediation and regression",
      "Continuous operation"
    ])
      expect(matrix).toContain(feature);
    expect(matrix).toContain("disposable local labs");
    expect(matrix).toContain("qualification_required");
    const env = await read(".env.example");
    expect(env).toMatch(/^PERISCAN_LIVE_OFFENSIVE=false$/m);
  });
  it("keeps implementation authorization explicit in agent handoffs", async () => {
    const agents = await read("AGENTS.md");
    expect(agents).toContain("no additional product-scope approval");
    expect(agents).toContain("it is not a development ban");
    const handoff = await read("docs/BAS_AEV_AGENT_HANDOFF.md");
    expect(handoff).toContain("Grok and every other coding agent");
    expect(handoff).toContain("cached context");
    expect(handoff).toContain("PERISCAN-585");
    for (const path of [
      ".ai/codex-handoff.md",
      ".ai/status.md",
      ".ai/gap-backlog.md"
    ]) {
      const content = await read(path);
      expect(content.slice(0, 700)).toContain("BAS_AEV_AGENT_HANDOFF.md");
    }
  });
  it("binds customer execution to the exact plan, scope and cleanup", async () => {
    const auth = await read("docs/competitive/BAS_EXECUTION_AUTHORIZATION.md");
    for (const requirement of [
      "verified target scope/version",
      "input digest",
      "policy decision",
      "expiry",
      "cleanup verification",
      "Denied work must never queue",
      "signed receipts"
    ])
      expect(auth).toContain(requirement);
  });
});
