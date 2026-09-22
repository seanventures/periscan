import React from "react";
import { render } from "ink-testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CAMPAIGN_DAG_EMPTY_TITLE,
  CAMPAIGN_DAG_NOT_EXECUTED_COVERAGE,
  HIGH_DANGER_ACK_CHECKBOX_LABEL,
  HIGH_DANGER_ACK_DIGEST,
  HIGH_DANGER_SECTION_COPY,
  HIGH_DANGER_SECTION_TITLE,
  listDangerCatalog
} from "@periscan/shared";

import { BasScreen, type BasApi } from "./bas.js";

const SCOPE_ID = "22222222-2222-4222-8222-222222222222";
const COMPILED_DIGEST = "ab".repeat(32);

const VERIFIED_SCOPE = {
  scopeId: SCOPE_ID,
  scopeType: "Domain",
  value: "canary.example.com",
  verificationStatus: "Verified" as const
};

function campaignPin(
  overrides: {
    dependsOn?: string[];
    provider?: string;
    stepKey?: string;
    typedInputs?: Record<string, string | number | boolean>;
    upstreamId?: string;
  } = {}
) {
  return {
    dependsOn: overrides.dependsOn ?? [],
    provider: overrides.provider ?? "ControlPlane",
    stepKey: overrides.stepKey,
    typedInputs: overrides.typedInputs ?? {},
    upstreamId: overrides.upstreamId ?? "control.detection.benign-marker"
  };
}

function compileResult(input?: {
  denyReason?: string | null;
  pins?: ReturnType<typeof campaignPin>[];
  startable?: boolean;
  graph?: {
    edges: Array<{ from: string; to: string }>;
    executionOrder: string[];
    nodes: string[];
  };
}) {
  const pins = input?.pins ?? [campaignPin({ stepKey: "marker" })];
  const executionOrder =
    input?.graph?.executionOrder ??
    pins.map((pin) => pin.stepKey ?? pin.upstreamId);
  const nodes = input?.graph?.nodes ?? executionOrder;
  const edges = input?.graph?.edges ?? [];
  const startable = input?.startable ?? false;
  return {
    denyReason: input?.denyReason ?? "Campaign start is denied.",
    jobsQueued: 0 as const,
    queued: false as const,
    startable,
    plan: {
      compiledDigest: COMPILED_DIGEST,
      startable,
      scenarioPins: pins,
      dependencyGraph: { edges, executionOrder, nodes }
    }
  };
}

let screen: ReturnType<typeof render> | undefined;

afterEach(() => {
  screen?.unmount();
  screen = undefined;
});

const ANSI_COLOR = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "gu");

function visible(): string {
  return (screen?.lastFrame() ?? "").replace(ANSI_COLOR, "");
}

function visibleFlat(): string {
  return visible().replace(/\s+/gu, " ").trim();
}

async function frameHas(text: string | RegExp) {
  await vi.waitFor(() => {
    const frame = visibleFlat();
    if (typeof text === "string") {
      expect(frame).toContain(text);
    } else {
      expect(frame).toMatch(text);
    }
  });
}

async function loaded() {
  await frameHas("canary.example.com");
  await vi.waitFor(() => {
    expect(visible()).not.toContain("Loading BAS operator gate");
  });
}

function mockApi(overrides: Partial<BasApi> = {}): BasApi {
  const api: BasApi = {
    listScopes: vi.fn(async () => [VERIFIED_SCOPE]),
    getBasDangerOperatorGate: vi.fn(async () => ({
      available: true,
      items: listDangerCatalog(),
      qualified: false,
      tenantAuthorized: false
    })),
    compileBasCampaign: vi.fn(async () => compileResult()),
    startBasCampaign: vi.fn(async () => ({
      compiledDigest: COMPILED_DIGEST,
      denyReason: "Start disabled.",
      jobsQueued: 0,
      outcome: "Denied",
      queued: false,
      startable: false
    })),
    cancelBasCampaign: vi.fn(async () => ({ cancelled: true })),
    ...overrides
  };
  return api;
}

function mount(api: BasApi = mockApi()) {
  screen = render(<BasScreen api={api} onStatus={vi.fn()} />);
  return api;
}

describe("BasScreen", () => {
  it("shows an honest empty DAG that is not executed coverage and keeps Start disabled", async () => {
    const api = mount();

    await loaded();
    await frameHas(CAMPAIGN_DAG_EMPTY_TITLE);
    const frame = visibleFlat();
    expect(frame).toContain(CAMPAIGN_DAG_NOT_EXECUTED_COVERAGE);
    expect(frame).toMatch(/not executed coverage/i);
    expect(frame).toMatch(/liveSupported false/i);
    expect(frame).not.toMatch(/liveSupported true/i);
    expect(frame).toMatch(/Start disabled/i);
    expect(frame).not.toMatch(/executedCoverage:\s*true/i);
    expect(api.compileBasCampaign).not.toHaveBeenCalled();
    expect(api.startBasCampaign).not.toHaveBeenCalled();

    screen?.stdin.write("s");
    await frameHas("Start disabled");
    expect(api.startBasCampaign).not.toHaveBeenCalled();
  });

  it("keeps unreviewed compiled DAGs fail-closed with Start disabled and jobsQueued 0", async () => {
    const denyReason =
      "Unreviewed BAS content cannot execute. Campaign start is denied and jobs are not queued.";
    const api = mount(
      mockApi({
        compileBasCampaign: vi.fn(async () =>
          compileResult({
            denyReason,
            pins: [
              campaignPin({
                provider: "AtomicRedTeam",
                stepKey: "unreviewed",
                upstreamId: "T1082"
              })
            ],
            startable: false
          })
        )
      })
    );

    await loaded();
    screen?.stdin.write("c");
    await frameHas("unreviewed");
    const frame = visibleFlat();
    expect(frame).toContain(CAMPAIGN_DAG_NOT_EXECUTED_COVERAGE);
    expect(frame).toMatch(/not live executable/i);
    expect(frame).toContain(denyReason);
    expect(frame).toMatch(/jobsQueued 0/i);
    expect(frame).toMatch(/Start disabled/i);
    expect(frame).toMatch(/liveSupported false/i);
    expect(frame).toMatch(/Denied never queues/i);

    screen?.stdin.write("s");
    await frameHas("Start disabled");
    expect(api.startBasCampaign).not.toHaveBeenCalled();
  });

  it("keeps live pack Start disabled with jobsQueued 0 and liveSupported false", async () => {
    const denyReason =
      "Atomic adapter qualification is required before live execution. Denied tasks are never queued.";
    const api = mount(
      mockApi({
        compileBasCampaign: vi.fn(async () =>
          compileResult({
            denyReason,
            pins: [
              campaignPin({ stepKey: "marker", typedInputs: { timeout: 30 } }),
              campaignPin({
                dependsOn: ["marker"],
                stepKey: "atomic",
                upstreamId: "atomic.live"
              }),
              campaignPin({
                dependsOn: ["atomic"],
                stepKey: "caldera",
                upstreamId: "caldera.live"
              }),
              campaignPin({
                dependsOn: ["caldera"],
                stepKey: "metasploit",
                upstreamId: "metasploit.live"
              })
            ],
            graph: {
              edges: [
                { from: "atomic", to: "marker" },
                { from: "caldera", to: "atomic" },
                { from: "metasploit", to: "caldera" }
              ],
              executionOrder: ["marker", "atomic", "caldera", "metasploit"],
              nodes: ["marker", "atomic", "caldera", "metasploit"]
            },
            startable: false
          })
        )
      })
    );

    await loaded();
    screen?.stdin.write("c");
    await frameHas("atomic");
    const frame = visibleFlat();
    expect(frame).toContain(CAMPAIGN_DAG_NOT_EXECUTED_COVERAGE);
    expect(frame).toMatch(/not live executable/i);
    expect(frame).toMatch(/jobsQueued 0/i);
    expect(frame).toMatch(/Start disabled/i);
    expect(frame).toMatch(/liveSupported false/i);
    expect(frame).not.toMatch(/liveSupported true/i);
    expect(frame).toMatch(/Denied never queues/i);

    screen?.stdin.write("s");
    await frameHas("Start disabled");
    expect(api.startBasCampaign).not.toHaveBeenCalled();
  });

  it("keeps High-danger Start disabled until qualify, authorize, and extra ack", async () => {
    const catalog = listDangerCatalog();
    const api = mount(
      mockApi({
        getBasDangerOperatorGate: vi.fn(async () => ({
          available: true,
          items: catalog,
          qualified: true,
          tenantAuthorized: true
        })),
        compileBasCampaign: vi.fn(async () =>
          compileResult({
            denyReason: null,
            pins: [
              campaignPin({
                upstreamId: "exploitation.impact_t1486"
              })
            ],
            startable: false
          })
        ),
        startBasCampaign: vi.fn(async () => ({
          compiledDigest: COMPILED_DIGEST,
          denyReason: null,
          jobsQueued: 0,
          outcome: "Allowed",
          queued: false,
          startable: true
        }))
      })
    );

    await loaded();
    await frameHas(HIGH_DANGER_SECTION_TITLE);
    const before = visibleFlat();
    expect(before).toContain(HIGH_DANGER_SECTION_COPY);
    expect(before).toContain(HIGH_DANGER_ACK_CHECKBOX_LABEL);
    expect(before).toMatch(/\bqualified\b/i);
    expect(before).not.toMatch(/qualification required/i);
    expect(before).toMatch(/\bauthorized\b/i);
    expect(before).not.toMatch(/authorization denied/i);
    expect(before).toMatch(/Start disabled/i);
    expect(before).toContain("T1486");
    expect(before).toContain("Ransomware / impact (T1486)");
    expect(before).not.toMatch(/\[x\].*High-danger/iu);

    screen?.stdin.write("s");
    await frameHas("Start disabled");
    expect(api.compileBasCampaign).not.toHaveBeenCalled();
    expect(api.startBasCampaign).not.toHaveBeenCalled();

    screen?.stdin.write("a");
    await frameHas(/\[x\]/i);
    const acked = visibleFlat();
    expect(acked).toContain(HIGH_DANGER_ACK_CHECKBOX_LABEL);
    expect(acked).not.toMatch(/Start disabled/i);

    screen?.stdin.write("s");
    await vi.waitFor(() => {
      expect(api.startBasCampaign).toHaveBeenCalled();
    });
    expect(api.startBasCampaign).toHaveBeenCalledWith(
      expect.objectContaining({
        compiledDigest: COMPILED_DIGEST,
        dangerAckDigest: HIGH_DANGER_ACK_DIGEST,
        dangerAcknowledged: true
      })
    );
  });

  it("does not enable High-danger Start from the acknowledgement checkbox alone", async () => {
    const api = mount();
    await loaded();
    await frameHas(HIGH_DANGER_SECTION_TITLE);
    expect(visibleFlat()).toMatch(/qualification required/i);
    expect(visibleFlat()).toMatch(/authorization denied/i);

    screen?.stdin.write("a");
    await frameHas(/\[x\]/i);
    expect(visibleFlat()).toMatch(/Start disabled/i);

    screen?.stdin.write("s");
    await frameHas("Start disabled");
    expect(api.startBasCampaign).not.toHaveBeenCalled();
  });
});
