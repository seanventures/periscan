import { createHash } from "node:crypto";

import { z } from "zod";

/**
 * Version Nuclei / ZAP as BAS scenario versions (PERISCAN-589 / 591).
 * Safe profiles only. Compiling a version does not start ExternalPoA or
 * queue jobs. Digest is sha256 of the allowlisted template pack when
 * contents are bound; Wave 5 binds this onto campaign pins.
 */

export const NUCLEI_ENGINE_VERSION_PIN = "v3.8.0" as const;
export const NUCLEI_TEMPLATES_VERSION_PIN = "v10.4.4" as const;
export const ZAP_ENGINE_VERSION_PIN = "2.17.0" as const;

export const WEB_API_NUCLEI_MODULE_ID = "nuclei.external_exposure_safe" as const;
export const WEB_API_ZAP_MODULE_ID = "web.zap_baseline" as const;

export const WEB_API_SAFE_PROFILE_IDS = [
  "safe-baseline",
  "fingerprint",
  "headers",
  "metadata",
  "zap-baseline"
] as const;

export const NUCLEI_SAFE_PROFILE_IDS = [
  "safe-baseline",
  "fingerprint",
  "headers",
  "metadata"
] as const;

export const NUCLEI_SAFE_BASELINE_TEMPLATE_FILES = [
  "http-fingerprint.yaml",
  "http-security-headers.yaml",
  "public-metadata.yaml"
] as const;

export type WebApiSafeProfileId = (typeof WEB_API_SAFE_PROFILE_IDS)[number];
export type NucleiSafeProfileId = (typeof NUCLEI_SAFE_PROFILE_IDS)[number];

const nucleiSafeProfileSet = new Set<string>(NUCLEI_SAFE_PROFILE_IDS);
const zapSafeProfileSet = new Set<string>(["zap-baseline"]);

export const WebApiScenarioEngineSchema = z.enum(["nuclei", "zap"]);
export type WebApiScenarioEngine = z.infer<typeof WebApiScenarioEngineSchema>;

export const WebApiTemplateFileSchema = z.strictObject({
  content: z.string(),
  filename: z.string().min(1)
});
export type WebApiTemplateFile = z.infer<typeof WebApiTemplateFileSchema>;

export const WebApiScenarioCompileInputSchema = z.object({
  engine: z.string().min(1),
  profileId: z.string().min(1),
  templateContents: z.array(WebApiTemplateFileSchema).optional()
});
export type WebApiScenarioCompileInput = z.infer<
  typeof WebApiScenarioCompileInputSchema
>;

export const WebApiScenarioPinSchema = z.strictObject({
  nuclei: z.literal(NUCLEI_ENGINE_VERSION_PIN).optional(),
  nucleiTemplates: z.literal(NUCLEI_TEMPLATES_VERSION_PIN).optional(),
  zap: z.literal(ZAP_ENGINE_VERSION_PIN).optional()
});
export type WebApiScenarioPin = z.infer<typeof WebApiScenarioPinSchema>;

const Sha256HexSchema = z.string().regex(/^[a-f0-9]{64}$/u);

export const WebApiScenarioVersionSchema = z.strictObject({
  communityPrimaryStart: z.literal(false),
  contentBound: z.boolean(),
  engine: WebApiScenarioEngineSchema,
  executable: z.literal(true),
  jobsQueued: z.literal(0),
  pin: WebApiScenarioPinSchema,
  profileId: z.enum(WEB_API_SAFE_PROFILE_IDS),
  spdxLicenseId: z.enum(["MIT", "Apache-2.0"]),
  startsExternalPoa: z.literal(false),
  templateDigest: Sha256HexSchema
});
export type WebApiScenarioVersion = z.infer<typeof WebApiScenarioVersionSchema>;

export const WebApiScenarioDenialCodeSchema = z.enum([
  "nuclei_profile_not_allowlisted",
  "zap_profile_not_allowlisted",
  "web_api_engine_not_allowlisted"
]);
export type WebApiScenarioDenialCode = z.infer<
  typeof WebApiScenarioDenialCodeSchema
>;

export const WebApiScenarioCompileSuccessSchema = z.strictObject({
  ok: z.literal(true),
  version: WebApiScenarioVersionSchema
});

export const WebApiScenarioCompileDenialSchema = z.strictObject({
  code: WebApiScenarioDenialCodeSchema,
  executable: z.literal(false),
  jobsQueued: z.literal(0),
  liveSupported: z.literal(false),
  ok: z.literal(false),
  startsExternalPoa: z.literal(false)
});

export const WebApiScenarioCompileResultSchema = z.discriminatedUnion("ok", [
  WebApiScenarioCompileSuccessSchema,
  WebApiScenarioCompileDenialSchema
]);
export type WebApiScenarioCompileResult = z.infer<
  typeof WebApiScenarioCompileResultSchema
>;

export function digestWebApiTemplatePack(
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

function deny(code: WebApiScenarioDenialCode): WebApiScenarioCompileResult {
  return {
    code,
    executable: false,
    jobsQueued: 0,
    liveSupported: false,
    ok: false,
    startsExternalPoa: false
  };
}

function zapBaselineDigest(): string {
  return createHash("sha256")
    .update(`zap\n${ZAP_ENGINE_VERSION_PIN}\nzap-baseline\n`)
    .digest("hex");
}

function resolveNucleiTemplates(
  templateContents: WebApiTemplateFile[] | undefined
): { contentBound: boolean; files: WebApiTemplateFile[] } {
  if (templateContents && templateContents.length > 0) {
    return { contentBound: true, files: templateContents };
  }
  return {
    contentBound: false,
    files: NUCLEI_SAFE_BASELINE_TEMPLATE_FILES.map((filename) => ({
      content: "",
      filename
    }))
  };
}

export function compileWebApiScenarioVersion(
  raw: unknown
): WebApiScenarioCompileResult {
  const parsed = WebApiScenarioCompileInputSchema.safeParse(raw);
  if (!parsed.success) {
    return deny("web_api_engine_not_allowlisted");
  }

  const engine = parsed.data.engine.trim().toLowerCase();
  const profileId = parsed.data.profileId.trim().toLowerCase();

  if (engine !== "nuclei" && engine !== "zap") {
    return deny("web_api_engine_not_allowlisted");
  }

  if (engine === "nuclei") {
    if (!nucleiSafeProfileSet.has(profileId)) {
      return deny("nuclei_profile_not_allowlisted");
    }
    const templates = resolveNucleiTemplates(parsed.data.templateContents);
    return {
      ok: true,
      version: {
        communityPrimaryStart: false,
        contentBound: templates.contentBound,
        engine: "nuclei",
        executable: true,
        jobsQueued: 0,
        pin: {
          nuclei: NUCLEI_ENGINE_VERSION_PIN,
          nucleiTemplates: NUCLEI_TEMPLATES_VERSION_PIN
        },
        profileId: profileId as NucleiSafeProfileId,
        spdxLicenseId: "MIT",
        startsExternalPoa: false,
        templateDigest: digestWebApiTemplatePack(templates.files)
      }
    };
  }

  if (!zapSafeProfileSet.has(profileId)) {
    return deny("zap_profile_not_allowlisted");
  }

  return {
    ok: true,
    version: {
      communityPrimaryStart: false,
      contentBound: false,
      engine: "zap",
      executable: true,
      jobsQueued: 0,
      pin: { zap: ZAP_ENGINE_VERSION_PIN },
      profileId: "zap-baseline",
      spdxLicenseId: "Apache-2.0",
      startsExternalPoa: false,
      templateDigest: zapBaselineDigest()
    }
  };
}
