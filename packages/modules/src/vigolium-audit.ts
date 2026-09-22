import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Vigolium agentic audit import.
 *
 * Upstream SPDX is AGPL-3.0 (verified 2026-09-17 against github.com/vigolium/vigolium
 * LICENSE). AGPL is Blocked for redistribution — not Community pack, not
 * installable. Import audit JSON only. Live attack planning is default-deny.
 * Verified authorized scope and qualification required to queue an
 * import-only audit plan. Import is not executed coverage.
 */

export const VIGOLIUM_MODULE_ID = "vigolium.audit_import";
export const VIGOLIUM_PARSER = "periscan.vigolium.v1";
export const VIGOLIUM_SPDX_LICENSE_ID = "AGPL-3.0";
export const VIGOLIUM_TOOL_ID = "vigolium";
export const VIGOLIUM_FIXTURE_FILE = "vigolium/vigolium-fixture.json";

/** AGPL-3.0 is Blocked (never installable). Not a RequiresLegalReview path. */
export const VIGOLIUM_LICENSE = {
  collectorExecutable: false,
  disposition: "Blocked",
  installable: false,
  redistributableInDefaultPack: false,
  spdxLicenseId: VIGOLIUM_SPDX_LICENSE_ID,
  toolId: VIGOLIUM_TOOL_ID
} as const;

export const VIGOLIUM_LIVE_ATTACK_PLANNING_DENIED =
  "vigolium_live_attack_planning_denied";
export const VIGOLIUM_VERIFIED_SCOPE_REQUIRED =
  "vigolium_verified_scope_required";
export const VIGOLIUM_AUTHORIZATION_REQUIRED =
  "vigolium_authorization_required";
export const VIGOLIUM_QUALIFICATION_REQUIRED =
  "vigolium_qualification_required";
export const VIGOLIUM_NOT_STARTABLE = "vigolium_not_startable";
export const VIGOLIUM_POLICY_NOT_ALLOWED = "vigolium_policy_not_allowed";
export const VIGOLIUM_COMMUNITY_DEFAULT_DENIED =
  "vigolium_community_default_denied";

const FIXTURE_URL = new URL(
  "../fixtures/vigolium/vigolium-fixture.json",
  import.meta.url
);

export type VigoliumFinding = {
  cwe: string | null;
  file: string | null;
  id: string;
  severity: string | null;
  title: string;
};

export type VigoliumImportResult = {
  findings: VigoliumFinding[];
  invented: false;
  liveAttackPlanning: false;
  liveSupported: false;
  parser: typeof VIGOLIUM_PARSER;
};

export type VigoliumStartInput = {
  authorized?: boolean;
  liveAttackPlanning?: boolean;
  liveOffensiveEnv?: string | null;
  qualified?: boolean;
  verifiedScope?: boolean;
};

export type VigoliumStartResult = {
  allowed: boolean;
  code: string | null;
  communityDefaultPack: false;
  communityStart: false;
  executed: false;
  installable: false;
  jobsQueued: number;
  liveAttackPlanning: false;
  liveSupported: false;
  moduleId: typeof VIGOLIUM_MODULE_ID;
  policyStatus: "Blocked";
  spdxLicenseId: typeof VIGOLIUM_SPDX_LICENSE_ID;
};

export type VigoliumAuditPlan = {
  executed: false;
  findingIds: string[];
  importOnly: true;
  kind: "import-only-audit";
  liveAttackPlanning: false;
  liveSupported: false;
  moduleId: typeof VIGOLIUM_MODULE_ID;
  parser: typeof VIGOLIUM_PARSER;
};

export type VigoliumQualifiedStartInput = {
  authorized?: boolean;
  communityDefaultPack?: boolean;
  fixtureMode?: boolean;
  json?: unknown;
  liveAttackPlanning?: boolean;
  liveOffensiveEnv?: string | null;
  policyOutcome?: string | null;
  qualified?: boolean;
  raw?: string;
  startable?: boolean;
  verifiedScope?: boolean;
};

export type VigoliumQualifiedStartResult = {
  allowed: boolean;
  auditPlan: VigoliumAuditPlan | null;
  code: string | null;
  communityDefaultPack: false;
  communityStart: false;
  executed: false;
  findings: VigoliumFinding[];
  importOnly: true;
  installable: false;
  jobsQueued: number;
  license: typeof VIGOLIUM_LICENSE;
  liveAttackPlanning: false;
  liveSupported: false;
  moduleId: typeof VIGOLIUM_MODULE_ID;
  policyStatus: "Blocked";
  queued: boolean;
  recorded: boolean;
  spdxLicenseId: typeof VIGOLIUM_SPDX_LICENSE_ID;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asFinding(row: unknown): VigoliumFinding | null {
  if (!isRecord(row)) {
    return null;
  }
  const id = asString(row.id);
  const title = asString(row.title);
  if (!id || !title) {
    return null;
  }
  return {
    cwe: asString(row.cwe),
    file: asString(row.file),
    id,
    severity: asString(row.severity),
    title
  };
}

function rowsFromUnknown(json: unknown): unknown[] {
  if (Array.isArray(json)) {
    return json;
  }
  if (!isRecord(json)) {
    return [];
  }
  if (Array.isArray(json.findings)) {
    return json.findings;
  }
  if (Array.isArray(json.results)) {
    return json.results;
  }
  return [];
}

export function mapVigoliumFindings(json: unknown): VigoliumFinding[] {
  return rowsFromUnknown(json).flatMap((row) => {
    const finding = asFinding(row);
    return finding ? [finding] : [];
  });
}

function parseRaw(raw: string | undefined): unknown {
  if (raw == null) {
    return undefined;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return {};
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

export function loadVigoliumFixture(): unknown {
  return JSON.parse(readFileSync(fileURLToPath(FIXTURE_URL), "utf8"));
}

export function importVigoliumFindings(
  input: {
    fixtureMode?: boolean;
    json?: unknown;
    raw?: string;
  } = {}
): VigoliumImportResult {
  let json: unknown;
  if (input.raw !== undefined) {
    json = parseRaw(input.raw);
  } else if (input.json !== undefined) {
    json = input.json;
  } else if (input.fixtureMode === true) {
    json = loadVigoliumFixture();
  } else {
    json = {};
  }
  return {
    findings: mapVigoliumFindings(json),
    invented: false,
    liveAttackPlanning: false,
    liveSupported: false,
    parser: VIGOLIUM_PARSER
  };
}

function deny(code: string): VigoliumStartResult {
  return {
    allowed: false,
    code,
    communityDefaultPack: false,
    communityStart: false,
    executed: false,
    installable: false,
    jobsQueued: 0,
    liveAttackPlanning: false,
    liveSupported: false,
    moduleId: VIGOLIUM_MODULE_ID,
    policyStatus: "Blocked",
    spdxLicenseId: VIGOLIUM_SPDX_LICENSE_ID
  };
}

export function evaluateVigoliumStart(
  input: VigoliumStartInput = {}
): VigoliumStartResult {
  if (input.liveAttackPlanning === true) {
    return deny(VIGOLIUM_LIVE_ATTACK_PLANNING_DENIED);
  }
  if (input.verifiedScope !== true) {
    return deny(VIGOLIUM_VERIFIED_SCOPE_REQUIRED);
  }
  if (input.authorized !== true) {
    return deny(VIGOLIUM_AUTHORIZATION_REQUIRED);
  }
  if (input.qualified !== true) {
    return deny(VIGOLIUM_QUALIFICATION_REQUIRED);
  }
  return {
    allowed: true,
    code: null,
    communityDefaultPack: false,
    communityStart: false,
    executed: false,
    installable: false,
    jobsQueued: 1,
    liveAttackPlanning: false,
    liveSupported: false,
    moduleId: VIGOLIUM_MODULE_ID,
    policyStatus: "Blocked",
    spdxLicenseId: VIGOLIUM_SPDX_LICENSE_ID
  };
}

function denyQueue(code: string): VigoliumQualifiedStartResult {
  return {
    allowed: false,
    auditPlan: null,
    code,
    communityDefaultPack: false,
    communityStart: false,
    executed: false,
    findings: [],
    importOnly: true,
    installable: false,
    jobsQueued: 0,
    license: VIGOLIUM_LICENSE,
    liveAttackPlanning: false,
    liveSupported: false,
    moduleId: VIGOLIUM_MODULE_ID,
    policyStatus: "Blocked",
    queued: false,
    recorded: false,
    spdxLicenseId: VIGOLIUM_SPDX_LICENSE_ID
  };
}

export function queueVigoliumImportStart(
  input: VigoliumQualifiedStartInput = {}
): VigoliumQualifiedStartResult {
  if (input.communityDefaultPack === true) {
    return denyQueue(VIGOLIUM_COMMUNITY_DEFAULT_DENIED);
  }
  if (input.liveAttackPlanning === true) {
    return denyQueue(VIGOLIUM_LIVE_ATTACK_PLANNING_DENIED);
  }
  if (input.startable !== true) {
    return denyQueue(VIGOLIUM_NOT_STARTABLE);
  }
  if (input.qualified !== true) {
    return denyQueue(VIGOLIUM_QUALIFICATION_REQUIRED);
  }
  if (input.verifiedScope !== true) {
    return denyQueue(VIGOLIUM_VERIFIED_SCOPE_REQUIRED);
  }
  if (input.authorized !== true) {
    return denyQueue(VIGOLIUM_AUTHORIZATION_REQUIRED);
  }
  if (input.policyOutcome !== "Allowed") {
    return denyQueue(VIGOLIUM_POLICY_NOT_ALLOWED);
  }

  const imported = importVigoliumFindings({
    fixtureMode: input.fixtureMode,
    json: input.json,
    raw: input.raw
  });
  const findingIds = imported.findings.map((finding) => finding.id);

  return {
    allowed: true,
    auditPlan: {
      executed: false,
      findingIds,
      importOnly: true,
      kind: "import-only-audit",
      liveAttackPlanning: false,
      liveSupported: false,
      moduleId: VIGOLIUM_MODULE_ID,
      parser: VIGOLIUM_PARSER
    },
    code: null,
    communityDefaultPack: false,
    communityStart: false,
    executed: false,
    findings: imported.findings,
    importOnly: true,
    installable: false,
    jobsQueued: 1,
    license: VIGOLIUM_LICENSE,
    liveAttackPlanning: false,
    liveSupported: false,
    moduleId: VIGOLIUM_MODULE_ID,
    policyStatus: "Blocked",
    queued: true,
    recorded: true,
    spdxLicenseId: VIGOLIUM_SPDX_LICENSE_ID
  };
}
