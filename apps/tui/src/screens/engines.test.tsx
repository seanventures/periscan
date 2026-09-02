import React from "react";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  COMMUNITY_EDITION_LICENSE_NOTE,
  COMMUNITY_EDITION_VALUE_LINE,
  COMMUNITY_VALIDATION_SUITE,
  COPYLEFT_OPT_IN_SUITE,
  CommunityValidationSuiteResponseSchema,
  type CommunityValidationSuiteResponse
} from "@periscan/shared";

import type { PeriscanApi } from "../lib/api.js";
import { EnginesScreen } from "./engines.js";

afterEach(() => {
  cleanup();
});

const ANSI_RESET = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "gu");

function visible(frame: string | undefined): string {
  return (frame ?? "").replace(ANSI_RESET, "");
}

function suiteEntry(toolId: string) {
  const entry = COMMUNITY_VALIDATION_SUITE.find((row) => row.toolId === toolId);
  if (!entry) {
    throw new Error(`missing Community suite tool ${toolId}`);
  }
  return { ...entry };
}

function copyleftEntry(toolId: string) {
  const entry = COPYLEFT_OPT_IN_SUITE.find((row) => row.toolId === toolId);
  if (!entry) {
    throw new Error(`missing copyleft tool ${toolId}`);
  }
  return { ...entry };
}

function suiteFixture(
  overrides: Partial<CommunityValidationSuiteResponse> = {}
): CommunityValidationSuiteResponse {
  return CommunityValidationSuiteResponseSchema.parse({
    cloudAwsAvailable: false,
    copyleftOptIn: {
      hint: "Copyleft engines are not in the Community start set. Opt-in after SPDX accept.",
      licensedToolIds: [],
      modules: [copyleftEntry("semgrep")]
    },
    deferredModules: [],
    editionId: "community",
    includeExternalPoa: false,
    licenseNote: COMMUNITY_EDITION_LICENSE_NOTE,
    modules: [
      suiteEntry("gitleaks"),
      suiteEntry("trivy"),
      suiteEntry("nuclei")
    ],
    runnerAvailable: false,
    scopeType: "Repository",
    startableModuleIds: ["gitleaks.repo_secrets"],
    valueLine: COMMUNITY_EDITION_VALUE_LINE,
    ...overrides
  });
}

function renderEngines(suite: CommunityValidationSuiteResponse) {
  const communitySuite = vi.fn(async () => suite);
  const onStatus = vi.fn();
  const api = {
    apiUrl: "http://127.0.0.1:3001",
    communitySuite
  } as unknown as PeriscanApi;
  const instance = render(<EnginesScreen api={api} onStatus={onStatus} />);
  return { ...instance, communitySuite, onStatus };
}

async function loadedFrame(
  suite: CommunityValidationSuiteResponse = suiteFixture()
) {
  const rendered = renderEngines(suite);
  await vi.waitFor(() => {
    expect(visible(rendered.lastFrame())).toContain("gitleaks");
  });
  return { ...rendered, frame: visible(rendered.lastFrame()) };
}

describe("EnginesScreen", () => {
  it("shows Community gitleaks/trivy/nuclei and tool_unavailable when not startable", async () => {
    const { frame, communitySuite } = await loadedFrame();

    expect(communitySuite).toHaveBeenCalled();

    const gitleaks = frame
      .split("\n")
      .find((line) => line.includes("gitleaks"));
    const trivy = frame.split("\n").find((line) => line.includes("trivy"));
    const nuclei = frame.split("\n").find((line) => line.includes("nuclei"));

    expect(gitleaks).toMatch(/startable/);
    expect(trivy).toMatch(/tool_unavailable/);
    expect(nuclei).toMatch(/tool_unavailable/);
    expect(frame).toContain("tool_unavailable");
    expect(frame).toContain("not invented findings");
  });

  it("keeps copyleft opt-in out of the Community start set", async () => {
    const { frame } = await loadedFrame();
    const community = frame.slice(
      0,
      frame.indexOf("Copyleft") === -1
        ? frame.length
        : frame.indexOf("Copyleft")
    );
    const copyleft = frame.slice(Math.max(0, frame.indexOf("Copyleft")));

    expect(community).toContain("gitleaks");
    expect(community).not.toContain("semgrep");
    expect(copyleft).toContain("semgrep");
    expect(copyleft).toContain("not in the Community start set");
    expect(copyleft).toMatch(/needs opt-in/i);
    expect(copyleft).not.toMatch(/startable/);
  });

  it("falls back to GET /api/v1/community/validation-suite via requestJson", async () => {
    const requestJson = vi.fn(async () => suiteFixture());
    const onStatus = vi.fn();
    const api = {
      apiUrl: "http://127.0.0.1:3001",
      requestJson
    } as unknown as PeriscanApi;
    const instance = render(<EnginesScreen api={api} onStatus={onStatus} />);

    await vi.waitFor(() => {
      expect(visible(instance.lastFrame())).toContain("gitleaks");
    });
    expect(requestJson).toHaveBeenCalledWith(
      "/api/v1/community/validation-suite"
    );
    instance.unmount();
  });

  it("lists theater tools as catalog-only and never install", async () => {
    const { frame } = await loadedFrame();
    const theaterAt = frame.toLowerCase().indexOf("theater");
    expect(theaterAt).toBeGreaterThanOrEqual(0);
    const theater = frame.slice(theaterAt);

    expect(theater).toMatch(/catalog only/i);
    expect(theater).toMatch(/never install/i);
    expect(theater).toContain("sqlmap");
    expect(theater).toContain("SharpHound");
    expect(theater).toContain("Atomic Red Team");
    expect(theater).toContain("Caldera");
    expect(theater).toContain("Metasploit");
    expect(theater).not.toMatch(/Accept license & install/i);
    expect(theater).not.toMatch(/Install from upstream/i);
    expect(theater).not.toMatch(/startable/);
  });
});
