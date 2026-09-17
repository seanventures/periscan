import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EvidenceArtifact } from "@periscan/shared";

import { PeriscanApi } from "../lib/api.js";
import { EvidenceScreen } from "./evidence.js";

const timestamp = "2026-07-14T12:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const missionId = "99999999-9999-4999-8999-999999999999";
const runId = "88888888-8888-4888-8888-888888888888";
const otherRunId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const evidenceId = "77777777-7777-4777-8777-777777777777";
const otherEvidenceId = "66666666-6666-4666-8666-666666666666";

const RAW_SCANNER_JSON =
  '{"tool":"gitleaks","leaks":[{"Secret":"AKIAFAKESECRET"}]}';

function artifact(
  overrides: Partial<EvidenceArtifact> = {}
): EvidenceArtifact {
  return {
    artifactType: "NormalizedEvidence",
    createdAt: timestamp,
    evidenceId,
    redactedAt: null,
    redactedSha256: null,
    redactionStatus: "NotRequired",
    relatedEntityId: runId,
    relatedEntityType: "ValidationRun",
    sensitivityLevel: "Moderate",
    sha256: "recorded-content-hash",
    storageUri: "s3://periscan/evidence/normalized.json",
    tenantId,
    updatedAt: timestamp,
    ...overrides
  };
}

function stripAnsi(value: string): string {
  return value.replace(new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "gu"), "");
}

function mockApi(overrides: {
  listEvidence?: () => Promise<EvidenceArtifact[]>;
  listMissionRuns?: (
    id: string
  ) => Promise<Array<{ evidenceIds: string[]; runId: string }>>;
}): PeriscanApi {
  return {
    apiUrl: "http://127.0.0.1:3001",
    health: async () => ({ status: "ok" }),
    listEvidence: overrides.listEvidence ?? (async () => []),
    listMissionRuns: overrides.listMissionRuns ?? (async () => []),
    ...overrides
  } as unknown as PeriscanApi;
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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("EvidenceScreen", () => {
  it("lists evidenceId, artifactType, and redactionStatus from GET /api/v1/evidence", async () => {
    const items = [
      artifact({
        artifactType: "NormalizedEvidence",
        evidenceId,
        redactionStatus: "NotRequired"
      }),
      artifact({
        artifactType: "RawModuleOutput",
        evidenceId: otherEvidenceId,
        redactionStatus: "Redacted",
        relatedEntityId: otherRunId,
        storageUri: `memory://raw/${RAW_SCANNER_JSON}`
      })
    ];
    const listEvidence = vi.fn(async () => items);
    const onStatus = vi.fn();
    const instance = render(
      <EvidenceScreen api={mockApi({ listEvidence })} onStatus={onStatus} />
    );

    const frame = await waitForFrame(
      instance,
      (text) => text.includes(evidenceId) && text.includes(otherEvidenceId)
    );

    expect(listEvidence).toHaveBeenCalledTimes(1);
    expect(frame).toMatch(/evidenceId/iu);
    expect(frame).toMatch(/artifactType/iu);
    expect(frame).toMatch(/redactionStatus/iu);
    expect(frame).toContain("NormalizedEvidence");
    expect(frame).toContain("RawModuleOutput");
    expect(frame).toContain("NotRequired");
    expect(frame).toContain("Redacted");
    expect(onStatus).toHaveBeenCalledWith("2 artifacts");
  });

  it("does not render raw scanner JSON or storage URIs as primary output", async () => {
    const instance = render(
      <EvidenceScreen
        api={mockApi({
          listEvidence: async () => [
            artifact({
              artifactType: "RawModuleOutput",
              storageUri: `memory://raw/${RAW_SCANNER_JSON}`
            })
          ]
        })}
        onStatus={() => undefined}
      />
    );

    const frame = await waitForFrame(instance, (text) =>
      text.includes(evidenceId)
    );

    expect(frame).toMatch(/raw scanner json is not shown/iu);
    expect(frame).not.toContain(RAW_SCANNER_JSON);
    expect(frame).not.toContain("AKIAFAKESECRET");
    expect(frame).not.toContain("gitleaks");
    expect(frame).not.toContain("memory://raw/");
    expect(frame).not.toContain("s3://");
  });

  it("shows an empty state when the tenant has no artifacts", async () => {
    const onStatus = vi.fn();
    const instance = render(
      <EvidenceScreen
        api={mockApi({ listEvidence: async () => [] })}
        onStatus={onStatus}
      />
    );

    const frame = await waitForFrame(instance, (text) =>
      /no evidence artifacts yet/iu.test(text)
    );

    expect(frame).toMatch(/raw scanner json is not shown/iu);
    expect(onStatus).toHaveBeenCalledWith("No evidence yet");
  });

  it("shows a load error from the evidence list", async () => {
    const onStatus = vi.fn();
    const instance = render(
      <EvidenceScreen
        api={mockApi({
          listEvidence: async () => {
            throw new Error("evidence 401");
          }
        })}
        onStatus={onStatus}
      />
    );

    const frame = await waitForFrame(instance, (text) =>
      text.includes("evidence 401")
    );

    expect(frame).toContain("evidence 401");
    expect(onStatus).toHaveBeenCalledWith("evidence 401");
  });

  it("filters to a mission's run evidence ids and stays empty when the mission has none", async () => {
    const listEvidence = vi.fn(async () => [
      artifact({ evidenceId }),
      artifact({
        artifactType: "ReportExport",
        evidenceId: otherEvidenceId,
        relatedEntityId: otherRunId
      })
    ]);
    const listMissionRuns = vi.fn(async () => [
      { evidenceIds: [evidenceId], runId }
    ]);
    const instance = render(
      <EvidenceScreen
        api={mockApi({ listEvidence, listMissionRuns })}
        missionId={missionId}
        onStatus={() => undefined}
      />
    );

    const frame = await waitForFrame(instance, (text) =>
      text.includes(evidenceId)
    );

    expect(listMissionRuns).toHaveBeenCalledWith(missionId);
    expect(frame).toContain(evidenceId);
    expect(frame).toContain(missionId);
    expect(frame).not.toContain(otherEvidenceId);

    const empty = render(
      <EvidenceScreen
        api={mockApi({
          listEvidence,
          listMissionRuns: async () => [{ evidenceIds: [], runId }]
        })}
        missionId={missionId}
        onStatus={() => undefined}
      />
    );

    const emptyFrame = await waitForFrame(empty, (text) =>
      /no evidence for this mission\/run/iu.test(text)
    );
    expect(emptyFrame).not.toContain(evidenceId);
    expect(emptyFrame).not.toContain(otherEvidenceId);
  });

  it("filters to a single run when runId is set with the mission", async () => {
    const instance = render(
      <EvidenceScreen
        api={mockApi({
          listEvidence: async () => [
            artifact({ evidenceId, relatedEntityId: runId }),
            artifact({
              evidenceId: otherEvidenceId,
              relatedEntityId: otherRunId
            })
          ],
          listMissionRuns: async () => [
            { evidenceIds: [evidenceId], runId },
            { evidenceIds: [otherEvidenceId], runId: otherRunId }
          ]
        })}
        missionId={missionId}
        onStatus={() => undefined}
        runId={runId}
      />
    );

    const frame = await waitForFrame(instance, (text) =>
      text.includes(evidenceId)
    );

    expect(frame).toContain(evidenceId);
    expect(frame).toContain(runId);
    expect(frame).not.toContain(otherEvidenceId);
  });
});

describe("PeriscanApi.listEvidence", () => {
  it("GETs /api/v1/evidence and returns parsed artifacts", async () => {
    const fetchImpl = vi.fn(async () => ({
      json: async () => ({ items: [artifact()] }),
      ok: true,
      status: 200
    }));
    vi.stubGlobal("fetch", fetchImpl);

    const items = await new PeriscanApi("http://127.0.0.1:3001").listEvidence();

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:3001/api/v1/evidence",
      expect.objectContaining({ method: "GET" })
    );
    expect(items).toEqual([artifact()]);
  });
});
