import { describe, expect, it } from "vitest";

import { COMMUNITY_FIRST_RUN_WATCH_LABEL } from "@periscan/shared";

import {
  CTEM_NOT_MEASURED_YET,
  CTEM_RUN_IN_FLIGHT,
  ctemStageOccupancyLabel,
  resolveCtemBoardHonesty
} from "./ctem-board-honesty";

describe("resolveCtemBoardHonesty", () => {
  it("does not show a readiness percent on New maturity", () => {
    const honesty = resolveCtemBoardHonesty({
      maturity: "New",
      nextActionLabel: "Authorize scope",
      findingsCount: 0,
      verifyStatus: "OnTrack"
    });
    expect(honesty.showPercent).toBe(false);
    expect(honesty.boardPackEnabled).toBe(false);
    expect(honesty.headline).toBe(CTEM_NOT_MEASURED_YET);
    expect(honesty.mode).toBe("not-measured");
  });

  it("does not show a readiness percent on Activating maturity", () => {
    const honesty = resolveCtemBoardHonesty({
      maturity: "Activating",
      nextActionLabel: "Run Community validation",
      findingsCount: 0,
      verifyStatus: "NotStarted"
    });
    expect(honesty.showPercent).toBe(false);
    expect(honesty.boardPackEnabled).toBe(false);
    expect(honesty.headline).toBe(CTEM_NOT_MEASURED_YET);
  });

  it("labels Watch nextAction as in-flight, not a board number", () => {
    const honesty = resolveCtemBoardHonesty({
      maturity: "Activating",
      nextActionLabel: COMMUNITY_FIRST_RUN_WATCH_LABEL,
      findingsCount: 1,
      verifyStatus: "OnTrack"
    });
    expect(honesty.showPercent).toBe(false);
    expect(honesty.boardPackEnabled).toBe(false);
    expect(honesty.headline).toBe(CTEM_RUN_IN_FLIGHT);
    expect(honesty.mode).toBe("in-flight");
  });

  it("does not enable Build board pack on empty 0 findings with Verify OnTrack", () => {
    const honesty = resolveCtemBoardHonesty({
      maturity: "Measured",
      nextActionLabel: "Continue proof loop",
      findingsCount: 0,
      verifyStatus: "OnTrack"
    });
    expect(honesty.showPercent).toBe(false);
    expect(honesty.boardPackEnabled).toBe(false);
    expect(honesty.headline).toBe(CTEM_NOT_MEASURED_YET);
  });

  it("keeps a measured percent when the program has findings", () => {
    const honesty = resolveCtemBoardHonesty({
      maturity: "Measured",
      nextActionLabel: "Continue proof loop",
      findingsCount: 3,
      verifyStatus: "OnTrack"
    });
    expect(honesty.showPercent).toBe(true);
    expect(honesty.boardPackEnabled).toBe(true);
    expect(honesty.headline).toBeNull();
    expect(honesty.mode).toBe("percent");
  });
});

describe("ctemStageOccupancyLabel", () => {
  it("does not stamp all-clear while CTEM is unmeasured or in flight", () => {
    expect(
      ctemStageOccupancyLabel(
        { mode: "not-measured", showPercent: false },
        0
      )
    ).toBe("not measured");
    expect(
      ctemStageOccupancyLabel({ mode: "in-flight", showPercent: false }, 0)
    ).toBe("in flight");
    expect(
      ctemStageOccupancyLabel({ mode: "percent", showPercent: true }, 0)
    ).toBe("clear");
    expect(
      ctemStageOccupancyLabel({ mode: "percent", showPercent: true }, 2)
    ).toBe("2 open");
  });
});
