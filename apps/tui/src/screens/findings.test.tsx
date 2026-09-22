import { render } from "ink-testing-library";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PeriscanApi } from "../lib/api.js";
import { FindingsScreen } from "./findings.js";

const API_URL = "http://127.0.0.1:3001";
const MISSION_ID = "22222222-2222-4222-8222-222222222222";
const EVIDENCE_A = "55555555-5555-4555-8555-555555555555";
const EVIDENCE_B = "66666666-6666-4666-8666-666666666666";

const ANSI_STYLE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "gu");

function visible(frame: string | undefined): string {
  return (frame ?? "").replace(ANSI_STYLE, "");
}

function jsonResponse(body: unknown, status = 200) {
  return {
    headers: new Headers(),
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  };
}

async function waitForFrame(
  lastFrame: () => string | undefined,
  match: string | RegExp
): Promise<string> {
  return await vi.waitFor(() => {
    const frame = visible(lastFrame());
    if (typeof match === "string") {
      expect(frame).toContain(match);
    } else {
      expect(frame).toMatch(match);
    }
    return frame;
  });
}

describe("FindingsScreen", () => {
  const fetchImpl = vi.fn();
  const onStatus = vi.fn();
  let unmount: () => void = () => undefined;

  beforeEach(() => {
    fetchImpl.mockReset();
    onStatus.mockReset();
    vi.stubGlobal("fetch", fetchImpl);
  });

  afterEach(() => {
    unmount();
    vi.unstubAllGlobals();
  });

  it("shows an honest empty list, not sample findings", async () => {
    fetchImpl.mockResolvedValue(
      jsonResponse({
        items: [],
        page: { hasMore: false, limit: 100, offset: 0 }
      })
    );

    const instance = render(
      <FindingsScreen api={new PeriscanApi(API_URL)} onStatus={onStatus} />
    );
    unmount = instance.unmount;

    const frame = await waitForFrame(instance.lastFrame, "No findings");
    expect(frame).toMatch(/not a clean bill of health/i);
    expect(frame).toMatch(/4 run/i);
    expect(frame).not.toMatch(/all clear/i);
    expect(frame).not.toMatch(/sample/i);
    expect(frame).not.toMatch(/SQL injection/i);
    expect(frame).not.toMatch(/CTEM/u);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${API_URL}/api/v1/findings`);
    expect(onStatus).toHaveBeenCalledWith(
      expect.stringMatching(/no findings/i)
    );
  });

  it("does not treat an auth failure as an empty queue", async () => {
    fetchImpl.mockResolvedValue(jsonResponse({ error: "Unauthorized" }, 401));

    const instance = render(
      <FindingsScreen api={new PeriscanApi(API_URL)} onStatus={onStatus} />
    );
    unmount = instance.unmount;

    const frame = await waitForFrame(instance.lastFrame, "401");
    expect(frame).not.toMatch(/No findings/i);
    expect(frame).toMatch(/unable to read findings/i);
  });

  it("lists title, evidence count, and exploitability from GET /api/v1/findings", async () => {
    fetchImpl.mockResolvedValue(
      jsonResponse({
        items: [
          {
            title: "Repo secret to production cloud role",
            evidenceIds: [EVIDENCE_A, EVIDENCE_B],
            exploitability: "Exploitable"
          }
        ],
        page: { hasMore: false, limit: 100, offset: 0 }
      })
    );

    const instance = render(
      <FindingsScreen api={new PeriscanApi(API_URL)} onStatus={onStatus} />
    );
    unmount = instance.unmount;

    const frame = await waitForFrame(
      instance.lastFrame,
      "Repo secret to production cloud role"
    );
    expect(frame).toContain("evidence 2");
    expect(frame).toContain("Exploitable");
    expect(frame).not.toMatch(/No findings/i);
  });

  it("forwards missionId on GET /api/v1/findings?missionId=", async () => {
    fetchImpl.mockResolvedValue(
      jsonResponse({
        items: [],
        page: { hasMore: false, limit: 100, offset: 0 }
      })
    );

    const instance = render(
      <FindingsScreen
        api={new PeriscanApi(API_URL)}
        missionId={MISSION_ID}
        onStatus={onStatus}
      />
    );
    unmount = instance.unmount;

    await waitForFrame(instance.lastFrame, "No findings");
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      `${API_URL}/api/v1/findings?missionId=${MISSION_ID}`
    );
  });

  it("hints SARIF export at GET /api/v1/findings.sarif without claiming pentest or cert", async () => {
    fetchImpl.mockResolvedValue(
      jsonResponse({
        items: [
          {
            title: "Public identity path",
            evidenceIds: [EVIDENCE_A],
            exploitability: "Validated"
          }
        ],
        page: { hasMore: false, limit: 100, offset: 0 }
      })
    );

    const instance = render(
      <FindingsScreen
        api={new PeriscanApi(API_URL)}
        missionId={MISSION_ID}
        onStatus={onStatus}
      />
    );
    unmount = instance.unmount;

    const frame = await waitForFrame(
      instance.lastFrame,
      `/api/v1/findings.sarif?missionId=${MISSION_ID}`
    );
    expect(frame).toMatch(/evidence-backed/i);
    expect(frame).toMatch(/not a certification or pentest/i);
  });
});
