import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import {
  METASPLOIT_FRAMEWORK_VERSION_PIN,
  MetasploitCheckAllowlistEntrySchema,
  compileMetasploitCheckRequest,
  type MetasploitCheckAllowlistEntry,
  type MetasploitCheckCompileResult
} from "@periscan/shared";

const AllowlistFileSchema = z.array(MetasploitCheckAllowlistEntrySchema);

const ALLOWLIST_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/metasploit/allowlisted-checks.json"
);

let cachedAllowlist: MetasploitCheckAllowlistEntry[] | null = null;

export function listAllowlistedMetasploitChecks(): MetasploitCheckAllowlistEntry[] {
  if (!cachedAllowlist) {
    const parsed: unknown = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8"));
    cachedAllowlist = AllowlistFileSchema.parse(parsed);
  }
  return cachedAllowlist;
}

export function getAllowlistedMetasploitCheck(
  checkIdOrModuleFullname: string
): MetasploitCheckAllowlistEntry | null {
  return (
    listAllowlistedMetasploitChecks().find(
      (entry) =>
        entry.checkId === checkIdOrModuleFullname ||
        entry.moduleFullname === checkIdOrModuleFullname
    ) ?? null
  );
}

export function compileAllowlistedMetasploitCheck(
  raw: unknown
): MetasploitCheckCompileResult {
  return compileMetasploitCheckRequest(raw, listAllowlistedMetasploitChecks());
}

export function reviewedMetasploitFrameworkPin(): string {
  return METASPLOIT_FRAMEWORK_VERSION_PIN;
}
