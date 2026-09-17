import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

async function readRepoFile(path: string) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("CI workflow release gate", () => {
  it("keeps GitHub Actions aligned with the local verify contract", async () => {
    const [workflow, verifyScript] = await Promise.all([
      readRepoFile(".github/workflows/ci.yml"),
      readRepoFile("scripts/verify.sh")
    ]);

    expect(workflow).toContain("run: pnpm verify");
    expect(workflow).toContain("Verification contract summary");
    expect(workflow).toContain("Playwright E2E/accessibility");
    expect(workflow).toContain("fatal high+ dependency audit");
    expect(workflow).not.toContain("playwright a11y not auto");
    expect(workflow).not.toContain("e2e is APIRequest only");
    expect(workflow).not.toContain("non-fatal for P2");
    expect(workflow).not.toMatch(/pnpm audit --audit-level high \|\|/u);

    expect(verifyScript).toContain("pnpm test:e2e");
    expect(verifyScript).toContain(
      "node scripts/audit-dependencies.mjs --audit-level high"
    );
    expect(verifyScript).toContain("pnpm test:acceptance");
    expect(verifyScript).not.toMatch(
      /node scripts\/audit-dependencies\.mjs --audit-level high \|\|/u
    );
  });

  it("builds every documented deployable image in the image workflow", async () => {
    const [imageWorkflow, deployGuide] = await Promise.all([
      readRepoFile(".github/workflows/images-build.yml"),
      readRepoFile("docs/DEPLOY.md")
    ]);

    for (const dockerfile of [
      "apps/api/Dockerfile",
      "infra/docker/scan-executor.Dockerfile",
      "apps/runner-agent/Dockerfile",
      "apps/web/Dockerfile"
    ]) {
      expect(deployGuide).toContain(dockerfile);
      expect(imageWorkflow).toContain(dockerfile);
    }

    for (const image of [
      "ghcr.io/seanheiney/periscan-api",
      "ghcr.io/seanheiney/periscan-scan-executor",
      "ghcr.io/seanheiney/periscan-runner-agent",
      "ghcr.io/seanheiney/periscan-web"
    ]) {
      expect(imageWorkflow).toContain(image);
    }

    expect(imageWorkflow).toContain("periscan-api:ci");
    expect(imageWorkflow).toContain("api runtime ok");
    expect(imageWorkflow).toContain('"packages/**"');
    expect(imageWorkflow).toContain('"pnpm-lock.yaml"');
    // Production image workflow must pin the permissive-only stage.
    expect(imageWorkflow).toMatch(/file:\s*infra\/docker\/scan-executor\.Dockerfile[\s\S]*?target:\s*runtime/u);
  });

  it("keeps GPL legal-review tools out of the default scan-executor runtime stage", async () => {
    const [dockerfile, smoke, deployGuide] = await Promise.all([
      readRepoFile("infra/docker/scan-executor.Dockerfile"),
      readRepoFile("infra/docker/scan-executor-smoke.sh"),
      readRepoFile("docs/DEPLOY.md")
    ]);

    // Default stage is `runtime` and must not apt/pipx the legal-review set
    // (comments may name them as excluded — only install RUN lines matter).
    const runtimeStage = dockerfile.split("AS runtime-legal-review")[0] ?? "";
    expect(runtimeStage).toContain("AS runtime");
    const runtimeInstallLines = runtimeStage
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("#"))
      .join("\n");
    expect(runtimeInstallLines).not.toMatch(/\btestssl\.sh\b/u);
    expect(runtimeInstallLines).not.toMatch(/\bsqlmap\b/u);
    expect(runtimeInstallLines).not.toMatch(/\bnikto\b/u);
    expect(runtimeInstallLines).not.toMatch(/\bwhatweb\b/u);
    expect(runtimeInstallLines).not.toMatch(/\bscoutsuite\b/iu);
    // Permissive ffuf remains allowed in default.
    expect(runtimeInstallLines).toMatch(/\bffuf\b/u);

    // Optional lab stage still documents the opt-in path.
    expect(dockerfile).toContain("AS runtime-legal-review");
    expect(dockerfile).toMatch(/testssl\.sh sqlmap nikto whatweb/u);
    expect(dockerfile).toMatch(/pipx install scoutsuite/u);

    // Smoke + deploy docs cover absence gate and Engine Lab opt-in.
    expect(smoke).toContain("legal-review GPL tools");
    expect(smoke).toContain("PERISCAN_INCLUDE_LEGAL_REVIEW_TOOLS");
    expect(deployGuide).toContain("Legal-review tools (Engine Lab opt-in)");
    expect(deployGuide).toContain("runtime-legal-review");
  });
});
