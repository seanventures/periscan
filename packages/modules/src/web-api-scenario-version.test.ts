import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  NUCLEI_ENGINE_VERSION_PIN,
  NUCLEI_TEMPLATES_VERSION_PIN,
  ZAP_ENGINE_VERSION_PIN
} from "@periscan/shared";

import {
  NUCLEI_SAFE_BASELINE_TEMPLATE_FILES,
  compileWebApiScenarioVersion,
  readNucleiSafeBaselineTemplates
} from "./web-api-scenario-version.js";
import { getOpenSourceToolDefinition } from "./toolchain.js";

const TEMPLATE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../templates/nuclei/safe-baseline"
);

function independentPackDigest(
  files: ReadonlyArray<{ content: string; filename: string }>
): string {
  const hash = createHash("sha256");
  for (const file of [...files].sort((a, b) =>
    a.filename.localeCompare(b.filename)
  )) {
    hash.update(`${file.filename}\n`);
    hash.update(file.content);
    if (!file.content.endsWith("\n")) {
      hash.update("\n");
    }
  }
  return hash.digest("hex");
}

describe("pinned Nuclei/ZAP web/API scenario versions (PERISCAN-589/591)", () => {
  it("pins safe-baseline templates to a stable digest and rejects a fuzz profile", () => {
    const v = compileWebApiScenarioVersion({
      engine: "nuclei",
      profileId: "safe-baseline"
    });
    expect(v.ok).toBe(true);
    if (!v.ok) {
      return;
    }
    expect(v.version.pin.nuclei).toBe("v3.8.0");
    expect(v.version.templateDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(
      compileWebApiScenarioVersion({ engine: "nuclei", profileId: "fuzzing" }).ok
    ).toBe(false);
  });

  it("hashes the three in-repo safe-baseline YAML files and matches toolchain pins", () => {
    expect(NUCLEI_SAFE_BASELINE_TEMPLATE_FILES).toEqual([
      "http-fingerprint.yaml",
      "http-security-headers.yaml",
      "public-metadata.yaml"
    ]);

    const fromDisk = NUCLEI_SAFE_BASELINE_TEMPLATE_FILES.map((filename) => ({
      content: readFileSync(path.join(TEMPLATE_DIR, filename), "utf8"),
      filename
    }));
    const compiled = compileWebApiScenarioVersion({
      engine: "nuclei",
      profileId: "safe-baseline"
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      return;
    }

    expect(readNucleiSafeBaselineTemplates()).toEqual(fromDisk);
    expect(compiled.version.templateDigest).toBe(
      independentPackDigest(fromDisk)
    );
    expect(compiled.version.templateDigest).toBe(
      "01bb789b24f70c4fd25482cd0057b5a4535e02cd4a1d4bea807f79b50863ddff"
    );
    expect(compiled.version.pin.nuclei).toBe(NUCLEI_ENGINE_VERSION_PIN);
    expect(compiled.version.pin.nucleiTemplates).toBe(
      NUCLEI_TEMPLATES_VERSION_PIN
    );
    expect(compiled.version.contentBound).toBe(true);
    expect(compiled.version.executable).toBe(true);

    const nuclei = getOpenSourceToolDefinition("nuclei");
    const templates = getOpenSourceToolDefinition("nuclei-templates");
    const zap = getOpenSourceToolDefinition("zaproxy");
    expect(nuclei?.defaultVersion).toBe("v3.8.0");
    expect(templates?.defaultVersion).toBe("v10.4.4");
    expect(zap?.defaultVersion).toBe("2.17.0");
    expect(zap?.defaultVersion).toBe(ZAP_ENGINE_VERSION_PIN);
  });

  it("changes the digest when a safe-baseline template changes", () => {
    const original = compileWebApiScenarioVersion({
      engine: "nuclei",
      profileId: "safe-baseline"
    });
    const templates = readNucleiSafeBaselineTemplates();
    const mutated = compileWebApiScenarioVersion({
      engine: "nuclei",
      profileId: "safe-baseline",
      templateContents: templates.map((file, index) =>
        index === 0
          ? { ...file, content: `${file.content}# digest-invalidation\n` }
          : file
      )
    });

    expect(original.ok).toBe(true);
    expect(mutated.ok).toBe(true);
    if (!original.ok || !mutated.ok) {
      return;
    }
    expect(mutated.version.templateDigest).not.toBe(
      original.version.templateDigest
    );
    expect(mutated.version.templateDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it("compiles zap-baseline from the exact 2.17.0 pin and rejects attack profiles", () => {
    const baseline = compileWebApiScenarioVersion({
      engine: "zap",
      profileId: "zap-baseline"
    });
    expect(baseline.ok).toBe(true);
    if (!baseline.ok) {
      return;
    }
    expect(baseline.version.pin.zap).toBe("2.17.0");
    expect(baseline.version.executable).toBe(true);
    expect(
      compileWebApiScenarioVersion({ engine: "zap", profileId: "attack" }).ok
    ).toBe(false);
    expect(
      compileWebApiScenarioVersion({
        engine: "zap",
        profileId: "spider-ajax"
      }).ok
    ).toBe(false);
  });
});
