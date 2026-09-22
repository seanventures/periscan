import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  NUCLEI_SAFE_BASELINE_TEMPLATE_FILES,
  compileWebApiScenarioVersion as compileSharedWebApiScenarioVersion,
  type WebApiScenarioCompileInput,
  type WebApiScenarioCompileResult,
  type WebApiTemplateFile
} from "@periscan/shared";

const SAFE_NUCLEI_TEMPLATE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../templates/nuclei/safe-baseline"
);

export { NUCLEI_SAFE_BASELINE_TEMPLATE_FILES };

export function readNucleiSafeBaselineTemplates(): WebApiTemplateFile[] {
  return NUCLEI_SAFE_BASELINE_TEMPLATE_FILES.map((filename) => ({
    content: readFileSync(path.join(SAFE_NUCLEI_TEMPLATE_DIR, filename), "utf8"),
    filename
  }));
}

export function compileWebApiScenarioVersion(
  raw: WebApiScenarioCompileInput
): WebApiScenarioCompileResult {
  const engine = raw.engine.trim().toLowerCase();
  if (
    engine === "nuclei" &&
    (raw.templateContents === undefined || raw.templateContents.length === 0)
  ) {
    return compileSharedWebApiScenarioVersion({
      ...raw,
      templateContents: readNucleiSafeBaselineTemplates()
    });
  }
  return compileSharedWebApiScenarioVersion(raw);
}
