import { describe, expect, it } from "vitest";

import {
  getAttackTechniqueById,
  listAttackTechniques,
  mapAttackTechniqueIds
} from "./mitre-attack";

describe("MITRE ATT&CK technique mapping", () => {
  it("resolves a known technique id to its catalog entry", () => {
    const technique = getAttackTechniqueById("T1595");
    expect(technique).not.toBeNull();
    expect(technique?.techniqueId).toBe("T1595");
  });

  it("returns null for an unknown technique id", () => {
    expect(getAttackTechniqueById("T9999")).toBeNull();
  });

  it("maps known ids and silently drops unknown ones", () => {
    const mapped = mapAttackTechniqueIds(["T1595", "T9999", "T1078"]);
    expect(mapped.map((technique) => technique.techniqueId)).toEqual([
      "T1595",
      "T1078"
    ]);
  });

  it("maps an empty id list to an empty result", () => {
    expect(mapAttackTechniqueIds([])).toEqual([]);
  });

  it("drops every id when none are known (never invents a technique)", () => {
    expect(mapAttackTechniqueIds(["T0000", "T9998"])).toEqual([]);
  });

  it("only exposes catalog techniques that match the id regex", () => {
    const all = listAttackTechniques();
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((t) => /^T\d{4}(?:\.\d{3})?$/.test(t.techniqueId))).toBe(
      true
    );
  });
});
