import { describe, expect, it } from "vitest";

import {
  getBasControlPlaneScenario,
  resolveBasScenarioStart,
  StartBasScenarioResultSchema
} from "./bas-control-plane";
import {
  assertCalderaAbilitiesAllowlisted,
  CalderaAdapterError,
  CalderaNormalizedOperationSchema,
  getPinnedCalderaAbility,
  listPinnedCalderaAbilities,
  listPinnedCalderaPlugins,
  normalizeCalderaOperation,
  PINNED_CALDERA_API_VERSION,
  PINNED_CALDERA_PLANNER_ID,
  PINNED_CALDERA_RELEASE,
  PINNED_CALDERA_STOCKPILE_T1033_ABILITY_ID,
  PINNED_CALDERA_STOCKPILE_T1082_ABILITY_ID,
  PINNED_CALDERA_STOCKPILE_T1083_ABILITY_ID
} from "./caldera-operations-adapter";

const SCOPE_ID = "11111111-1111-4111-8111-111111111111";

describe("Caldera operations adapter contracts (PERISCAN-587)", () => {
  it("pins Caldera v5.3.0 API v2 with stockpile abilities and the atomic planner only", () => {
    expect(PINNED_CALDERA_RELEASE).toBe("v5.3.0");
    expect(PINNED_CALDERA_API_VERSION).toBe("v2");
    expect(PINNED_CALDERA_PLANNER_ID).toBe("atomic");
    expect(
      listPinnedCalderaPlugins()
        .map((plugin) => plugin.pluginId)
        .sort()
    ).toEqual(["atomic", "stockpile"]);
    expect(
      listPinnedCalderaPlugins().find(
        (plugin) => plugin.pluginId === "stockpile"
      )
    ).toMatchObject({ role: "abilities", reviewStatus: "Reviewed" });
    expect(
      listPinnedCalderaPlugins().find((plugin) => plugin.pluginId === "atomic")
    ).toMatchObject({ role: "planner", reviewStatus: "Reviewed" });
    expect(
      listPinnedCalderaPlugins().some((plugin) =>
        ["access", "manx", "response", "sandcat", "builder"].includes(
          plugin.pluginId
        )
      )
    ).toBe(false);
  });

  it("allowlists only the reviewed discovery abilities", () => {
    const abilities = listPinnedCalderaAbilities();
    expect(abilities.map((ability) => ability.abilityId).sort()).toEqual(
      [
        PINNED_CALDERA_STOCKPILE_T1033_ABILITY_ID,
        PINNED_CALDERA_STOCKPILE_T1082_ABILITY_ID,
        PINNED_CALDERA_STOCKPILE_T1083_ABILITY_ID
      ].sort()
    );
    expect(
      getPinnedCalderaAbility(PINNED_CALDERA_STOCKPILE_T1082_ABILITY_ID)
    ).toMatchObject({
      abilityId: PINNED_CALDERA_STOCKPILE_T1082_ABILITY_ID,
      executable: false,
      pluginId: "stockpile",
      reviewStatus: "Reviewed",
      techniqueId: "T1082"
    });
    expect(
      getPinnedCalderaAbility(PINNED_CALDERA_STOCKPILE_T1083_ABILITY_ID)
    ).toMatchObject({
      pluginId: "stockpile",
      reviewStatus: "Reviewed",
      techniqueId: "T1083"
    });
    expect(PINNED_CALDERA_STOCKPILE_T1033_ABILITY_ID).toBe(
      "bd527b63-9f9e-46e0-9816-b8434d2b8989"
    );
    expect(
      getPinnedCalderaAbility(PINNED_CALDERA_STOCKPILE_T1033_ABILITY_ID)
    ).toMatchObject({
      abilityId: PINNED_CALDERA_STOCKPILE_T1033_ABILITY_ID,
      executable: false,
      name: "Current User",
      pluginId: "stockpile",
      reviewStatus: "Reviewed",
      tactic: "discovery",
      techniqueId: "T1033"
    });
    expect(abilities.every((ability) => ability.executable === false)).toBe(
      true
    );
  });

  it("rejects unreviewed abilities before any operation is created", () => {
    expect(() =>
      assertCalderaAbilitiesAllowlisted([
        PINNED_CALDERA_STOCKPILE_T1082_ABILITY_ID
      ])
    ).not.toThrow();
    expect(() =>
      assertCalderaAbilitiesAllowlisted([
        PINNED_CALDERA_STOCKPILE_T1033_ABILITY_ID
      ])
    ).not.toThrow();

    try {
      assertCalderaAbilitiesAllowlisted([
        PINNED_CALDERA_STOCKPILE_T1082_ABILITY_ID,
        "ea713bc4-63f0-491c-9a6f-0b01d560b87e"
      ]);
      throw new Error("expected unreviewed ability to be rejected");
    } catch (error) {
      expect(error).toBeInstanceOf(CalderaAdapterError);
      expect((error as CalderaAdapterError).code).toBe(
        "ability_not_allowlisted"
      );
    }
  });

  it("normalizes operation chain results without commands, output, or payloads", () => {
    const normalized = normalizeCalderaOperation({
      cancelled: false,
      operation: {
        adversary: { adversary_id: "adv-1", name: "reviewed-discovery" },
        chain: [
          {
            ability: {
              ability_id: PINNED_CALDERA_STOCKPILE_T1082_ABILITY_ID,
              name: "PowerShell version",
              plugin: "stockpile",
              technique_id: "T1082"
            },
            command: "SECRET_COMMAND",
            id: "link-1",
            output: "SECRET_OUTPUT",
            paw: "agent-paw-1",
            status: 0
          }
        ],
        id: "op-1",
        name: "periscan-reviewed-discovery",
        planner: { id: "atomic" },
        state: "finished"
      }
    });

    const parsed = CalderaNormalizedOperationSchema.parse(normalized);
    expect(parsed).toMatchObject({
      cancelled: false,
      evidenceProduced: false,
      executable: false,
      jobsQueued: 0,
      liveSupported: false,
      operationId: "op-1",
      queued: false,
      startable: false,
      state: "finished"
    });
    expect(parsed.steps).toEqual([
      {
        abilityId: PINNED_CALDERA_STOCKPILE_T1082_ABILITY_ID,
        agentPaw: "agent-paw-1",
        name: "PowerShell version",
        pluginId: "stockpile",
        reviewStatus: "Reviewed",
        status: "success",
        techniqueId: "T1082"
      }
    ]);
    expect(JSON.stringify(parsed)).not.toMatch(/SECRET_/);
    expect(JSON.stringify(parsed)).not.toMatch(/command/i);
    expect(JSON.stringify(parsed)).not.toMatch(/payload/i);
  });

  it("normalizes the reviewed T1033 Current User discovery step without command or output", () => {
    const normalized = normalizeCalderaOperation({
      cancelled: false,
      operation: {
        chain: [
          {
            ability: {
              ability_id: PINNED_CALDERA_STOCKPILE_T1033_ABILITY_ID,
              name: "Current User",
              plugin: "stockpile",
              technique_id: "T1033"
            },
            command: "whoami",
            id: "link-3",
            output: "SECRET_USER",
            paw: "agent-paw-3",
            status: 0
          }
        ],
        id: "op-t1033",
        name: "reviewed-t1033",
        planner: { id: "atomic" },
        state: "finished"
      }
    });

    expect(normalized).toMatchObject({
      evidenceProduced: false,
      executable: false,
      jobsQueued: 0,
      liveSupported: false,
      operationId: "op-t1033",
      queued: false,
      startable: false
    });
    expect(normalized.steps).toEqual([
      {
        abilityId: PINNED_CALDERA_STOCKPILE_T1033_ABILITY_ID,
        agentPaw: "agent-paw-3",
        name: "Current User",
        pluginId: "stockpile",
        reviewStatus: "Reviewed",
        status: "success",
        techniqueId: "T1033"
      }
    ]);
    expect(JSON.stringify(normalized)).not.toMatch(/SECRET_USER|whoami/i);
  });

  it("fails closed when ingest sees an unreviewed ability on the chain", () => {
    expect(() =>
      normalizeCalderaOperation({
        cancelled: false,
        operation: {
          chain: [
            {
              ability: {
                ability_id: "ea713bc4-63f0-491c-9a6f-0b01d560b87e",
                name: "Exfil staged directory",
                plugin: "stockpile",
                technique_id: "T1041"
              },
              command: "SECRET_EXFIL",
              id: "link-x",
              output: "SECRET_DATA",
              paw: "agent-paw-1",
              status: 0
            }
          ],
          id: "op-bad",
          name: "unreviewed",
          planner: { id: "atomic" },
          state: "finished"
        }
      })
    ).toThrow(CalderaAdapterError);
  });

  it("maps cancel onto unfinished steps and never claims a queued Periscan job", () => {
    const normalized = normalizeCalderaOperation({
      cancelled: true,
      operation: {
        chain: [
          {
            ability: {
              ability_id: PINNED_CALDERA_STOCKPILE_T1083_ABILITY_ID,
              name: "Print Working Directory",
              plugin: "stockpile",
              technique_id: "T1083"
            },
            id: "link-2",
            paw: "agent-paw-2",
            status: -3
          }
        ],
        id: "op-2",
        name: "cancelled-op",
        planner: { id: "atomic" },
        state: "cleanup"
      }
    });

    expect(normalized.cancelled).toBe(true);
    expect(normalized.state).toBe("cancelled");
    expect(normalized.steps[0]?.status).toBe("cancelled");
    expect(normalized.jobsQueued).toBe(0);
    expect(normalized.queued).toBe(false);
  });

  it("keeps caldera.live unstartable and refuses Denied results that claim a queue", () => {
    const catalog = getBasControlPlaneScenario("caldera.live");
    expect(catalog).toMatchObject({
      livePack: "caldera",
      moduleId: "caldera.advanced_adversarial",
      startable: false
    });

    const resolved = resolveBasScenarioStart({
      scenarioId: "caldera.live",
      scopeId: SCOPE_ID
    });
    expect(resolved.queueable).toBe(false);
    expect(resolved.livePack).toBe("caldera");
    expect(resolved.denyReason?.toLowerCase()).toMatch(
      /caldera adapter qualification/
    );
    expect(resolved.denyReason?.toLowerCase()).toMatch(/never queued/);

    expect(
      StartBasScenarioResultSchema.parse({
        claimClass: "qualification_required",
        denyReason: resolved.denyReason,
        jobsQueued: 0,
        mission: null,
        outcome: "Denied",
        policyDecisionId: SCOPE_ID,
        queued: false,
        rationale: resolved.denyReason ?? "denied",
        runs: [],
        scenarioId: "caldera.live"
      })
    ).toMatchObject({ jobsQueued: 0, outcome: "Denied", queued: false });

    expect(() =>
      StartBasScenarioResultSchema.parse({
        claimClass: "qualification_required",
        denyReason: resolved.denyReason,
        jobsQueued: 1,
        mission: null,
        outcome: "Denied",
        policyDecisionId: SCOPE_ID,
        queued: true,
        rationale: resolved.denyReason,
        runs: [],
        scenarioId: "caldera.live"
      })
    ).toThrow();
  });
});
