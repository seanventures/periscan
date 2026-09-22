import React from "react";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ScreenId } from "../nav.js";
import { HomeScreen, type HomeApi } from "./home.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const ANSI_STYLE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "gu");

function stripAnsi(value: string): string {
  return value.replace(ANSI_STYLE, "");
}

function makeApi(overrides: Partial<HomeApi> = {}): HomeApi {
  return {
    apiUrl: "http://127.0.0.1:3001",
    health: vi.fn().mockResolvedValue({ status: "ok" }),
    ...overrides
  };
}

function mount(api: HomeApi = makeApi()): {
  frames: () => string;
  go: ReturnType<typeof vi.fn<(id: ScreenId) => void>>;
  onStatus: ReturnType<typeof vi.fn<(s: string) => void>>;
  stdin: { write: (data: string) => void };
} {
  const go = vi.fn<(id: ScreenId) => void>();
  const onStatus = vi.fn<(s: string) => void>();
  const instance = render(<HomeScreen api={api} go={go} onStatus={onStatus} />);
  return {
    frames: () => stripAnsi(instance.lastFrame() ?? ""),
    go,
    onStatus,
    stdin: instance.stdin
  };
}

async function waitForFrame(
  frames: () => string,
  assert: (frame: string) => void
): Promise<string> {
  let last = "";
  await vi.waitFor(() => {
    last = frames();
    assert(last);
  });
  return last;
}

describe("HomeScreen", () => {
  it("is a Proof OS terminal home, not a generic dashboard", async () => {
    const { frames } = mount();
    const frame = await waitForFrame(frames, (text) => {
      expect(text).toMatch(/PROOF OS/u);
    });

    expect(frame).toMatch(/terminal/iu);
    expect(frame).toMatch(/authorize\s+then\s+run/iu);
    expect(frame).toMatch(/Authorize scope/u);
    expect(frame).toMatch(/Nothing runs outside verified scope/u);
    expect(frame).not.toMatch(/Connect a source/iu);
    expect(frame).not.toMatch(/Run Community validation/u);
    expect(frame).not.toMatch(/Dashboard/u);
    expect(frame).not.toMatch(/Welcome back/u);
    expect(frame).not.toMatch(/Quick actions/iu);
    expect(frame).not.toMatch(/2 auth · 3 scopes/u);
    expect(frame).not.toMatch(/4 run Community/u);
    expect(frame).not.toMatch(/5 missions · 6 findings · 7 fix/u);
    expect(frame).not.toMatch(/\br runs\b/u);
    expect(frame).toMatch(/authorized local path/i);
    expect(frame).toMatch(/Gitleaks/i);
    expect(frame).not.toMatch(/governed validation/i);
    expect(frame).not.toMatch(/CTEM/u);
    expect(frame).not.toMatch(/Automated Security Validation/iu);
    expect(frame).not.toMatch(/High-danger/iu);
  });

  it("shows API health ok and the API URL", async () => {
    const health = vi.fn().mockResolvedValue({ status: "ok" });
    const { frames } = mount(makeApi({ health }));

    const frame = await waitForFrame(frames, (text) => {
      expect(text).toMatch(/\bok\b/u);
    });

    expect(health).toHaveBeenCalledTimes(1);
    expect(frame).toMatch(/API/u);
    expect(frame).toContain("http://127.0.0.1:3001");
  });

  it("shows probing, then unreachable, when health fails", async () => {
    let rejectHealth!: (error: Error) => void;
    const health = vi.fn(
      () =>
        new Promise<{ status: string }>((_resolve, reject) => {
          rejectHealth = reject;
        })
    );
    const { frames } = mount(makeApi({ health }));

    await waitForFrame(frames, (text) => {
      expect(text).toMatch(/probing/iu);
    });
    await vi.waitFor(() => {
      expect(health).toHaveBeenCalled();
      expect(typeof rejectHealth).toBe("function");
    });

    rejectHealth(new Error("health 503"));

    const frame = await waitForFrame(frames, (text) => {
      expect(text).toMatch(/unreachable/iu);
    });
    expect(frame).toContain("health 503");
    expect(frame).not.toMatch(/\bok\b/u);
  });

  it("shows last mission when the API lists missions", async () => {
    const { frames } = mount(
      makeApi({
        listMissions: vi.fn().mockResolvedValue({
          items: [
            {
              missionId: "msn_01LAST",
              missionType: "ExposureValidation",
              status: "Completed"
            }
          ]
        })
      })
    );

    const frame = await waitForFrame(frames, (text) => {
      expect(text).toContain("msn_01LAST");
    });

    expect(frame).toMatch(/LAST/u);
    expect(frame).toContain("ExposureValidation");
    expect(frame).toContain("Completed");
  });

  it("takes the first listMissions row as last (newest-first API)", async () => {
    const { frames } = mount(
      makeApi({
        listMissions: vi.fn().mockResolvedValue([
          {
            missionId: "msn_NEW",
            missionType: "FixVerification",
            status: "Running"
          },
          {
            missionId: "msn_OLD",
            missionType: "ExposureValidation",
            status: "Completed"
          }
        ])
      })
    );

    const frame = await waitForFrame(frames, (text) => {
      expect(text).toContain("msn_NEW");
    });
    expect(frame).not.toContain("msn_OLD");
  });

  it("prefers lastMission() when the API has that method", async () => {
    const { frames } = mount(
      makeApi({
        lastMission: vi.fn().mockResolvedValue({
          missionId: "msn_DIRECT",
          missionType: "ControlValidation",
          status: "Queued"
        }),
        listMissions: vi.fn().mockResolvedValue({
          items: [
            {
              missionId: "msn_LIST",
              missionType: "ExposureValidation",
              status: "Completed"
            }
          ]
        })
      })
    );

    const frame = await waitForFrame(frames, (text) => {
      expect(text).toContain("msn_DIRECT");
    });
    expect(frame).not.toContain("msn_LIST");
  });

  it("does not invent a last mission when the API has no mission method", async () => {
    const { frames } = mount(makeApi());
    const frame = await waitForFrame(frames, (text) => {
      expect(text).toMatch(/\bok\b/u);
    });

    expect(frame).not.toMatch(/\bLAST\b/u);
    expect(frame).not.toMatch(/msn_/u);
    expect(frame).not.toMatch(/no mission yet/iu);
  });

  it("invites authorize then run when the mission list is empty", async () => {
    const { frames } = mount(
      makeApi({
        listMissions: vi.fn().mockResolvedValue({ items: [] })
      })
    );

    const frame = await waitForFrame(frames, (text) => {
      expect(text).toMatch(/no mission yet/iu);
    });
    expect(frame).toMatch(/authorize then run/iu);
  });

  it("keeps last-mission failure honest without crashing the home", async () => {
    const { frames } = mount(
      makeApi({
        listMissions: vi.fn().mockRejectedValue(new Error("missions 401"))
      })
    );

    const frame = await waitForFrame(frames, (text) => {
      expect(text).toMatch(/LAST/u);
      expect(text).toMatch(/unavailable/iu);
    });
    expect(frame).toContain("missions 401");
    expect(frame).toMatch(/PROOF OS/u);
  });

  it("writes API status and the authorize-then-run duty into the footer", async () => {
    const { onStatus } = mount(
      makeApi({
        listMissions: vi.fn().mockResolvedValue({
          items: [
            {
              missionId: "msn_01LAST",
              missionType: "ExposureValidation",
              status: "Completed"
            }
          ]
        })
      })
    );

    await vi.waitFor(() => {
      expect(onStatus).toHaveBeenCalled();
      const last = onStatus.mock.calls.at(-1)?.[0] ?? "";
      expect(last).toMatch(/API ok/u);
      expect(last).toMatch(/ExposureValidation/u);
      expect(last).toMatch(/Completed/u);
      expect(last).toMatch(/enter Authorize scope/u);
      expect(last).not.toMatch(/2 authorize then 4 run/u);
    });
  });

  it("enter starts the one CTA: Authorize scope", async () => {
    const health = vi.fn().mockResolvedValue({ status: "ok" });
    const { go, stdin, frames } = mount(makeApi({ health }));
    await waitForFrame(frames, (text) => {
      expect(text).toMatch(/Authorize scope/u);
    });
    await vi.waitFor(() => {
      expect(health).toHaveBeenCalled();
    });

    stdin.write("\r");
    await vi.waitFor(() => {
      expect(go).toHaveBeenCalledWith("scopes");
    });
    expect(go).not.toHaveBeenCalledWith("login");
    expect(go).not.toHaveBeenCalledWith("validate");
  });

  it("does not treat r as a second primary", async () => {
    const health = vi.fn().mockResolvedValue({ status: "ok" });
    const { go, stdin, frames } = mount(makeApi({ health }));
    await waitForFrame(frames, (text) => {
      expect(text).toMatch(/Authorize scope/u);
    });
    await vi.waitFor(() => {
      expect(health).toHaveBeenCalled();
    });

    stdin.write("r");
    expect(go).not.toHaveBeenCalled();
  });

  it("moves the one CTA to Run Community validation after a verified scope", async () => {
    const listScopes = vi.fn().mockResolvedValue({
      items: [
        {
          scopeId: "scp_pending",
          value: "pending.example.com",
          verificationStatus: "Pending"
        },
        {
          scopeId: "scp_ok",
          value: "lab.example.com",
          verificationStatus: "Verified"
        }
      ]
    });
    const health = vi.fn().mockResolvedValue({ status: "ok" });
    const { go, stdin, frames } = mount(makeApi({ health, listScopes }));

    const frame = await waitForFrame(frames, (text) => {
      expect(text).toMatch(/Run Community validation/u);
    });
    expect(listScopes).toHaveBeenCalledTimes(1);
    expect(frame).not.toMatch(/Authorize scope/u);
    expect(frame).toMatch(/authorize\s+then\s+run/iu);
    expect(frame).not.toMatch(/Connect a source/iu);

    stdin.write("\r");
    await vi.waitFor(() => {
      expect(go).toHaveBeenCalledWith("validate");
    });
    expect(go).not.toHaveBeenCalledWith("scopes");
    expect(go).not.toHaveBeenCalledWith("login");
  });

  it("keeps Authorize scope when listed scopes are not verified", async () => {
    const { frames } = mount(
      makeApi({
        listScopes: vi.fn().mockResolvedValue([
          {
            scopeId: "scp_pending",
            verificationStatus: "Pending"
          }
        ])
      })
    );

    const frame = await waitForFrame(frames, (text) => {
      expect(text).toMatch(/Authorize scope/u);
    });
    expect(frame).not.toMatch(/Run Community validation/u);
  });

  it("keeps Authorize scope when listScopes fails instead of inventing a run", async () => {
    const { frames } = mount(
      makeApi({
        listScopes: vi.fn().mockRejectedValue(new Error("scopes 401"))
      })
    );

    const frame = await waitForFrame(frames, (text) => {
      expect(text).toMatch(/PROOF OS/u);
      expect(text).toMatch(/Authorize scope/u);
    });
    expect(frame).not.toMatch(/Run Community validation/u);
    expect(frame).toMatch(/authorize\s+then\s+run/iu);
  });
});
