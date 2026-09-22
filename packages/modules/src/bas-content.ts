import { createHash } from "node:crypto";
import { isAlias, parseDocument, visit } from "yaml";
import { z } from "zod";
import {
  BAS_CONTENT_MAX_BYTES,
  BAS_CONTENT_MAX_SCENARIOS,
  BasContentPreviewInputSchema,
  BasContentPreviewSchema,
  type BasContentPreview,
  type BasContentPreviewInput,
  type BasScenarioPreview
} from "@periscan/shared";

const label = z.string().trim().min(1).max(512);
const shortLabel = z.string().trim().min(1).max(64);
const technique = z.string().regex(/^T\d{4}(?:\.\d{3})?$/);
const atomic = z.object({
  attack_technique: technique,
  atomic_tests: z
    .array(
      z.object({
        auto_generated_guid: z.uuid(),
        name: label,
        supported_platforms: z.array(shortLabel).min(1).max(20),
        dependencies: z.array(z.unknown()).max(100).optional(),
        executor: z.object({
          name: shortLabel,
          cleanup_command: z.string().optional()
        })
      })
    )
    .min(1)
    .max(BAS_CONTENT_MAX_SCENARIOS)
});
const caldera = z
  .array(
    z.object({
      id: z.uuid(),
      name: label,
      technique: z.object({ attack_id: technique }),
      requirements: z.array(z.unknown()).max(100).optional(),
      platforms: z
        .record(
          shortLabel,
          z.record(
            shortLabel,
            z.object({
              cleanup: z
                .union([z.string(), z.array(z.string()).max(100)])
                .optional()
            })
          )
        )
        .refine((platforms) => {
          const entries = Object.entries(platforms);
          return (
            entries.length > 0 &&
            entries.length <= 20 &&
            entries.every(
              ([, executors]) =>
                Object.keys(executors).length > 0 &&
                Object.keys(executors).length <= 20
            )
          );
        })
    })
  )
  .min(1)
  .max(BAS_CONTENT_MAX_SCENARIOS);

export class BasContentError extends Error {
  constructor() {
    // Never echo uploaded commands, credentials, or YAML parser source excerpts.
    super(
      "Invalid BAS content. Supply one bounded Atomic technique or Caldera ability list with unique IDs; YAML aliases and custom tags are unsupported."
    );
    this.name = "BasContentError";
  }
}

function readContent(input: BasContentPreviewInput): unknown {
  if (Buffer.byteLength(input.content, "utf8") > BAS_CONTENT_MAX_BYTES) {
    throw new BasContentError();
  }
  // JSON syntax check, then the same duplicate-key/depth checks as YAML.
  if (input.format === "json") JSON.parse(input.content);
  const doc = parseDocument(input.content, {
    uniqueKeys: true,
    schema: "core"
  });
  if (doc.errors.length || doc.warnings.length) throw new BasContentError();
  visit(doc, (_key, node, path) => {
    if (
      path.length > 32 ||
      isAlias(node) ||
      (node && typeof node === "object" && "tag" in node && node.tag)
    ) {
      throw new BasContentError();
    }
  });
  return doc.toJS({ maxAliasCount: 0 });
}

const unique = (items: string[]) => [...new Set(items)].sort();

/** Parses supplied data only. No upstream fetch, file reads, execution or persistence. */
export function previewBasContent(
  rawInput: BasContentPreviewInput
): BasContentPreview {
  try {
    const input = BasContentPreviewInputSchema.parse(rawInput);
    const document = readContent(input);
    let scenarios: BasScenarioPreview[];
    if (input.provider === "AtomicRedTeam") {
      const parsed = atomic.parse(document);
      scenarios = parsed.atomic_tests.map((test) => ({
        scenarioId: `atomic:${test.auto_generated_guid.toLowerCase()}`,
        upstreamId: test.auto_generated_guid.toLowerCase(),
        name: test.name,
        techniqueIds: [parsed.attack_technique],
        platforms: unique(test.supported_platforms),
        executors: [test.executor.name],
        hasPrerequisites: Boolean(test.dependencies?.length),
        hasCleanup: Boolean(test.executor.cleanup_command?.trim()),
        reviewStatus: "Unreviewed",
        executable: false
      }));
    } else {
      scenarios = caldera.parse(document).map((ability) => {
        const executors = Object.values(ability.platforms).flatMap(
          Object.entries
        );
        return {
          scenarioId: `caldera:${ability.id.toLowerCase()}`,
          upstreamId: ability.id.toLowerCase(),
          name: ability.name,
          techniqueIds: [ability.technique.attack_id],
          platforms: unique(Object.keys(ability.platforms)),
          executors: unique(
            executors.flatMap(([name]) =>
              name.split(",").map((part) => part.trim())
            )
          ),
          hasPrerequisites: Boolean(ability.requirements?.length),
          hasCleanup: executors.some(([, executor]) =>
            Array.isArray(executor.cleanup)
              ? executor.cleanup.some(
                  (command: string) => command.trim().length > 0
                )
              : Boolean(executor.cleanup?.trim())
          ),
          reviewStatus: "Unreviewed",
          executable: false
        };
      });
    }
    if (
      new Set(scenarios.map((item) => item.scenarioId)).size !==
      scenarios.length
    ) {
      throw new BasContentError();
    }
    return BasContentPreviewSchema.parse({
      provider: input.provider,
      sourceRevision: input.sourceRevision,
      provenance: "UserSuppliedUnverified",
      contentSha256: createHash("sha256")
        .update(input.content, "utf8")
        .digest("hex"),
      scenarios,
      executable: false,
      evidenceProduced: false
    });
  } catch {
    throw new BasContentError();
  }
}
