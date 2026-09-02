import { cleanup, render } from "ink-testing-library";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PeriscanApi } from "../lib/api.js";
import { RemediationsScreen } from "./remediations.js";

const API_URL = "http://127.0.0.1:3001";
const MISSION_ID = "22222222-2222-4222-8222-222222222222";
const REMEDIATION_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const REMEDIATION_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const ANSI_COLOR = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "gu");

function stripAnsi(value: string): string {
  return value.replace(ANSI_COLOR, "");
}

type CreateResult = {
  createdCount: number;
  missionId: string;
  remediationIds: string[];
};

type VerifyResult = {
  remediation: { remediationId: string; status: string };
  verificationEvent: { measuredRevalidation: boolean; outcome: string };
};

function fakeApi(
  overrides: {
    createCommunityRemediations?: (missionId: string) => Promise<CreateResult>;
    verifyRemediation?: (remediationId: string) => Promise<VerifyResult>;
  } = {}
): PeriscanApi & {
  createCommunityRemediations: ReturnType<typeof vi.fn>;
  verifyRemediation: ReturnType<typeof vi.fn>;
} {
  const createCommunityRemediations = vi.fn(
    overrides.createCommunityRemediations ??
      (async () => ({
        createdCount: 0,
        missionId: MISSION_ID,
        remediationIds: [] as string[]
      }))
  );
  const verifyRemediation = vi.fn(
    overrides.verifyRemediation ??
      (async (remediationId: string) => ({
        remediation: { remediationId, status: "Inconclusive" },
        verificationEvent: {
          measuredRevalidation: false,
          outcome: "Inconclusive"
        }
      }))
  );
  return {
    apiUrl: API_URL,
    health: vi.fn(async () => ({ status: "ok" })),
    createCommunityRemediations,
    verifyRemediation
  } as unknown as PeriscanApi & {
    createCommunityRemediations: ReturnType<typeof vi.fn>;
    verifyRemediation: ReturnType<typeof vi.fn>;
  };
}

async function waitForFrame(
  instance: ReturnType<typeof render>,
  predicate: (frame: string) => boolean
): Promise<string> {
  return vi.waitFor(() => {
    const frame = stripAnsi(instance.lastFrame() ?? "");
    if (!predicate(frame)) {
      throw new Error(`frame:\n${frame}`);
    }
    return frame;
  });
}

async function tick(ms = 20): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function mountScreen(
  api: PeriscanApi,
  options: { missionId?: string; onStatus?: ReturnType<typeof vi.fn> } = {}
): Promise<{
  instance: ReturnType<typeof render>;
  onStatus: ReturnType<typeof vi.fn>;
}> {
  const onStatus = options.onStatus ?? vi.fn();
  const instance = render(
    <RemediationsScreen
      api={api}
      missionId={options.missionId}
      onStatus={onStatus}
    />
  );
  await waitForFrame(instance, (text) => text.includes("Create is not Fixed"));
  await vi.waitFor(() => {
    expect(onStatus).toHaveBeenCalled();
  });
  await tick();
  return { instance, onStatus };
}

async function press(
  instance: ReturnType<typeof render>,
  key: string
): Promise<void> {
  instance.stdin.write(key);
  await tick();
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("RemediationsScreen", () => {
  it("states that create is not Fixed and Fixed only follows a verification event", async () => {
    const { instance, onStatus } = await mountScreen(fakeApi());
    const frame = stripAnsi(instance.lastFrame() ?? "");

    expect(frame).toMatch(/Create is not Fixed/u);
    expect(frame).toMatch(/Fixed only after a verification event/u);
    expect(frame).toMatch(/Mission ID/u);
    expect(frame).not.toMatch(/already Fixed/u);
    expect(frame).not.toMatch(/marked Fixed/u);
    expect(onStatus).toHaveBeenCalledWith(
      expect.stringMatching(/create is not Fixed/i)
    );
  });

  it("creates remediations as Open, not Fixed", async () => {
    const api = fakeApi({
      createCommunityRemediations: async () => ({
        createdCount: 2,
        missionId: MISSION_ID,
        remediationIds: [REMEDIATION_A, REMEDIATION_B]
      })
    });
    const { instance, onStatus } = await mountScreen(api);

    await press(instance, MISSION_ID);
    await press(instance, "\r");

    const frame = await waitForFrame(
      instance,
      (text) =>
        text.includes("Opened 2 remediations") && text.includes(REMEDIATION_A)
    );

    expect(api.createCommunityRemediations).toHaveBeenCalledWith(MISSION_ID);
    expect(api.verifyRemediation).not.toHaveBeenCalled();
    expect(frame).toContain(REMEDIATION_B);
    expect(frame).toMatch(/Open/u);
    expect(frame).toMatch(/no verification event/i);
    expect(frame).toMatch(/Create is not Fixed/u);
    expect(frame).not.toMatch(/verification event · Fixed/u);
    expect(frame).not.toMatch(/already Fixed/u);
    expect(frame).not.toMatch(/marked Fixed/u);
    expect(onStatus).toHaveBeenCalledWith(
      expect.stringMatching(/Opened 2 remediations/u)
    );
    expect(onStatus).toHaveBeenCalledWith(
      expect.stringMatching(/Create is not Fixed/u)
    );
  });

  it("does not imply Fixed when Community remediations stay empty", async () => {
    const api = fakeApi({
      createCommunityRemediations: async () => ({
        createdCount: 0,
        missionId: MISSION_ID,
        remediationIds: []
      })
    });
    const { instance } = await mountScreen(api, { missionId: MISSION_ID });
    await press(instance, "\r");

    const frame = await waitForFrame(instance, (text) =>
      /No Community findings with fingerprints yet/u.test(text)
    );

    expect(api.createCommunityRemediations).toHaveBeenCalledWith(MISSION_ID);
    expect(frame).not.toMatch(/Opened/u);
    expect(frame).toMatch(/Create is not Fixed/u);
    expect(frame).not.toMatch(/already Fixed/u);
    expect(frame).not.toMatch(/status = Fixed/u);
  });

  it("verifies the selected remediation and can show Fixed only from a verification event", async () => {
    const api = fakeApi({
      createCommunityRemediations: async () => ({
        createdCount: 2,
        missionId: MISSION_ID,
        remediationIds: [REMEDIATION_A, REMEDIATION_B]
      }),
      verifyRemediation: async (remediationId) => ({
        remediation: { remediationId, status: "Fixed" },
        verificationEvent: {
          measuredRevalidation: true,
          outcome: "Fixed"
        }
      })
    });
    const { instance, onStatus } = await mountScreen(api, {
      missionId: MISSION_ID
    });
    await press(instance, "\r");
    await waitForFrame(instance, (text) => text.includes(REMEDIATION_A));
    await press(instance, "v");

    const frame = await waitForFrame(instance, (text) =>
      /verification event · Fixed \(measured\)/u.test(text)
    );

    expect(api.verifyRemediation).toHaveBeenCalledTimes(1);
    expect(api.verifyRemediation).toHaveBeenCalledWith(REMEDIATION_A);
    expect(frame).toContain(REMEDIATION_A);
    expect(frame).toMatch(/Fixed \(measured\)/u);
    expect(onStatus).toHaveBeenCalledWith(
      expect.stringMatching(/verification event/i)
    );
  });

  it("keeps Inconclusive after a compare-only verify and does not claim Fixed", async () => {
    const api = fakeApi({
      createCommunityRemediations: async () => ({
        createdCount: 1,
        missionId: MISSION_ID,
        remediationIds: [REMEDIATION_A]
      }),
      verifyRemediation: async (remediationId) => ({
        remediation: { remediationId, status: "Inconclusive" },
        verificationEvent: {
          measuredRevalidation: false,
          outcome: "Inconclusive"
        }
      })
    });
    const { instance } = await mountScreen(api, { missionId: MISSION_ID });
    await press(instance, "\r");
    await waitForFrame(instance, (text) => text.includes(REMEDIATION_A));
    await press(instance, "v");

    const frame = await waitForFrame(instance, (text) =>
      /verification event · Inconclusive/u.test(text)
    );

    expect(api.verifyRemediation).toHaveBeenCalledWith(REMEDIATION_A);
    expect(frame).toContain("Inconclusive");
    expect(frame).not.toMatch(/verification event · Fixed/u);
    expect(frame).not.toMatch(/already Fixed/u);
  });

  it("verifies the j-selected remediation, not the first row", async () => {
    const api = fakeApi({
      createCommunityRemediations: async () => ({
        createdCount: 2,
        missionId: MISSION_ID,
        remediationIds: [REMEDIATION_A, REMEDIATION_B]
      }),
      verifyRemediation: async (remediationId) => ({
        remediation: { remediationId, status: "StillExposed" },
        verificationEvent: {
          measuredRevalidation: true,
          outcome: "StillExposed"
        }
      })
    });
    const { instance } = await mountScreen(api, { missionId: MISSION_ID });
    await press(instance, "\r");
    await waitForFrame(instance, (text) => text.includes(REMEDIATION_B));
    await press(instance, "j");
    await press(instance, "v");

    await vi.waitFor(() => {
      expect(api.verifyRemediation).toHaveBeenCalledWith(REMEDIATION_B);
    });
    expect(api.verifyRemediation).not.toHaveBeenCalledWith(REMEDIATION_A);
  });

  it("does not verify before remediations exist", async () => {
    const api = fakeApi();
    const { instance } = await mountScreen(api);
    await press(instance, "v");
    await tick(40);

    expect(api.verifyRemediation).not.toHaveBeenCalled();
    expect(api.createCommunityRemediations).not.toHaveBeenCalled();
  });

  it("shows a create error without claiming Fixed", async () => {
    const api = fakeApi({
      createCommunityRemediations: async () => {
        throw new Error("Mission not found.");
      }
    });
    const { instance, onStatus } = await mountScreen(api, {
      missionId: MISSION_ID
    });
    await press(instance, "\r");

    const frame = await waitForFrame(instance, (text) =>
      text.includes("Mission not found.")
    );

    expect(frame).toContain("Mission not found.");
    expect(frame).not.toMatch(/Opened/u);
    expect(frame).not.toMatch(/already Fixed/u);
    expect(onStatus).toHaveBeenCalledWith("Mission not found.");
  });
});

describe("PeriscanApi remediations routes", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs community remediations then POST /api/v1/remediations/:id/verify", async () => {
    const { PeriscanApi } = await import("../lib/api.js");
    const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (
        method === "POST" &&
        url ===
          `${API_URL}/api/v1/community/validation-runs/${MISSION_ID}/remediations`
      ) {
        return {
          json: async () => ({
            createdCount: 1,
            missionId: MISSION_ID,
            remediationIds: [REMEDIATION_A]
          }),
          ok: true,
          status: 201
        };
      }
      if (
        method === "POST" &&
        url === `${API_URL}/api/v1/remediations/${REMEDIATION_A}/verify`
      ) {
        return {
          json: async () => ({
            remediation: { remediationId: REMEDIATION_A, status: "Fixed" },
            verificationEvent: {
              measuredRevalidation: true,
              outcome: "Fixed"
            }
          }),
          ok: true,
          status: 200
        };
      }
      return {
        json: async () => ({ error: `unhandled ${method} ${url}` }),
        ok: false,
        status: 404
      };
    });
    const api = new PeriscanApi(API_URL, {
      fetchImpl: fetchImpl as unknown as typeof fetch
    });
    const created = await api.createCommunityRemediations(MISSION_ID);
    expect(created).toEqual({
      createdCount: 1,
      missionId: MISSION_ID,
      remediationIds: [REMEDIATION_A]
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      `${API_URL}/api/v1/community/validation-runs/${MISSION_ID}/remediations`,
      expect.objectContaining({ method: "POST" })
    );
    const createInit = fetchImpl.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(createInit?.body).toBeUndefined();

    const verified = await api.verifyRemediation(REMEDIATION_A);
    expect(verified.remediation.status).toBe("Fixed");
    expect(verified.verificationEvent.outcome).toBe("Fixed");
    expect(verified.verificationEvent.measuredRevalidation).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      `${API_URL}/api/v1/remediations/${REMEDIATION_A}/verify`,
      expect.objectContaining({ method: "POST" })
    );
  });
});
