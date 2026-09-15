import type { MissionStatus, ValidationMission } from "@periscan/shared";
import { render } from "ink-testing-library";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MISSION_POLL_INTERVAL_MS,
  MissionsScreen
} from "./missions.js";

const timestamp = "2026-06-01T00:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const scopeId = "55555555-5555-4555-8555-555555555555";
const missionIdA = "44444444-4444-4444-8444-444444444444";
const missionIdB = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function mission(
  overrides: Partial<ValidationMission> = {}
): ValidationMission {
  return {
    completedAt: null,
    createdAt: timestamp,
    evidenceIds: [],
    missionId: missionIdA,
    missionType: "ValidationSnapshot",
    policyDecisionId: null,
    policyProfile: null,
    requestedBy: userId,
    safetyLevel: "ActiveNonInvasive",
    scopeId,
    scopeIds: [scopeId],
    startedAt: timestamp,
    status: "Running",
    tenantId,
    updatedAt: timestamp,
    ...overrides
  };
}

const ANSI_COLOR = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "gu");

function visible(frame: string | undefined): string {
  return (frame ?? "").replace(ANSI_COLOR, "");
}

async function waitForFrame(
  lastFrame: () => string | undefined,
  substring: string,
  timeoutMs = 1500
): Promise<string> {
  const start = Date.now();
  let frame = visible(lastFrame());
  while (!frame.includes(substring)) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(
        `Timed out waiting for ${JSON.stringify(substring)}\n${frame}`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 15));
    frame = visible(lastFrame());
  }
  return frame;
}

const mounts: Array<{ unmount: () => void }> = [];

afterEach(() => {
  for (const instance of mounts) {
    instance.unmount();
  }
  mounts.length = 0;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("MissionsScreen", () => {
  it("lists missions and shows each status", async () => {
    const listed = [
      mission({ status: "Running" }),
      mission({
        missionId: missionIdB,
        missionType: "ControlValidation",
        status: "Completed",
        completedAt: timestamp
      })
    ];
    const api = {
      listMissions: vi.fn(async () => listed),
      getMission: vi.fn(async (id: string) => {
        const found = listed.find((item) => item.missionId === id);
        if (!found) {
          throw new Error("missing");
        }
        return found;
      })
    };
    const onStatus = vi.fn();
    const instance = render(
      <MissionsScreen api={api} onStatus={onStatus} />
    );
    mounts.push(instance);

    const frame = await waitForFrame(instance.lastFrame, "ControlValidation");
    expect(frame).toContain("ValidationSnapshot");
    expect(frame).toContain("Running");
    expect(frame).toContain("Completed");
    expect(frame).toContain(missionIdA.slice(0, 8));
    expect(api.listMissions).toHaveBeenCalledOnce();
  });

  it("shows an empty state when the list is empty", async () => {
    const api = {
      listMissions: vi.fn(async () => []),
      getMission: vi.fn(async () => mission())
    };
    const instance = render(
      <MissionsScreen api={api} onStatus={vi.fn()} />
    );
    mounts.push(instance);

    const frame = await waitForFrame(instance.lastFrame, "No missions");
    expect(api.getMission).not.toHaveBeenCalled();
    expect(frame).toContain("No missions");
  });

  it("shows a list error", async () => {
    const api = {
      listMissions: vi.fn(async () => {
        throw new Error("missions 401");
      }),
      getMission: vi.fn(async () => mission())
    };
    const instance = render(
      <MissionsScreen api={api} onStatus={vi.fn()} />
    );
    mounts.push(instance);

    const frame = await waitForFrame(instance.lastFrame, "missions 401");
    expect(frame).toContain("missions 401");
    expect(api.getMission).not.toHaveBeenCalled();
  });

  it("gets the selected mission and shows its status", async () => {
    const listed = mission({ status: "Queued" });
    const detailed = mission({ status: "Running" });
    const api = {
      listMissions: vi.fn(async () => [listed]),
      getMission: vi.fn(async () => detailed)
    };
    const instance = render(
      <MissionsScreen api={api} onStatus={vi.fn()} />
    );
    mounts.push(instance);

    const frame = await waitForFrame(instance.lastFrame, "Running");
    expect(api.getMission).toHaveBeenCalledWith(missionIdA);
    expect(frame).toContain("status");
    expect(frame).toContain("Running");
  });

  it("polls getMission on a 2s interval", async () => {
    expect(MISSION_POLL_INTERVAL_MS).toBe(2_000);
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    const api = {
      listMissions: vi.fn(async () => [mission({ status: "Running" })]),
      getMission: vi.fn(async () => mission({ status: "Running" }))
    };
    const instance = render(
      <MissionsScreen api={api} onStatus={vi.fn()} />
    );
    mounts.push(instance);

    await waitForFrame(instance.lastFrame, "polling");
    expect(setIntervalSpy).toHaveBeenCalledWith(
      expect.any(Function),
      MISSION_POLL_INTERVAL_MS
    );
  });

  it("polls until Completed then stops", async () => {
    const statuses: MissionStatus[] = ["Running", "Running", "Completed"];
    const api = {
      listMissions: vi.fn(async () => [mission({ status: "Running" })]),
      getMission: vi.fn(async () => {
        const status = statuses.shift() ?? "Completed";
        return mission({
          status,
          completedAt: status === "Completed" ? timestamp : null
        });
      })
    };
    const instance = render(
      <MissionsScreen
        api={api}
        onStatus={vi.fn()}
        pollIntervalMs={30}
      />
    );
    mounts.push(instance);

    const frame = await waitForFrame(instance.lastFrame, "poll stopped", 2000);
    expect(frame).toMatch(/status\s+Completed/u);
    const calls = api.getMission.mock.calls.length;
    expect(calls).toBeGreaterThanOrEqual(3);
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(api.getMission).toHaveBeenCalledTimes(calls);
  });

  it("stops polling when status is Failed", async () => {
    const statuses: MissionStatus[] = ["Queued", "Running", "Failed"];
    const api = {
      listMissions: vi.fn(async () => [mission({ status: "Queued" })]),
      getMission: vi.fn(async () => {
        const status = statuses.shift() ?? "Failed";
        return mission({ status });
      })
    };
    const instance = render(
      <MissionsScreen
        api={api}
        onStatus={vi.fn()}
        pollIntervalMs={30}
      />
    );
    mounts.push(instance);

    const frame = await waitForFrame(instance.lastFrame, "poll stopped", 2000);
    expect(frame).toMatch(/status\s+Failed/u);
    const calls = api.getMission.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(api.getMission).toHaveBeenCalledTimes(calls);
  });

  it("does not keep polling a mission that is already terminal", async () => {
    const api = {
      listMissions: vi.fn(async () => [
        mission({ status: "Completed", completedAt: timestamp })
      ]),
      getMission: vi.fn(async () =>
        mission({ status: "Completed", completedAt: timestamp })
      )
    };
    const instance = render(
      <MissionsScreen
        api={api}
        onStatus={vi.fn()}
        pollIntervalMs={30}
      />
    );
    mounts.push(instance);

    await waitForFrame(instance.lastFrame, "poll stopped");
    expect(api.getMission).toHaveBeenCalledOnce();
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(api.getMission).toHaveBeenCalledOnce();
  });

  it("moves selection with j and gets the newly selected mission", async () => {
    const listed = [
      mission({ status: "Completed", completedAt: timestamp }),
      mission({
        missionId: missionIdB,
        missionType: "ControlValidation",
        status: "Running"
      })
    ];
    const api = {
      listMissions: vi.fn(async () => listed),
      getMission: vi.fn(async (id: string) => {
        const found = listed.find((item) => item.missionId === id);
        if (!found) {
          throw new Error("missing");
        }
        return found;
      })
    };
    const instance = render(
      <MissionsScreen api={api} onStatus={vi.fn()} />
    );
    mounts.push(instance);

    await waitForFrame(instance.lastFrame, "ControlValidation");
    expect(api.getMission).toHaveBeenCalledWith(missionIdA);
    instance.stdin.write("j");
    await waitForFrame(instance.lastFrame, missionIdB);
    expect(api.getMission).toHaveBeenCalledWith(missionIdB);
  });
});
