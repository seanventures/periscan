import {
  NUCLEI_ENGINE_VERSION_PIN,
  NUCLEI_TEMPLATES_VERSION_PIN,
  WEB_API_NUCLEI_MODULE_ID,
  WEB_API_ZAP_MODULE_ID,
  ZAP_ENGINE_VERSION_PIN,
  compileWebApiScenarioVersion,
  type WebApiScenarioEngine
} from "@periscan/shared";

/**
 * Nuclei safe-exposure / ZAP baseline qualified start.
 *
 * Import/safe-scan plan only. Not live exploit. Compile still does not
 * queue. Not Community first-hour (Gitleaks stays the first-hour door).
 */

export const NUCLEI_SAFE_EXPOSURE_MODULE_ID = WEB_API_NUCLEI_MODULE_ID;
export const ZAP_BASELINE_MODULE_ID = WEB_API_ZAP_MODULE_ID;

export const NUCLEI_ZAP_NOT_STARTABLE = "nuclei_zap_not_startable";
export const NUCLEI_ZAP_QUALIFICATION_REQUIRED =
  "nuclei_zap_qualification_required";
export const NUCLEI_ZAP_AUTHORIZATION_REQUIRED =
  "nuclei_zap_authorization_required";
export const NUCLEI_ZAP_POLICY_NOT_ALLOWED = "nuclei_zap_policy_not_allowed";
export const NUCLEI_ZAP_COMMUNITY_DEFAULT_DENIED =
  "nuclei_zap_community_default_denied";
export const NUCLEI_ZAP_COMMUNITY_FIRST_HOUR_DENIED =
  "nuclei_zap_community_first_hour_denied";
export const NUCLEI_ZAP_EXPLOIT_TEMPLATE_DENIED =
  "nuclei_zap_exploit_template_denied";
export const NUCLEI_ZAP_INTERNET_WIDE_DENIED =
  "nuclei_zap_internet_wide_denied";
export const NUCLEI_ZAP_LIVE_EXPLOIT_DENIED = "nuclei_zap_live_exploit_denied";

const LIVE_OFFENSIVE_SCENARIO_IDS = new Set([
  "nuclei.live",
  "nuclei.exploit",
  "nuclei.live_exploit",
  "zap.live",
  "zap.attack",
  "zap.exploit"
]);

const EXPLOIT_OR_INTRUSIVE_PROFILES = new Set([
  "attack",
  "cves",
  "dos",
  "exploit",
  "exploits",
  "fuzzing",
  "intrusive",
  "nikto",
  "spider-ajax",
  "sqlmap"
]);

const INTERNET_WIDE_PROFILES = new Set([
  "internet-wide",
  "internet_wide",
  "internetwide",
  "wildcard"
]);

export type NucleiZapQualifiedStartInput = {
  communityDefaultPack?: boolean;
  communityFirstHour?: boolean;
  engine: WebApiScenarioEngine | string;
  exploitTemplates?: boolean;
  internetWide?: boolean;
  liveExploit?: boolean;
  liveOffensive?: boolean;
  liveOffensiveEnv?: string | null;
  policyOutcome?: string | null;
  profileId?: string;
  qualified?: boolean;
  scenarioId?: string;
  startable: boolean;
  tenantAuthorized?: boolean;
};

export type NucleiZapSafeScanPlan = {
  engine: WebApiScenarioEngine;
  executed: false;
  executable: false;
  importOnly: true;
  kind: "import-safe-scan";
  liveSupported: false;
  moduleId: typeof WEB_API_NUCLEI_MODULE_ID | typeof WEB_API_ZAP_MODULE_ID;
  pin: {
    nuclei?: typeof NUCLEI_ENGINE_VERSION_PIN;
    nucleiTemplates?: typeof NUCLEI_TEMPLATES_VERSION_PIN;
    zap?: typeof ZAP_ENGINE_VERSION_PIN;
  };
  profileId: string;
  startsExternalPoa: false;
};

export type NucleiZapQualifiedStartResult = {
  allowed: boolean;
  code: string | null;
  communityDefaultPack: false;
  communityFirstHour: false;
  communityPrimaryStart: false;
  denyCode: string | null;
  denyReason: string | null;
  executed: false;
  executable: false;
  importOnly: true;
  jobsQueued: number;
  liveSupported: false;
  moduleId:
    | typeof WEB_API_NUCLEI_MODULE_ID
    | typeof WEB_API_ZAP_MODULE_ID
    | null;
  queued: boolean;
  recorded: boolean;
  safeScanPlan: NucleiZapSafeScanPlan | null;
  startsExternalPoa: false;
};

function normalizeEngine(value: string): WebApiScenarioEngine | null {
  const engine = value.trim().toLowerCase();
  if (engine === "nuclei" || engine === "zap") {
    return engine;
  }
  return null;
}

function defaultProfile(engine: WebApiScenarioEngine): string {
  return engine === "zap" ? "zap-baseline" : "safe-baseline";
}

function moduleIdFor(
  engine: WebApiScenarioEngine | null
): typeof WEB_API_NUCLEI_MODULE_ID | typeof WEB_API_ZAP_MODULE_ID | null {
  if (engine === "zap") {
    return WEB_API_ZAP_MODULE_ID;
  }
  if (engine === "nuclei") {
    return WEB_API_NUCLEI_MODULE_ID;
  }
  return null;
}

function profileOf(input: NucleiZapQualifiedStartInput): string {
  const profile = input.profileId?.trim().toLowerCase();
  if (profile) {
    return profile;
  }
  const engine = normalizeEngine(input.engine);
  return engine ? defaultProfile(engine) : "";
}

function isLiveOffensivePin(input: NucleiZapQualifiedStartInput): boolean {
  if (input.liveExploit === true || input.liveOffensive === true) {
    return true;
  }
  return Boolean(
    input.scenarioId && LIVE_OFFENSIVE_SCENARIO_IDS.has(input.scenarioId)
  );
}

function isExploitTemplatePin(input: NucleiZapQualifiedStartInput): boolean {
  if (input.exploitTemplates === true) {
    return true;
  }
  return EXPLOIT_OR_INTRUSIVE_PROFILES.has(profileOf(input));
}

function isInternetWidePin(input: NucleiZapQualifiedStartInput): boolean {
  if (input.internetWide === true) {
    return true;
  }
  return INTERNET_WIDE_PROFILES.has(profileOf(input));
}

function denyRationale(code: string): string {
  switch (code) {
    case NUCLEI_ZAP_COMMUNITY_DEFAULT_DENIED:
      return "Nuclei/ZAP safe-exposure is a second mission, not the Community default pack. Denied tasks are never queued.";
    case NUCLEI_ZAP_COMMUNITY_FIRST_HOUR_DENIED:
      return "Community first hour is Gitleaks-class secrets. Nuclei/ZAP is not the first-hour door. Denied tasks are never queued.";
    case NUCLEI_ZAP_LIVE_EXPLOIT_DENIED:
      return "Nuclei/ZAP live exploit is default-deny. Import/safe-scan is not executed coverage. Denied tasks are never queued.";
    case NUCLEI_ZAP_EXPLOIT_TEMPLATE_DENIED:
      return "Nuclei exploit templates and ZAP attack profiles are default-deny. Denied tasks are never queued.";
    case NUCLEI_ZAP_INTERNET_WIDE_DENIED:
      return "Internet-wide Nuclei/ZAP scanning is default-deny. Denied tasks are never queued.";
    case NUCLEI_ZAP_NOT_STARTABLE:
      return "Nuclei/ZAP import/safe-scan is not startable. Denied tasks are never queued.";
    case NUCLEI_ZAP_QUALIFICATION_REQUIRED:
      return "Nuclei/ZAP import/safe-scan requires adapter qualification. Denied tasks are never queued.";
    case NUCLEI_ZAP_AUTHORIZATION_REQUIRED:
      return "Nuclei/ZAP import/safe-scan requires tenant authorization. Denied tasks are never queued.";
    case NUCLEI_ZAP_POLICY_NOT_ALLOWED:
      return "Nuclei/ZAP import/safe-scan requires an Allowed policy decision. Denied tasks are never queued.";
    default:
      return "Nuclei/ZAP import/safe-scan was not queued.";
  }
}

function deniedQueue(
  code: string,
  engine: WebApiScenarioEngine | null
): NucleiZapQualifiedStartResult {
  return {
    allowed: false,
    code,
    communityDefaultPack: false,
    communityFirstHour: false,
    communityPrimaryStart: false,
    denyCode: code,
    denyReason: denyRationale(code),
    executed: false,
    executable: false,
    importOnly: true,
    jobsQueued: 0,
    liveSupported: false,
    moduleId: moduleIdFor(engine),
    queued: false,
    recorded: false,
    safeScanPlan: null,
    startsExternalPoa: false
  };
}

function queuedPlan(
  engine: WebApiScenarioEngine,
  profileId: string
): NucleiZapQualifiedStartResult {
  const moduleId = moduleIdFor(engine);
  if (!moduleId) {
    return deniedQueue(NUCLEI_ZAP_NOT_STARTABLE, engine);
  }
  const pin =
    engine === "zap"
      ? { zap: ZAP_ENGINE_VERSION_PIN }
      : {
          nuclei: NUCLEI_ENGINE_VERSION_PIN,
          nucleiTemplates: NUCLEI_TEMPLATES_VERSION_PIN
        };
  const safeScanPlan: NucleiZapSafeScanPlan = {
    engine,
    executed: false,
    executable: false,
    importOnly: true,
    kind: "import-safe-scan",
    liveSupported: false,
    moduleId,
    pin,
    profileId,
    startsExternalPoa: false
  };
  return {
    allowed: true,
    code: null,
    communityDefaultPack: false,
    communityFirstHour: false,
    communityPrimaryStart: false,
    denyCode: null,
    denyReason: null,
    executed: false,
    executable: false,
    importOnly: true,
    jobsQueued: 1,
    liveSupported: false,
    moduleId,
    queued: true,
    recorded: true,
    safeScanPlan,
    startsExternalPoa: false
  };
}

export function queueNucleiZapQualifiedStart(
  input: NucleiZapQualifiedStartInput
): NucleiZapQualifiedStartResult {
  const engine = normalizeEngine(input.engine);

  if (input.communityDefaultPack === true) {
    return deniedQueue(NUCLEI_ZAP_COMMUNITY_DEFAULT_DENIED, engine);
  }
  if (input.communityFirstHour === true) {
    return deniedQueue(NUCLEI_ZAP_COMMUNITY_FIRST_HOUR_DENIED, engine);
  }
  if (isLiveOffensivePin(input)) {
    return deniedQueue(NUCLEI_ZAP_LIVE_EXPLOIT_DENIED, engine);
  }
  if (isExploitTemplatePin(input)) {
    return deniedQueue(NUCLEI_ZAP_EXPLOIT_TEMPLATE_DENIED, engine);
  }
  if (isInternetWidePin(input)) {
    return deniedQueue(NUCLEI_ZAP_INTERNET_WIDE_DENIED, engine);
  }
  if (input.startable !== true) {
    return deniedQueue(NUCLEI_ZAP_NOT_STARTABLE, engine);
  }
  if (input.qualified !== true) {
    return deniedQueue(NUCLEI_ZAP_QUALIFICATION_REQUIRED, engine);
  }
  if (input.tenantAuthorized !== true) {
    return deniedQueue(NUCLEI_ZAP_AUTHORIZATION_REQUIRED, engine);
  }
  if (input.policyOutcome !== "Allowed") {
    return deniedQueue(NUCLEI_ZAP_POLICY_NOT_ALLOWED, engine);
  }
  if (!engine) {
    return deniedQueue("web_api_engine_not_allowlisted", null);
  }

  const profileId = profileOf(input) || defaultProfile(engine);
  const compiled = compileWebApiScenarioVersion({
    engine,
    profileId
  });
  if (!compiled.ok) {
    return deniedQueue(compiled.code, engine);
  }

  return queuedPlan(compiled.version.engine, compiled.version.profileId);
}
