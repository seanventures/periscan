import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  AttackTechniqueLiveDisabledBindingSchema,
  listAttackTechniqueCoverage,
  type AttackTechniqueCoverageEntry,
  type AttackTechniqueLiveDisabledBinding
} from "@periscan/shared";

const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures"
);

function readJsonSync(pathname: string): unknown {
  return JSON.parse(readFileSync(pathname, "utf8")) as unknown;
}

function atomicFixtureBindings(): AttackTechniqueLiveDisabledBinding[] {
  const scenarios = readJsonSync(
    path.join(fixturesDir, "atomic/allowlisted-scenarios.json")
  );
  if (!Array.isArray(scenarios)) {
    return [];
  }

  return scenarios.flatMap((scenario) => {
    if (
      !scenario ||
      typeof scenario !== "object" ||
      !("techniqueId" in scenario) ||
      typeof scenario.techniqueId !== "string"
    ) {
      return [];
    }

    return [
      AttackTechniqueLiveDisabledBindingSchema.parse({
        techniqueId: scenario.techniqueId,
        moduleId: "atomic.control_validation_safe"
      })
    ];
  });
}

function calderaFixtureBindings(): AttackTechniqueLiveDisabledBinding[] {
  const plan = readJsonSync(
    path.join(fixturesDir, "caldera/operation-plan-fixture.json")
  );
  if (
    !plan ||
    typeof plan !== "object" ||
    !("abilities" in plan) ||
    !Array.isArray(plan.abilities)
  ) {
    return [];
  }

  return plan.abilities.flatMap((ability) => {
    if (
      !ability ||
      typeof ability !== "object" ||
      !("techniqueId" in ability) ||
      typeof ability.techniqueId !== "string"
    ) {
      return [];
    }

    return [
      AttackTechniqueLiveDisabledBindingSchema.parse({
        techniqueId: ability.techniqueId,
        moduleId: "caldera.advanced_adversarial"
      })
    ];
  });
}

export function listLiveDisabledAttackTechniqueBindingsFromFixtures(): AttackTechniqueLiveDisabledBinding[] {
  const seen = new Set<string>();
  const bindings: AttackTechniqueLiveDisabledBinding[] = [];

  for (const binding of [
    ...atomicFixtureBindings(),
    ...calderaFixtureBindings()
  ]) {
    const key = `${binding.techniqueId}:${binding.moduleId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    bindings.push(binding);
  }

  return bindings;
}

export function listAttackTechniqueCoverageFromToolchain(): AttackTechniqueCoverageEntry[] {
  return listAttackTechniqueCoverage(
    listLiveDisabledAttackTechniqueBindingsFromFixtures()
  );
}
