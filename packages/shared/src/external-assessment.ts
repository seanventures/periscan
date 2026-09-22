import { z } from "zod";

import { isContinuousEasmSafeModuleId } from "./continuous-easm";
import {
  NUCLEI_ENGINE_VERSION_PIN,
  NUCLEI_TEMPLATES_VERSION_PIN,
  compileWebApiScenarioVersion
} from "./web-api-scenario-version";

/**
 * Competitive internet-facing assessment on verified Domain.
 * Compile never queues. Start (API service) queues ExternalPoA/ControlPlane
 * jobs for allowlisted safe profiles only.
 */

export const EXTERNAL_ASSESSMENT_PRODUCT_COPY =
  "Internet-facing assessment of a verified domain. Not a full ASV platform in a box.";

export const EXTERNAL_ASSESSMENT_PROFILE_IDS = [
  "internet-facing",
  "safe-baseline",
  "fingerprint",
  "headers",
  "metadata"
] as const;

export type ExternalAssessmentProfileId =
  (typeof EXTERNAL_ASSESSMENT_PROFILE_IDS)[number];

export const EXTERNAL_ASSESSMENT_DENIED_PROFILE_IDS = [
  "fuzzing",
  "dos",
  "sqlmap",
  "nikto",
  "intrusive",
  "exploit"
] as const;

export const EXTERNAL_ASSESSMENT_TOOLCHAIN = [
  { moduleId: "recon.subdomain_enum", toolId: "subfinder" },
  { moduleId: "recon.http_probe", toolId: "httpx" },
  { moduleId: "recon.dns_probe", toolId: "dnsx" },
  { moduleId: "nuclei.external_exposure_safe", toolId: "nuclei" },
  { moduleId: "tlsx.tls_probe", toolId: "tlsx" }
] as const;

export const EXTERNAL_ASSESSMENT_START_JOBS = [
  {
    executionEnvironment: "ExternalPoA",
    moduleId: "nuclei.external_exposure_safe"
  },
  {
    executionEnvironment: "ControlPlane",
    moduleId: "periscan.dns_resolution_check"
  },
  {
    executionEnvironment: "ControlPlane",
    moduleId: "periscan.http_health_check"
  },
  {
    executionEnvironment: "ControlPlane",
    moduleId: "periscan.tls_certificate_check"
  }
] as const;

export type ExternalAssessmentJobEnvironment = "ExternalPoA" | "ControlPlane";

const allowlistedProfileSet = new Set<string>(EXTERNAL_ASSESSMENT_PROFILE_IDS);

export const ExternalAssessmentCompileInputSchema = z.object({
  consent: z.literal(true).optional(),
  profileId: z.string().min(1),
  scopeId: z.string().uuid().optional()
});
export type ExternalAssessmentCompileInput = z.infer<
  typeof ExternalAssessmentCompileInputSchema
>;

export const ExternalAssessmentToolSchema = z.strictObject({
  moduleId: z.string().min(1),
  toolId: z.string().min(1)
});

export const ExternalAssessmentStartJobSchema = z.strictObject({
  executionEnvironment: z.enum(["ExternalPoA", "ControlPlane"]),
  moduleId: z.string().min(1)
});

export const ExternalAssessmentCompiledSchema = z.strictObject({
  alwaysOnBas: z.literal(false),
  executable: z.literal(true),
  jobsQueued: z.literal(0),
  liveAtomic: z.literal(false),
  nucleiPin: z.literal(NUCLEI_ENGINE_VERSION_PIN),
  nucleiTemplatesPin: z.literal(NUCLEI_TEMPLATES_VERSION_PIN),
  productCopy: z.literal(EXTERNAL_ASSESSMENT_PRODUCT_COPY),
  profileId: z.enum(EXTERNAL_ASSESSMENT_PROFILE_IDS),
  startJobs: z.array(ExternalAssessmentStartJobSchema).min(1),
  startsJobs: z.literal(false),
  templateProfile: z.string().min(1),
  tools: z.array(ExternalAssessmentToolSchema).min(1)
});
export type ExternalAssessmentCompiled = z.infer<
  typeof ExternalAssessmentCompiledSchema
>;

export const ExternalAssessmentCompileSuccessSchema = z.strictObject({
  assessment: ExternalAssessmentCompiledSchema,
  ok: z.literal(true)
});

export const ExternalAssessmentDenialCodeSchema = z.enum([
  "external_assessment_profile_not_allowlisted",
  "consent_required",
  "verified_domain_required",
  "scope_not_found"
]);
export type ExternalAssessmentDenialCode = z.infer<
  typeof ExternalAssessmentDenialCodeSchema
>;

export const ExternalAssessmentCompileDenialSchema = z.strictObject({
  code: ExternalAssessmentDenialCodeSchema,
  executable: z.literal(false),
  jobsQueued: z.literal(0),
  ok: z.literal(false),
  startsJobs: z.literal(false)
});

export const ExternalAssessmentCompileResultSchema = z.discriminatedUnion(
  "ok",
  [
    ExternalAssessmentCompileSuccessSchema,
    ExternalAssessmentCompileDenialSchema
  ]
);
export type ExternalAssessmentCompileResult = z.infer<
  typeof ExternalAssessmentCompileResultSchema
>;

export const ExternalAssessmentStartInputSchema = z.object({
  consent: z.literal(true),
  profileId: z.string().min(1),
  scopeId: z.string().uuid()
});
export type ExternalAssessmentStartInput = z.infer<
  typeof ExternalAssessmentStartInputSchema
>;

export const ExternalAssessmentStartSuccessSchema = z.strictObject({
  jobs: z.array(ExternalAssessmentStartJobSchema),
  jobsQueued: z.number().int().nonnegative(),
  liveAtomic: z.literal(false),
  missionIds: z.array(z.string().uuid()),
  ok: z.literal(true),
  productCopy: z.literal(EXTERNAL_ASSESSMENT_PRODUCT_COPY),
  runnerTasksQueued: z.literal(0)
});

export const ExternalAssessmentStartResultSchema = z.discriminatedUnion("ok", [
  ExternalAssessmentStartSuccessSchema,
  ExternalAssessmentCompileDenialSchema
]);
export type ExternalAssessmentStartResult = z.infer<
  typeof ExternalAssessmentStartResultSchema
>;

export const ExternalAssessmentAttachScheduleInputSchema = z.object({
  frequency: z.enum(["Daily", "Weekly", "Monthly"]).default("Weekly"),
  profileId: z.string().min(1),
  scopeId: z.string().uuid()
});
export type ExternalAssessmentAttachScheduleInput = z.infer<
  typeof ExternalAssessmentAttachScheduleInputSchema
>;

export const ExternalAssessmentSchedulePlanSchema = z.strictObject({
  alwaysOnBas: z.literal(false),
  config: z.strictObject({
    moduleIds: z.array(z.string().min(1)).min(1),
    profileId: z.enum(EXTERNAL_ASSESSMENT_PROFILE_IDS)
  }),
  frequency: z.enum(["Daily", "Weekly", "Monthly"]),
  honesty: z.string().min(1),
  jobsQueued: z.literal(0),
  missionType: z.literal("ContinuousValidation"),
  scopeId: z.string().uuid()
});

export const ExternalAssessmentAttachScheduleSuccessSchema = z.strictObject({
  ok: z.literal(true),
  persisted: z
    .strictObject({
      scheduleId: z.string().uuid()
    })
    .optional(),
  schedule: ExternalAssessmentSchedulePlanSchema
});

export const ExternalAssessmentAttachScheduleResultSchema =
  z.discriminatedUnion("ok", [
    ExternalAssessmentAttachScheduleSuccessSchema,
    ExternalAssessmentCompileDenialSchema
  ]);
export type ExternalAssessmentAttachScheduleResult = z.infer<
  typeof ExternalAssessmentAttachScheduleResultSchema
>;

export const ExternalAssessmentFindingSchema = z.strictObject({
  evidenceBasis: z.literal("Measured"),
  excerpt: z.string(),
  location: z.string().optional(),
  moduleId: z.string().min(1),
  redactionStatus: z.literal("Redacted"),
  severity: z.string().min(1),
  title: z.string().min(1)
});
export type ExternalAssessmentFinding = z.infer<
  typeof ExternalAssessmentFindingSchema
>;

export const ExternalAssessmentToolOutputInputSchema = z.object({
  moduleId: z.string().min(1),
  stdout: z.string(),
  toolId: z.string().min(1)
});
export type ExternalAssessmentToolOutputInput = z.infer<
  typeof ExternalAssessmentToolOutputInputSchema
>;

export const ExternalAssessmentMappedResultsSchema = z.strictObject({
  evidenceBasis: z.literal("Measured"),
  findings: z.array(ExternalAssessmentFindingSchema),
  redactionStatus: z.literal("Redacted")
});
export type ExternalAssessmentMappedResults = z.infer<
  typeof ExternalAssessmentMappedResultsSchema
>;

const NUCLEI_PROFILE_BY_ASSESSMENT: Record<
  ExternalAssessmentProfileId,
  "safe-baseline" | "fingerprint" | "headers" | "metadata"
> = {
  "internet-facing": "safe-baseline",
  "safe-baseline": "safe-baseline",
  fingerprint: "fingerprint",
  headers: "headers",
  metadata: "metadata"
};

const TEMPLATE_PROFILE_BY_ASSESSMENT: Record<
  ExternalAssessmentProfileId,
  string
> = {
  "internet-facing": "safe-baseline",
  "safe-baseline": "safe-baseline",
  fingerprint: "safe-http-fingerprint",
  headers: "safe-http-headers",
  metadata: "safe-public-metadata"
};

function deny(
  code: ExternalAssessmentDenialCode
): z.infer<typeof ExternalAssessmentCompileDenialSchema> {
  return {
    code,
    executable: false,
    jobsQueued: 0,
    ok: false,
    startsJobs: false
  };
}

export function compileExternalAssessment(
  raw: unknown
): ExternalAssessmentCompileResult {
  const parsed = ExternalAssessmentCompileInputSchema.safeParse(raw);
  if (!parsed.success) {
    return deny("external_assessment_profile_not_allowlisted");
  }

  const profileId = parsed.data.profileId.trim().toLowerCase();
  if (!allowlistedProfileSet.has(profileId)) {
    return deny("external_assessment_profile_not_allowlisted");
  }

  const assessmentProfile = profileId as ExternalAssessmentProfileId;
  const nuclei = compileWebApiScenarioVersion({
    engine: "nuclei",
    profileId: NUCLEI_PROFILE_BY_ASSESSMENT[assessmentProfile]
  });
  if (!nuclei.ok) {
    return deny("external_assessment_profile_not_allowlisted");
  }

  return {
    ok: true,
    assessment: {
      alwaysOnBas: false,
      executable: true,
      jobsQueued: 0,
      liveAtomic: false,
      nucleiPin: NUCLEI_ENGINE_VERSION_PIN,
      nucleiTemplatesPin: NUCLEI_TEMPLATES_VERSION_PIN,
      productCopy: EXTERNAL_ASSESSMENT_PRODUCT_COPY,
      profileId: assessmentProfile,
      startJobs: EXTERNAL_ASSESSMENT_START_JOBS.map((job) => ({ ...job })),
      startsJobs: false,
      templateProfile: TEMPLATE_PROFILE_BY_ASSESSMENT[assessmentProfile],
      tools: EXTERNAL_ASSESSMENT_TOOLCHAIN.map((tool) => ({ ...tool }))
    }
  };
}

export function attachExternalAssessmentToSchedule(
  raw: unknown
): ExternalAssessmentAttachScheduleResult {
  const parsed = ExternalAssessmentAttachScheduleInputSchema.safeParse(raw);
  if (!parsed.success) {
    return deny("external_assessment_profile_not_allowlisted");
  }

  const compiled = compileExternalAssessment({
    profileId: parsed.data.profileId
  });
  if (!compiled.ok) {
    return compiled;
  }

  const moduleIds = [
    ...new Set(
      compiled.assessment.startJobs
        .map((job) => job.moduleId)
        .filter(isContinuousEasmSafeModuleId)
    )
  ];
  if (moduleIds.length === 0) {
    return deny("external_assessment_profile_not_allowlisted");
  }

  return {
    ok: true,
    schedule: {
      alwaysOnBas: false,
      config: {
        moduleIds,
        profileId: compiled.assessment.profileId
      },
      frequency: parsed.data.frequency,
      honesty:
        "Continuous internet-facing assessment on a verified domain. Recurring schedule, not always-on BAS.",
      jobsQueued: 0,
      missionType: "ContinuousValidation",
      scopeId: parsed.data.scopeId
    }
  };
}

const SECRET_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  {
    pattern: /Bearer\s+[A-Za-z0-9._\-+=/]+/giu,
    replacement: "Bearer [REDACTED]"
  },
  {
    pattern: /(api[_-]?key\s*[=:]\s*)[^\s&]+/giu,
    replacement: "$1[REDACTED]"
  },
  {
    pattern: /(authorization\s*[=:]\s*)[^\s&]+/giu,
    replacement: "$1[REDACTED]"
  },
  {
    pattern: /(password\s*[=:]\s*)[^\s&]+/giu,
    replacement: "$1[REDACTED]"
  },
  {
    pattern: /(token\s*[=:]\s*)[^\s&]+/giu,
    replacement: "$1[REDACTED]"
  }
];

export function redactExternalAssessmentText(value: string): string {
  let redacted = value;
  for (const { pattern, replacement } of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, replacement);
  }
  return redacted;
}

function finding(input: {
  excerpt: string;
  location?: string;
  moduleId: string;
  severity?: string;
  title: string;
}): ExternalAssessmentFinding {
  return {
    evidenceBasis: "Measured",
    excerpt: redactExternalAssessmentText(input.excerpt),
    ...(input.location
      ? { location: redactExternalAssessmentText(input.location) }
      : {}),
    moduleId: input.moduleId,
    redactionStatus: "Redacted",
    severity: input.severity ?? "info",
    title: redactExternalAssessmentText(input.title)
  };
}

function parseNucleiFindings(
  stdout: string,
  moduleId: string
): ExternalAssessmentFinding[] {
  const findings: ExternalAssessmentFinding[] = [];
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) {
      continue;
    }
    try {
      const row = JSON.parse(trimmed) as {
        host?: string;
        info?: { name?: string; severity?: string };
        "matched-at"?: string;
        "template-id"?: string;
      };
      const title =
        row.info?.name ?? row["template-id"] ?? "nuclei observation";
      findings.push(
        finding({
          excerpt: trimmed,
          location: row["matched-at"] ?? row.host,
          moduleId,
          severity: row.info?.severity ?? "info",
          title
        })
      );
    } catch {
      // Skip malformed JSONL; Measured findings come from parseable tool output.
    }
  }
  return findings;
}

function resolveToolOutputFindings(
  toolId: string,
  moduleId: string,
  stdout: string
): ExternalAssessmentFinding[] {
  if (toolId === "nuclei" || moduleId.includes("nuclei")) {
    return parseNucleiFindings(stdout, moduleId);
  }
  if (toolId === "tlsx" && stdout.startsWith("{")) {
    const jsonFindings = parseNucleiFindings(stdout, moduleId);
    if (jsonFindings.length > 0) {
      return jsonFindings;
    }
  }
  const titleByTool: Record<string, string> = {
    dnsx: "dnsx observation",
    httpx: "httpx observation",
    subfinder: "subfinder observation",
    tlsx: "tlsx observation"
  };
  return parseLineFindings(
    stdout,
    moduleId,
    titleByTool[toolId] ?? `${toolId} observation`
  );
}

function parseLineFindings(
  stdout: string,
  moduleId: string,
  title: string
): ExternalAssessmentFinding[] {
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) =>
      finding({
        excerpt: line,
        location: line.split(/\s+/u)[0],
        moduleId,
        title
      })
    );
}

export function mapExternalAssessmentToolOutput(
  raw: unknown
): ExternalAssessmentMappedResults {
  const parsed = ExternalAssessmentToolOutputInputSchema.parse(raw);
  const stdout = parsed.stdout.trim();
  if (!stdout) {
    return {
      evidenceBasis: "Measured",
      findings: [],
      redactionStatus: "Redacted"
    };
  }

  const toolId = parsed.toolId.trim().toLowerCase();
  const findings = resolveToolOutputFindings(toolId, parsed.moduleId, stdout);

  return {
    evidenceBasis: "Measured",
    findings,
    redactionStatus: "Redacted"
  };
}
