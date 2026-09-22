import { reviewAtomicLabEligibility } from "./atomic-bas-catalog.js";
import {
  ATOMIC_LAB_PLANS,
  getAtomicLabPlan,
  normalizeAtomicLabGuid,
  type AtomicLabPlan
} from "./bas-local-lab.js";

/** Reviewed Linux-safe argv. `/bin/ps` is included only when a lab plan binds it. */
const ATOMIC_QUALIFIED_START_ARGV = [
  "/bin/hostname",
  "/bin/env",
  "/bin/date",
  "/bin/ps"
] as const;

export type AtomicQualifiedArgv = (typeof ATOMIC_QUALIFIED_START_ARGV)[number];

export const ATOMIC_QUALIFIED_START_NOT_STARTABLE =
  "Atomic campaign start is not startable. Denied tasks are never queued.";
export const ATOMIC_QUALIFIED_START_NO_QUALIFICATION =
  "Atomic qualification records are not available. Denied tasks are never queued.";
export const ATOMIC_QUALIFIED_START_NO_ARGV =
  "No allowlisted Atomic Linux argv pins. Denied tasks are never queued.";
export const ATOMIC_QUALIFIED_START_YAML_EVAL =
  "Atomic pin is not an allowlisted Linux argv. Commands are never eval'd from YAML. Denied tasks are never queued.";

export type AtomicQualifiedStartPin = {
  provider: string;
  upstreamId: string;
};

export type AtomicQualifiedArgvTask = {
  argv: readonly [AtomicQualifiedArgv];
  executable: AtomicQualifiedArgv;
  guid: string;
  scenarioId: string;
};

export type AtomicQualifiedQueuePlan =
  | {
      argvTasks: [];
      denyReason: string;
      jobsQueued: 0;
      queued: false;
      yamlEval: false;
    }
  | {
      argvTasks: AtomicQualifiedArgvTask[];
      denyReason: null;
      jobsQueued: number;
      queued: true;
      yamlEval: false;
    };

function isAllowlistedArgv(
  executable: string
): executable is AtomicQualifiedArgv {
  if (
    !(ATOMIC_QUALIFIED_START_ARGV as readonly string[]).includes(executable)
  ) {
    return false;
  }
  if (executable === "/bin/ps") {
    return ATOMIC_LAB_PLANS.some(
      (plan) => (plan.executable as string) === "/bin/ps"
    );
  }
  return true;
}

export function listAtomicQualifiedStartArgv(): AtomicQualifiedArgv[] {
  const present = new Set<string>();
  for (const plan of ATOMIC_LAB_PLANS) {
    if (isAllowlistedArgv(plan.executable)) {
      present.add(plan.executable);
    }
  }
  return ATOMIC_QUALIFIED_START_ARGV.filter((item) => present.has(item));
}

export function isAtomicQualifiedExecutionPin(
  pin: AtomicQualifiedStartPin
): boolean {
  return (
    pin.provider === "AtomicRedTeam" ||
    pin.upstreamId.startsWith("atomic:") ||
    Boolean(getAtomicLabPlan(pin.upstreamId))
  );
}

export function resolveAtomicQualifiedStartArgv(guid: string):
  | {
      allowlisted: true;
      argv: readonly [AtomicQualifiedArgv];
      plan: AtomicLabPlan;
    }
  | { allowlisted: false; reason: string } {
  const plan = getAtomicLabPlan(guid);
  if (!plan) {
    const reviewed = reviewAtomicLabEligibility(guid);
    return {
      allowlisted: false,
      reason: reviewed.eligible
        ? ATOMIC_QUALIFIED_START_YAML_EVAL
        : reviewed.reason
    };
  }
  if (!isAllowlistedArgv(plan.executable)) {
    return { allowlisted: false, reason: ATOMIC_QUALIFIED_START_YAML_EVAL };
  }
  return {
    allowlisted: true,
    argv: [plan.executable],
    plan
  };
}

function deniedPlan(denyReason: string): AtomicQualifiedQueuePlan {
  return {
    argvTasks: [],
    denyReason,
    jobsQueued: 0,
    queued: false,
    yamlEval: false
  };
}

export function planAtomicQualifiedCampaignQueue(input: {
  pins: ReadonlyArray<AtomicQualifiedStartPin>;
  qualificationTablesPresent: boolean;
  startable: boolean;
}): AtomicQualifiedQueuePlan {
  if (!input.startable) {
    return deniedPlan(ATOMIC_QUALIFIED_START_NOT_STARTABLE);
  }

  const atomicPins = input.pins.filter(isAtomicQualifiedExecutionPin);
  if (atomicPins.length === 0) {
    return deniedPlan(ATOMIC_QUALIFIED_START_NO_ARGV);
  }
  if (!input.qualificationTablesPresent) {
    return deniedPlan(ATOMIC_QUALIFIED_START_NO_QUALIFICATION);
  }

  const argvTasks: AtomicQualifiedArgvTask[] = [];
  for (const pin of atomicPins) {
    const resolved = resolveAtomicQualifiedStartArgv(pin.upstreamId);
    if (!resolved.allowlisted) {
      return deniedPlan(resolved.reason);
    }
    argvTasks.push({
      argv: resolved.argv,
      executable: resolved.argv[0],
      guid: normalizeAtomicLabGuid(pin.upstreamId),
      scenarioId: resolved.plan.scenarioId
    });
  }

  return {
    argvTasks,
    denyReason: null,
    jobsQueued: argvTasks.length,
    queued: true,
    yamlEval: false
  };
}
