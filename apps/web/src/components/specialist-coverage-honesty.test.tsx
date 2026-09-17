import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  getSafetyEquivalentPack,
  listScaffoldGatedPacks
} from "@periscan/shared";

import {
  SAFETY_SCAFFOLD_CORE_IDS,
  SPECIALIST_SCAFFOLD_ROWS,
  SpecialistCoverageHonesty
} from "./specialist-coverage-honesty";

describe("SpecialistCoverageHonesty", () => {
  it("lists scorecard rows 2/16/21/22/26/28 as Scaffold/gated only", () => {
    render(<SpecialistCoverageHonesty />);

    expect(
      screen.getByRole("region", {
        name: "Specialist and partner-gated coverage"
      })
    ).toBeInTheDocument();
    expect(SPECIALIST_SCAFFOLD_ROWS.map((r) => r.id)).toEqual([
      2, 16, 21, 22, 26, 28
    ]);
    for (const row of SPECIALIST_SCAFFOLD_ROWS) {
      expect(screen.getByText(row.requirement)).toBeInTheDocument();
    }
    expect(screen.getAllByText("Scaffold/gated").length).toBeGreaterThanOrEqual(
      6
    );
    expect(
      screen.getByText(/not Available, not Validated/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/not sold as full BAS peers/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Never speaks OT protocols/i)).toBeInTheDocument();
    expect(
      screen.getByText(/No live crypto, mass lock/i)
    ).toBeInTheDocument();
  });

  it("labels Phase C claim classes and forever-refuse ransomware impact", () => {
    render(<SpecialistCoverageHonesty />);
    expect(screen.getByText("plan_only")).toBeInTheDocument();
    expect(screen.getAllByText("forever_refuse").length).toBeGreaterThanOrEqual(
      1
    );
    expect(screen.getByText("exposure_only")).toBeInTheDocument();
    expect(
      screen.getByText(/Forever refuse ransomware impact/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/dns-exfil-canary-proof/i)
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/safety-equivalent-packs/i).length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(/partner-capabilities\/honesty/i)
    ).toBeInTheDocument();

    const ransomware = SPECIALIST_SCAFFOLD_ROWS.find((r) => r.id === 21);
    expect(ransomware?.claimClass).toBe("forever_refuse");
    expect(ransomware?.canElevateSubstituteToPartial).toBe(false);
    const apt = SPECIALIST_SCAFFOLD_ROWS.find((r) => r.id === 16);
    expect(apt?.claimClass).toBe("plan_only");
    expect(apt?.safeModules).toContain("exploitation.killchain.engine");
    const identity = SPECIALIST_SCAFFOLD_ROWS.find((r) => r.id === 22);
    expect(identity?.claimClass).toBe("exposure_only");
  });

  it("exposes partner-gated honesty strip for rows 2/26/28 (Slice C)", () => {
    render(<SpecialistCoverageHonesty />);
    expect(
      screen.getByTestId("partner-gated-honesty-strip")
    ).toHaveTextContent(/no live dark-web crawl/i);
    expect(screen.getByTestId("partner-gated-honesty-strip")).toHaveTextContent(
      /partnerGatedScorecardIds/i
    );
    for (const id of [2, 26, 28]) {
      const row = screen.getByTestId(`specialist-scaffold-row-${id}`);
      expect(row).toHaveAttribute("data-gate", "Partner");
    }
  });

  it("exposes Slice D safety scaffold core strip for 16/21/22 and stays in lockstep with shared inventory", () => {
    render(<SpecialistCoverageHonesty />);
    expect(SAFETY_SCAFFOLD_CORE_IDS).toEqual([16, 21, 22]);
    expect(
      screen.getByTestId("safety-scaffold-core-honesty-strip")
    ).toHaveTextContent(/scaffoldCoreScorecardIds/i);
    expect(
      screen.getByTestId("safety-scaffold-core-honesty-strip")
    ).toHaveTextContent(/plan_only/);
    expect(
      screen.getByTestId("safety-scaffold-core-honesty-strip")
    ).toHaveTextContent(/forever_refuse/);
    expect(
      screen.getByTestId("safety-scaffold-core-honesty-strip")
    ).toHaveTextContent(/exposure_only/);

    const fromShared = listScaffoldGatedPacks();
    expect(SPECIALIST_SCAFFOLD_ROWS.map((r) => r.id)).toEqual(
      fromShared.map((p) => p.scorecardId)
    );
    for (const id of SAFETY_SCAFFOLD_CORE_IDS) {
      const row = screen.getByTestId(`specialist-scaffold-row-${id}`);
      const pack = getSafetyEquivalentPack(id);
      expect(row).toHaveAttribute("data-gate", "SafetyEquivalent");
      expect(row).toHaveAttribute("data-claim-class", pack?.claimClass ?? "");
      expect(row).toHaveAttribute(
        "data-can-elevate-substitute",
        pack?.canElevateSubstituteToPartial ? "true" : "false"
      );
    }
    // Ransomware must never elevate as ransomware emulation
    expect(
      screen.getByTestId("specialist-scaffold-row-21")
    ).toHaveAttribute("data-can-elevate-substitute", "false");
  });
});
