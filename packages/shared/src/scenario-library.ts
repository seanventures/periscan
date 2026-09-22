import { createHash } from "node:crypto";
import { z } from "zod";

import {
  canonicalizeJson,
  compileBasCampaignDag,
  sha256Hex,
  type BasCampaignDag
} from "./bas-campaign";
import { BasContentReviewStatusSchema } from "./bas-content";

/**
 * OpenAEV scenario-library import (PERISCAN-583).
 *
 * Versioned JSON packs compile to Periscan campaign pins. Import is
 * Unreviewed BasContentVersion-style content: executable stays false
 * until review, and compile/start never treat import as executed coverage.
 * Apache-2.0 / MIT packs are Community; GPL / AGPL packs are Engine Lab.
 */

export const SCENARIO_LIBRARY_MAX_INJECTS = 50;
export const SCENARIO_LIBRARY_MAX_PAYLOAD_PINS = 50;
export const SCENARIO_LIBRARY_PROVIDER = "OpenAev" as const;

export const SCENARIO_LIBRARY_COMMUNITY_LICENSES = [
  "Apache-2.0",
  "MIT"
] as const;
export const SCENARIO_LIBRARY_ENGINE_LAB_LICENSES = [
  "AGPL-3.0",
  "GPL-2.0",
  "GPL-3.0"
] as const;

export const SCENARIO_LIBRARY_DISCLAIMER =
  "Scenario-library import is authoring metadata. Imported packs are not executed coverage. Compile does not start a campaign. GPL/AGPL packs stay Engine Lab.";

const AttackTechniqueIdSchema = z.string().regex(/^T\d{4}(?:\.\d{3})?$/);
const Sha256HexSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const communityLicenseSet = new Set<string>(
  SCENARIO_LIBRARY_COMMUNITY_LICENSES
);
const engineLabLicenseSet = new Set<string>(
  SCENARIO_LIBRARY_ENGINE_LAB_LICENSES
);

export const ScenarioLibrarySpdxLicenseSchema = z.enum([
  "Apache-2.0",
  "MIT",
  "GPL-2.0",
  "GPL-3.0",
  "AGPL-3.0"
]);
export type ScenarioLibrarySpdxLicense = z.infer<
  typeof ScenarioLibrarySpdxLicenseSchema
>;

export const ScenarioLibraryEditionSchema = z.enum(["Community", "EngineLab"]);
export type ScenarioLibraryEdition = z.infer<
  typeof ScenarioLibraryEditionSchema
>;

export const ScenarioLibraryPayloadKindSchema = z.enum([
  "command",
  "document",
  "email"
]);
export type ScenarioLibraryPayloadKind = z.infer<
  typeof ScenarioLibraryPayloadKindSchema
>;

export const ScenarioLibraryPayloadPinSchema = z.strictObject({
  contentSha256: Sha256HexSchema,
  kind: ScenarioLibraryPayloadKindSchema,
  name: z.string().trim().min(1).max(512),
  payloadPinId: z.string().min(1).max(128)
});
export type ScenarioLibraryPayloadPin = z.infer<
  typeof ScenarioLibraryPayloadPinSchema
>;

export const ScenarioLibraryInjectSchema = z.strictObject({
  dependsOn: z.array(z.string().min(1).max(128)).max(11).default([]),
  injectId: z.string().min(1).max(128),
  name: z.string().trim().min(1).max(512),
  payloadPinId: z.string().min(1).max(128),
  techniqueIds: z.array(AttackTechniqueIdSchema).min(1).max(20)
});
export type ScenarioLibraryInject = z.infer<typeof ScenarioLibraryInjectSchema>;

export const ScenarioLibraryPackSchema = z.strictObject({
  attackTechniques: z.array(AttackTechniqueIdSchema).min(1).max(50),
  injects: z
    .array(ScenarioLibraryInjectSchema)
    .min(1)
    .max(SCENARIO_LIBRARY_MAX_INJECTS),
  name: z.string().trim().min(1).max(512),
  payloadPins: z
    .array(ScenarioLibraryPayloadPinSchema)
    .min(1)
    .max(SCENARIO_LIBRARY_MAX_PAYLOAD_PINS),
  spdxLicenseId: ScenarioLibrarySpdxLicenseSchema,
  version: z.string().trim().min(1).max(128)
});
export type ScenarioLibraryPack = z.infer<typeof ScenarioLibraryPackSchema>;

export const ScenarioLibraryContentSchema = z.strictObject({
  edition: ScenarioLibraryEditionSchema,
  evidenceProduced: z.literal(false),
  executable: z.literal(false),
  executedCoverage: z.literal(false),
  provenance: z.literal("UserSuppliedUnverified"),
  reviewStatus: BasContentReviewStatusSchema
});
export type ScenarioLibraryContent = z.infer<
  typeof ScenarioLibraryContentSchema
>;

export const ScenarioLibraryDenialCodeSchema = z.enum([
  "scenario_library_executed_coverage_forbidden",
  "scenario_library_invalid",
  "scenario_library_license_blocked"
]);
export type ScenarioLibraryDenialCode = z.infer<
  typeof ScenarioLibraryDenialCodeSchema
>;

export const ScenarioLibraryImportSuccessSchema = z.strictObject({
  content: ScenarioLibraryContentSchema,
  executed: z.literal(false),
  jobsQueued: z.literal(0),
  ok: z.literal(true),
  pack: ScenarioLibraryPackSchema
});
export type ScenarioLibraryImportSuccess = z.infer<
  typeof ScenarioLibraryImportSuccessSchema
>;

export const ScenarioLibraryImportDenialSchema = z.strictObject({
  code: ScenarioLibraryDenialCodeSchema,
  executable: z.literal(false),
  executedCoverage: z.literal(false),
  jobsQueued: z.literal(0),
  ok: z.literal(false),
  rationale: z.string().min(1).max(280)
});
export type ScenarioLibraryImportDenial = z.infer<
  typeof ScenarioLibraryImportDenialSchema
>;

export const ScenarioLibraryImportResultSchema = z.discriminatedUnion("ok", [
  ScenarioLibraryImportSuccessSchema,
  ScenarioLibraryImportDenialSchema
]);
export type ScenarioLibraryImportResult = z.infer<
  typeof ScenarioLibraryImportResultSchema
>;

export const ScenarioLibraryCampaignPinSchema = z.strictObject({
  contentSha256: Sha256HexSchema,
  dependsOn: z.array(z.string().min(1).max(128)).max(11),
  payloadPinId: z.string().min(1).max(128),
  provider: z.literal(SCENARIO_LIBRARY_PROVIDER),
  stepKey: z.string().min(1).max(128),
  techniqueIds: z.array(AttackTechniqueIdSchema).min(1).max(20),
  upstreamId: z.string().min(1).max(128)
});
export type ScenarioLibraryCampaignPin = z.infer<
  typeof ScenarioLibraryCampaignPinSchema
>;

export const ScenarioLibraryCompileSuccessSchema = z.strictObject({
  compiledDigest: Sha256HexSchema,
  dependencyGraph: z.strictObject({
    edges: z.array(
      z.strictObject({
        from: z.string().min(1),
        to: z.string().min(1)
      })
    ),
    executionOrder: z.array(z.string().min(1)),
    nodes: z.array(z.string().min(1))
  }),
  executable: z.literal(false),
  executed: z.literal(false),
  jobsQueued: z.literal(0),
  ok: z.literal(true),
  queued: z.literal(false),
  scenarioPins: z.array(ScenarioLibraryCampaignPinSchema).min(1).max(50),
  startable: z.literal(false)
});
export type ScenarioLibraryCompileSuccess = z.infer<
  typeof ScenarioLibraryCompileSuccessSchema
>;

export const ScenarioLibraryCompileDenialSchema = z.strictObject({
  code: z.literal("scenario_library_invalid"),
  executable: z.literal(false),
  executed: z.literal(false),
  jobsQueued: z.literal(0),
  ok: z.literal(false),
  queued: z.literal(false),
  rationale: z.string().min(1).max(280)
});
export type ScenarioLibraryCompileDenial = z.infer<
  typeof ScenarioLibraryCompileDenialSchema
>;

export const ScenarioLibraryCompileResultSchema = z.discriminatedUnion("ok", [
  ScenarioLibraryCompileSuccessSchema,
  ScenarioLibraryCompileDenialSchema
]);
export type ScenarioLibraryCompileResult = z.infer<
  typeof ScenarioLibraryCompileResultSchema
>;

export const PromoteScenarioLibraryInputSchema = z.strictObject({
  reviewStatus: z.literal("Reviewed")
});
export type PromoteScenarioLibraryInput = z.infer<
  typeof PromoteScenarioLibraryInputSchema
>;

export const ScenarioLibraryStartResultSchema = z.strictObject({
  compiledDigest: Sha256HexSchema,
  denyReason: z.string().min(1),
  executed: z.literal(false),
  jobsQueued: z.literal(0),
  outcome: z.literal("Denied"),
  queued: z.literal(false)
});
export type ScenarioLibraryStartResult = z.infer<
  typeof ScenarioLibraryStartResultSchema
>;

const UNREVIEWED_START_DENY_REASON =
  "Unreviewed BAS content cannot execute. Campaign start is denied and jobs are not queued.";
const QUALIFICATION_START_DENY_REASON =
  "Scenario-library injects are not a qualified live pack. Start does not queue jobs.";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isAttackTechniqueId(value: unknown): value is string {
  return typeof value === "string" && /^T\d{4}(?:\.\d{3})?$/.test(value);
}

function editionForLicense(
  spdxLicenseId: string
): ScenarioLibraryEdition | null {
  if (communityLicenseSet.has(spdxLicenseId)) {
    return "Community";
  }
  if (engineLabLicenseSet.has(spdxLicenseId)) {
    return "EngineLab";
  }
  return null;
}

function hasExecutedCoverageClaim(value: unknown): boolean {
  const record = asRecord(value);
  if (!record) {
    return false;
  }
  if (
    record.executedCoverage === true ||
    record.executed === true ||
    record.executable === true
  ) {
    return true;
  }
  const claims = asRecord(record.claims);
  return Boolean(claims && claims.executedCoverage === true);
}

function denyImport(
  code: ScenarioLibraryDenialCode,
  rationale: string
): ScenarioLibraryImportDenial {
  return ScenarioLibraryImportDenialSchema.parse({
    code,
    executable: false,
    executedCoverage: false,
    jobsQueued: 0,
    ok: false,
    rationale
  });
}

function payloadKindFromOpenAev(value: unknown): ScenarioLibraryPayloadKind {
  const normalized = String(value ?? "command").toLowerCase();
  if (normalized === "email" || normalized === "mail") {
    return "email";
  }
  if (normalized === "document" || normalized === "file") {
    return "document";
  }
  return "command";
}

function digestOpenAevPayload(input: {
  kind: ScenarioLibraryPayloadKind;
  name: string;
  payloadPinId: string;
}): string {
  return createHash("sha256")
    .update(
      `openaev-payload\n${input.payloadPinId}\n${input.name}\n${input.kind}\n`
    )
    .digest("hex");
}

function collectTechniqueIds(value: unknown): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const push = (id: unknown) => {
    if (isAttackTechniqueId(id) && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  };

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === "string") {
        push(entry);
        continue;
      }
      const record = asRecord(entry);
      if (record) {
        push(record.attack_pattern_external_id);
      }
    }
  }
  return ids;
}

function dependsOnFromOpenAev(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const ids: string[] = [];
  for (const entry of value) {
    if (typeof entry === "string" && entry.length > 0) {
      ids.push(entry);
      continue;
    }
    const record = asRecord(entry);
    const injectId = record?.inject_id;
    if (typeof injectId === "string" && injectId.length > 0) {
      ids.push(injectId);
    }
  }
  return ids;
}

function isOpenAevExport(raw: Record<string, unknown>): boolean {
  return (
    Boolean(asRecord(raw.scenario_information)) &&
    Array.isArray(raw.scenario_injects)
  );
}

function normalizeOpenAevExport(
  raw: Record<string, unknown>
): Record<string, unknown> | null {
  const info = asRecord(raw.scenario_information);
  if (!info || typeof info.scenario_name !== "string") {
    return null;
  }
  const injectsRaw = Array.isArray(raw.scenario_injects)
    ? raw.scenario_injects
    : [];
  const injects: ScenarioLibraryInject[] = [];
  const payloadPins: ScenarioLibraryPayloadPin[] = [];
  const payloadSeen = new Set<string>();
  const techniques = new Set<string>();

  for (const entry of injectsRaw) {
    const inject = asRecord(entry);
    if (!inject || typeof inject.inject_id !== "string") {
      return null;
    }
    const contract = asRecord(inject.inject_injector_contract) ?? {};
    const payload = asRecord(contract.injector_contract_payload) ?? {};
    const techniqueIds = collectTechniqueIds(
      payload.payload_attack_patterns ??
        contract.contract_attack_patterns_external_ids ??
        contract.injector_contract_attack_patterns
    );
    if (techniqueIds.length === 0) {
      return null;
    }
    for (const techniqueId of techniqueIds) {
      techniques.add(techniqueId);
    }

    const payloadPinId =
      typeof payload.payload_id === "string" && payload.payload_id.length > 0
        ? payload.payload_id
        : inject.inject_id;
    const payloadName =
      typeof payload.payload_name === "string" &&
      payload.payload_name.length > 0
        ? payload.payload_name
        : String(inject.inject_title ?? payloadPinId);
    const kind = payloadKindFromOpenAev(payload.payload_type);

    if (!payloadSeen.has(payloadPinId)) {
      payloadSeen.add(payloadPinId);
      payloadPins.push(
        ScenarioLibraryPayloadPinSchema.parse({
          contentSha256: digestOpenAevPayload({
            kind,
            name: payloadName,
            payloadPinId
          }),
          kind,
          name: payloadName,
          payloadPinId
        })
      );
    }

    injects.push(
      ScenarioLibraryInjectSchema.parse({
        dependsOn: dependsOnFromOpenAev(inject.inject_depends_on),
        injectId: inject.inject_id,
        name: String(inject.inject_title ?? inject.inject_id),
        payloadPinId,
        techniqueIds
      })
    );
  }

  return {
    attackTechniques: [...techniques],
    injects,
    name: info.scenario_name,
    payloadPins,
    spdxLicenseId: raw.spdxLicenseId,
    version: raw.version
  };
}

function validatePackRefs(pack: ScenarioLibraryPack): string | null {
  const pinIds = new Set(pack.payloadPins.map((pin) => pin.payloadPinId));
  if (pinIds.size !== pack.payloadPins.length) {
    return "Scenario-library payload pin ids must be unique.";
  }
  const injectIds = new Set(pack.injects.map((inject) => inject.injectId));
  if (injectIds.size !== pack.injects.length) {
    return "Scenario-library inject ids must be unique.";
  }
  for (const inject of pack.injects) {
    if (!pinIds.has(inject.payloadPinId)) {
      return `Scenario-library inject ${inject.injectId} references an unknown payload pin.`;
    }
    for (const dependency of inject.dependsOn) {
      if (!injectIds.has(dependency) || dependency === inject.injectId) {
        return "Scenario-library inject dependencies must name other injects in the pack.";
      }
    }
  }
  return null;
}

function importedContent(
  pack: ScenarioLibraryPack,
  reviewStatus: "Unreviewed" | "Reviewed"
): ScenarioLibraryContent {
  const edition = editionForLicense(pack.spdxLicenseId);
  if (!edition) {
    throw new Error("Scenario-library license must resolve to an edition.");
  }
  return ScenarioLibraryContentSchema.parse({
    edition,
    evidenceProduced: false,
    executable: false,
    executedCoverage: false,
    provenance: "UserSuppliedUnverified",
    reviewStatus
  });
}

export function importScenarioLibraryPack(
  raw: unknown
): ScenarioLibraryImportResult {
  if (hasExecutedCoverageClaim(raw)) {
    return denyImport(
      "scenario_library_executed_coverage_forbidden",
      "Imported scenario-library packs are not executed coverage."
    );
  }

  const record = asRecord(raw);
  if (!record) {
    return denyImport(
      "scenario_library_invalid",
      "Scenario-library pack must be a JSON object."
    );
  }

  const declaredLicense =
    typeof record.spdxLicenseId === "string" ? record.spdxLicenseId : null;
  if (declaredLicense && !editionForLicense(declaredLicense)) {
    return denyImport(
      "scenario_library_license_blocked",
      "Scenario-library SPDX must be Apache-2.0/MIT (Community) or GPL/AGPL (Engine Lab)."
    );
  }

  const candidate = isOpenAevExport(record)
    ? normalizeOpenAevExport(record)
    : record;
  const parsed = ScenarioLibraryPackSchema.safeParse(candidate);
  if (!parsed.success) {
    return denyImport(
      "scenario_library_invalid",
      "Scenario-library pack requires name, ATT&CK techniques, injects, and payload pins."
    );
  }

  const refError = validatePackRefs(parsed.data);
  if (refError) {
    return denyImport("scenario_library_invalid", refError);
  }

  return ScenarioLibraryImportSuccessSchema.parse({
    content: importedContent(parsed.data, "Unreviewed"),
    executed: false,
    jobsQueued: 0,
    ok: true,
    pack: parsed.data
  });
}

export function promoteScenarioLibraryContent(
  imported: ScenarioLibraryImportResult,
  input: unknown
): ScenarioLibraryImportResult {
  const parsedInput = PromoteScenarioLibraryInputSchema.safeParse(input);
  if (!imported.ok) {
    return imported;
  }
  if (!parsedInput.success) {
    return denyImport(
      "scenario_library_invalid",
      "Owner/Admin promotion sets reviewStatus Reviewed without flipping executable."
    );
  }
  return ScenarioLibraryImportSuccessSchema.parse({
    ...imported,
    content: importedContent(imported.pack, "Reviewed"),
    executed: false,
    jobsQueued: 0
  });
}

function pinContentSha256(
  pack: ScenarioLibraryPack,
  payloadPinId: string
): string {
  const pin = pack.payloadPins.find(
    (item) => item.payloadPinId === payloadPinId
  );
  return pin?.contentSha256 ?? sha256Hex(payloadPinId);
}

export function compileScenarioLibraryToCampaign(
  imported: ScenarioLibraryImportResult
): ScenarioLibraryCompileResult {
  if (!imported.ok) {
    return ScenarioLibraryCompileDenialSchema.parse({
      code: "scenario_library_invalid",
      executable: false,
      executed: false,
      jobsQueued: 0,
      ok: false,
      queued: false,
      rationale: imported.rationale
    });
  }

  const dag = compileBasCampaignDag(
    imported.pack.injects.map((inject) => ({
      dependsOn: inject.dependsOn,
      stepKey: inject.injectId,
      upstreamId: inject.injectId
    }))
  );
  if (dag.error || !dag.graph) {
    return ScenarioLibraryCompileDenialSchema.parse({
      code: "scenario_library_invalid",
      executable: false,
      executed: false,
      jobsQueued: 0,
      ok: false,
      queued: false,
      rationale: dag.error ?? "Scenario-library inject graph failed to compile."
    });
  }

  const graph: BasCampaignDag = dag.graph;
  const pinsByStep = new Map(
    imported.pack.injects.map((inject) => [
      inject.injectId,
      ScenarioLibraryCampaignPinSchema.parse({
        contentSha256: pinContentSha256(imported.pack, inject.payloadPinId),
        dependsOn: inject.dependsOn,
        payloadPinId: inject.payloadPinId,
        provider: SCENARIO_LIBRARY_PROVIDER,
        stepKey: inject.injectId,
        techniqueIds: inject.techniqueIds,
        upstreamId: inject.injectId
      })
    ])
  );
  const scenarioPins = graph.executionOrder.flatMap((stepKey) => {
    const pin = pinsByStep.get(stepKey);
    return pin ? [pin] : [];
  });

  const compiledDigest = sha256Hex(
    canonicalizeJson({
      pack: imported.pack,
      scenarioPins
    })
  );

  return ScenarioLibraryCompileSuccessSchema.parse({
    compiledDigest,
    dependencyGraph: {
      edges: graph.edges,
      executionOrder: graph.executionOrder,
      nodes: graph.nodes
    },
    executable: false,
    executed: false,
    jobsQueued: 0,
    ok: true,
    queued: false,
    scenarioPins,
    startable: false
  });
}

export function startScenarioLibraryCampaign(input: {
  compiledDigest: string;
  imported: ScenarioLibraryImportResult;
}): ScenarioLibraryStartResult {
  const compiledDigest = Sha256HexSchema.parse(input.compiledDigest);
  const unreviewed =
    !input.imported.ok || input.imported.content.reviewStatus !== "Reviewed";
  return ScenarioLibraryStartResultSchema.parse({
    compiledDigest,
    denyReason: unreviewed
      ? UNREVIEWED_START_DENY_REASON
      : QUALIFICATION_START_DENY_REASON,
    executed: false,
    jobsQueued: 0,
    outcome: "Denied",
    queued: false
  });
}
