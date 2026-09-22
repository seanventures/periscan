import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";
import { z } from "zod";

import {
  AtomicLabAdapterBindingSchema,
  BasAtomicScenarioCatalogItemSchema,
  type AtomicLabAdapterBinding,
  type BasAtomicScenarioCatalogItem
} from "@periscan/shared";

import {
  ATOMIC_LAB_PLANS,
  getAtomicLabPlan,
  normalizeAtomicLabGuid,
  type AtomicLabPlan
} from "./bas-local-lab.js";

const ATOMIC_FIXTURE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/atomic"
);

const DRY_RUN_COMMAND = /ShowDetailsBrief|-CheckPrereqs/iu;

const AtomicYamlExecutorSchema = z.object({
  command: z.string().min(1),
  name: z.string().min(1)
});

const AtomicYamlTestSchema = z.object({
  description: z.string().min(1).optional(),
  executor: AtomicYamlExecutorSchema,
  name: z.string().min(1)
});

const AtomicYamlDocumentSchema = z.object({
  attack_technique: z.string().min(1),
  atomic_tests: z.array(AtomicYamlTestSchema).min(1),
  display_name: z.string().min(1),
  license: z.literal("MIT"),
  tactic: z.string().min(1)
});

function assertDryRunExecutor(command: string, techniqueId: string) {
  if (!DRY_RUN_COMMAND.test(command)) {
    throw new Error(
      `Atomic YAML for ${techniqueId} is not a dry-run catalog command.`
    );
  }
}

function toCatalogItem(
  document: z.infer<typeof AtomicYamlDocumentSchema>
): BasAtomicScenarioCatalogItem {
  const test = document.atomic_tests[0]!;
  assertDryRunExecutor(test.executor.command, document.attack_technique);
  return BasAtomicScenarioCatalogItemSchema.parse({
    description:
      test.description?.trim() ||
      `Allowlisted Atomic Red Team dry-run catalog entry for ${document.attack_technique}.`,
    executionMode: "dry-run",
    liveExecutionDisabled: true,
    liveExecutionLabel: "live execution disabled",
    moduleId: "atomic.control_validation_safe",
    name: test.name,
    scenarioId: `atomic.${document.attack_technique}`,
    source: "atomic-red-team",
    spdxLicenseId: "MIT",
    tactic: document.tactic,
    techniqueId: document.attack_technique
  });
}

export async function listAllowlistedAtomicBasScenarios(): Promise<
  BasAtomicScenarioCatalogItem[]
> {
  const names = (await readdir(ATOMIC_FIXTURE_DIR))
    .filter((name) => name.endsWith(".yaml") || name.endsWith(".yml"))
    .sort();
  const items: BasAtomicScenarioCatalogItem[] = [];
  for (const name of names) {
    const raw = await readFile(path.join(ATOMIC_FIXTURE_DIR, name), "utf8");
    const parsed = AtomicYamlDocumentSchema.parse(parse(raw));
    items.push(toCatalogItem(parsed));
  }
  return items;
}

export async function getAllowlistedAtomicBasScenario(
  scenarioId: string
): Promise<BasAtomicScenarioCatalogItem | null> {
  const items = await listAllowlistedAtomicBasScenarios();
  return items.find((item) => item.scenarioId === scenarioId) ?? null;
}

function processNameForPlan(plan: AtomicLabPlan): "hostname" | "env" | "date" {
  if (plan.executable === "/bin/env") return "env";
  if (plan.executable === "/bin/date") return "date";
  return "hostname";
}

export function atomicLabAdapterBindingFromPlan(
  plan: AtomicLabPlan,
  options: { customerLive?: boolean } = {}
): AtomicLabAdapterBinding {
  const customerLive = options.customerLive === true;
  return AtomicLabAdapterBindingSchema.parse({
    argv: [plan.executable],
    cleanup: {
      requiredAfterCreate: true,
      strategy: "remove_labelled_container",
      yamlCleanupCommand: false
    },
    customerLiveSupported: customerLive,
    expectedTelemetry: {
      detection: "NotMeasured",
      observerRequired: false,
      processName: processNameForPlan(plan),
      techniqueId: plan.techniqueId
    },
    guid: normalizeAtomicLabGuid(plan.scenarioId),
    image: plan.image,
    labOnly: !customerLive,
    name: plan.name,
    os: "linux",
    prerequisites: {
      dockerUnixSocket: true,
      elevationRequired: false,
      pinnedImageMustBePresent: true,
      yamlDependencies: false,
      yamlInputArguments: false
    },
    queueable: customerLive,
    scenarioId: plan.scenarioId,
    sourcePin: {
      contentSha256: plan.contentSha256,
      sourcePath: plan.sourcePath,
      sourceRevision: plan.sourceRevision
    },
    techniqueId: plan.techniqueId,
    typedInputs: {}
  });
}

export function listAtomicLabAdapterBindings(): AtomicLabAdapterBinding[] {
  return ATOMIC_LAB_PLANS.map((plan) => atomicLabAdapterBindingFromPlan(plan));
}

const UNSAFE_ATOMIC_LAB_REASONS: Record<string, string> = {
  "034fe21c-3186-49dd-8d5d-128b35f181c7":
    "Linux List Kernel Modules is a multi-command shell script, not an argv-allowlisted binary. Commands are never eval'd from YAML.",
  "8d0d1e2b-5e3f-4c22-8d1b-000000001087":
    "Catalog dry-run Invoke-AtomicTest content is not a lab execution adapter.",
  "7c9c0f1a-4d2e-4b11-9c0a-000000001595":
    "Catalog dry-run Invoke-AtomicTest content is not a lab execution adapter.",
  "20aba24b-e61f-4b26-b4ce-4784f763ca20":
    "T1124 Windows net time is not a Linux argv-allowlisted binary. Fail closed; commands are never eval'd from YAML.",
  "cccb070c-df86-4216-a5bc-9fb60c74e27c":
    "T1082 List OS Information writes #{output_file} through a shell script, not an argv-allowlisted binary."
};

export type AtomicLabEligibility =
  | { eligible: true; binding: AtomicLabAdapterBinding }
  | { eligible: false; failClosed: true; reason: string };

export function reviewAtomicLabEligibility(guid: string): AtomicLabEligibility {
  const plan = getAtomicLabPlan(guid);
  if (plan) {
    return { eligible: true, binding: atomicLabAdapterBindingFromPlan(plan) };
  }
  const normalized = normalizeAtomicLabGuid(guid);
  return {
    eligible: false,
    failClosed: true,
    reason:
      UNSAFE_ATOMIC_LAB_REASONS[normalized] ??
      "Not in the reviewed Linux-safe lab allowlist. Fail closed; commands are never eval'd from YAML."
  };
}

export type AtomicLabCampaignBindResult =
  | {
      bound: true;
      binding: AtomicLabAdapterBinding;
      customerQueueable: boolean;
    }
  | {
      bound: false;
      jobsQueued: 0;
      liveSupported: false;
      queued: false;
      reason: string;
    };

export function bindAtomicLabAdapterForCampaign(input: {
  guid: string;
  live?: boolean;
  os: string;
}): AtomicLabCampaignBindResult {
  const reviewed = reviewAtomicLabEligibility(input.guid);
  if (!reviewed.eligible) {
    return {
      bound: false,
      jobsQueued: 0,
      liveSupported: false,
      queued: false,
      reason: reviewed.reason
    };
  }
  if (input.os !== "linux") {
    return {
      bound: false,
      jobsQueued: 0,
      liveSupported: false,
      queued: false,
      reason: "Only the reviewed Linux lab OS is supported."
    };
  }
  if (input.live) {
    const plan = getAtomicLabPlan(input.guid);
    if (!plan) {
      return {
        bound: false,
        jobsQueued: 0,
        liveSupported: false,
        queued: false,
        reason:
          "Customer live Atomic execution is not enabled. Denied tasks are never queued."
      };
    }
    return {
      bound: true,
      binding: atomicLabAdapterBindingFromPlan(plan, { customerLive: true }),
      customerQueueable: true
    };
  }
  return {
    bound: true,
    binding: reviewed.binding,
    customerQueueable: false
  };
}
