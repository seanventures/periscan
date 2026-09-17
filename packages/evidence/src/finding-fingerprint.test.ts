import { describe, expect, it } from "vitest";

import {
  absorbContributingSignalsIntoPathFindings,
  computePathFindingFingerprint,
  computePathFindingMaterial,
  computeSignalFindingFingerprint,
  computeSignalFindingMaterial,
  derivePathTemplateFamily,
  groupFindingsByFingerprint
} from "./finding-fingerprint.js";

const REPO_ASSET = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const REPO_ASSET_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CLOUD_ASSET = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

describe("derivePathTemplateFamily", () => {
  it("prefers patternId over methodology and name", () => {
    expect(
      derivePathTemplateFamily({
        methodology: "heuristic-pattern-correlation:other",
        name: "Some Display Name",
        patternId: "repo-secret-cloud-role"
      })
    ).toBe("repo-secret-cloud-role");
  });

  it("extracts methodology suffix when patternId is absent", () => {
    expect(
      derivePathTemplateFamily({
        methodology: "heuristic-pattern-correlation:repo-secret-cloud-role",
        name: "Repository secret to production cloud role"
      })
    ).toBe("repo-secret-cloud-role");
  });

  it("normalizes display names and strips UUIDs for stability", () => {
    expect(
      derivePathTemplateFamily({
        name: `Repo secret to production ${REPO_ASSET}`
      })
    ).toBe("repo-secret-to-production");
  });
});

describe("computeSignalFindingFingerprint", () => {
  it("is stable for the same secret on the same repo", () => {
    const base = {
      correlationKeys: ["gitleaks:aws-access-key"],
      relatedAssetIds: [REPO_ASSET],
      signalCategory: "Exposure",
      signalSubcategory: "Secret",
      sourceType: "gitleaks",
      sourceVendor: "GitHub"
    };

    const first = computeSignalFindingFingerprint(base);
    const second = computeSignalFindingFingerprint({
      ...base,
      // Order of ids/keys must not matter.
      correlationKeys: ["gitleaks:aws-access-key"],
      relatedAssetIds: [REPO_ASSET.toUpperCase()]
    });

    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).toBe(second);
  });

  it("changes when the repo (asset) changes", () => {
    const left = computeSignalFindingFingerprint({
      correlationKeys: ["gitleaks:aws-access-key"],
      relatedAssetIds: [REPO_ASSET],
      signalCategory: "Exposure",
      signalSubcategory: "Secret",
      sourceType: "gitleaks",
      sourceVendor: "GitHub"
    });
    const right = computeSignalFindingFingerprint({
      correlationKeys: ["gitleaks:aws-access-key"],
      relatedAssetIds: [REPO_ASSET_B],
      signalCategory: "Exposure",
      signalSubcategory: "Secret",
      sourceType: "gitleaks",
      sourceVendor: "GitHub"
    });
    expect(left).not.toBe(right);
  });

  it("changes when the secret correlation key changes on the same repo", () => {
    const left = computeSignalFindingFingerprint({
      correlationKeys: ["gitleaks:aws-access-key"],
      relatedAssetIds: [REPO_ASSET],
      signalCategory: "Exposure",
      signalSubcategory: "Secret",
      sourceType: "gitleaks",
      sourceVendor: "GitHub"
    });
    const right = computeSignalFindingFingerprint({
      correlationKeys: ["gitleaks:github-pat"],
      relatedAssetIds: [REPO_ASSET],
      signalCategory: "Exposure",
      signalSubcategory: "Secret",
      sourceType: "gitleaks",
      sourceVendor: "GitHub"
    });
    expect(left).not.toBe(right);
  });

  it("builds a human root-cause summary", () => {
    const material = computeSignalFindingMaterial({
      relatedAssetIds: [REPO_ASSET],
      signalCategory: "Exposure",
      signalSubcategory: "Secret",
      sourceType: "gitleaks",
      sourceVendor: "GitHub"
    });
    expect(material.groupKey).toContain("signal");
    expect(material.rootCauseSummary).toMatch(/Exposure \/ Secret/);
    expect(material.rootCauseSummary).toMatch(/1 linked asset/);
  });
});

describe("computePathFindingFingerprint", () => {
  it("uses template family + assets, not path UUIDs", () => {
    const material = computePathFindingMaterial({
      assetCorrelationKeys: [REPO_ASSET, CLOUD_ASSET],
      methodology: "heuristic-pattern-correlation:repo-secret-cloud-role",
      name: "Repository secret to production cloud role",
      patternId: "repo-secret-cloud-role"
    });

    expect(material.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(material.groupKey).toContain("path|repo-secret-cloud-role");
    expect(material.groupKey).toContain(REPO_ASSET);
    // Fingerprint is a digest of the template+assets material, not a raw path UUID.
    expect(material.fingerprint).not.toBe(REPO_ASSET);
    expect(material.groupKey.startsWith("v1|path|")).toBe(true);
  });

  it("same template different assets → distinct fingerprints", () => {
    const shared = {
      methodology: "heuristic-pattern-correlation:repo-secret-cloud-role",
      name: "Repository secret to production cloud role",
      patternId: "repo-secret-cloud-role"
    };
    const left = computePathFindingFingerprint({
      ...shared,
      assetCorrelationKeys: [REPO_ASSET, CLOUD_ASSET]
    });
    const right = computePathFindingFingerprint({
      ...shared,
      assetCorrelationKeys: [REPO_ASSET_B, CLOUD_ASSET]
    });
    expect(left).not.toBe(right);
  });

  it("same template same assets → same fingerprint even when name varies", () => {
    const assets = [CLOUD_ASSET, REPO_ASSET];
    const left = computePathFindingFingerprint({
      assetCorrelationKeys: assets,
      methodology: "heuristic-pattern-correlation:repo-secret-cloud-role",
      name: "Repository secret to production cloud role"
    });
    const right = computePathFindingFingerprint({
      // Asset order reversed; name has a trailing UUID that must be ignored.
      assetCorrelationKeys: [...assets].reverse(),
      methodology: "heuristic-pattern-correlation:repo-secret-cloud-role",
      name: `Repository secret to production cloud role (${REPO_ASSET})`
    });
    expect(left).toBe(right);
  });
});

describe("groupFindingsByFingerprint", () => {
  it("merges first/last seen, unions assets/evidence, sums occurrences", () => {
    const fingerprint = computePathFindingFingerprint({
      assetCorrelationKeys: [REPO_ASSET],
      name: "Repo secret path",
      patternId: "repo-secret-cloud-role"
    });
    const material = computePathFindingMaterial({
      assetCorrelationKeys: [REPO_ASSET],
      name: "Repo secret path",
      patternId: "repo-secret-cloud-role"
    });

    const grouped = groupFindingsByFingerprint([
      {
        createdAt: "2026-07-01T00:00:00.000Z",
        evidenceIds: ["eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"],
        findingId: "path-1",
        fingerprint,
        groupKey: material.groupKey,
        occurrenceCount: 1,
        relatedAssetIds: [REPO_ASSET],
        rootCauseSummary: material.rootCauseSummary,
        sourceEntityType: "AttackPath",
        updatedAt: "2026-07-01T00:00:00.000Z",
        validationState: "Validated"
      },
      {
        createdAt: "2026-07-10T00:00:00.000Z",
        evidenceIds: ["ffffffff-ffff-4fff-8fff-ffffffffffff"],
        findingId: "path-2",
        fingerprint,
        groupKey: material.groupKey,
        occurrenceCount: 2,
        relatedAssetIds: [CLOUD_ASSET],
        sourceEntityType: "AttackPath",
        updatedAt: "2026-07-12T00:00:00.000Z",
        validationState: "Validated"
      }
    ]);

    expect(grouped).toHaveLength(1);
    const row = grouped[0]!;
    expect(row.fingerprint).toBe(fingerprint);
    expect(row.occurrenceCount).toBe(3);
    expect(row.firstSeenAt).toBe("2026-07-01T00:00:00.000Z");
    expect(row.lastSeenAt).toBe("2026-07-12T00:00:00.000Z");
    expect(row.relatedAssetIds).toEqual(
      [CLOUD_ASSET, REPO_ASSET].sort((a, b) => a.localeCompare(b))
    );
    expect(row.affectedAssetCount).toBe(2);
    expect(row.evidenceIds).toHaveLength(2);
    expect(row.memberFindingIds).toEqual(["path-1", "path-2"]);
    // Claim language preserved from representative — not invented.
    expect(row.validationState).toBe("Validated");
  });

  it("keeps distinct fingerprints as separate groups", () => {
    const leftFp = computePathFindingFingerprint({
      assetCorrelationKeys: [REPO_ASSET],
      patternId: "repo-secret-cloud-role",
      name: "a"
    });
    const rightFp = computePathFindingFingerprint({
      assetCorrelationKeys: [REPO_ASSET_B],
      patternId: "repo-secret-cloud-role",
      name: "a"
    });

    const grouped = groupFindingsByFingerprint([
      {
        findingId: "a",
        fingerprint: leftFp,
        relatedAssetIds: [REPO_ASSET],
        sourceEntityType: "AttackPath"
      },
      {
        findingId: "b",
        fingerprint: rightFp,
        relatedAssetIds: [REPO_ASSET_B],
        sourceEntityType: "AttackPath"
      }
    ]);

    expect(grouped).toHaveLength(2);
  });

  it("does not invent stronger claim language when merging mixed states", () => {
    const fingerprint = computeSignalFindingFingerprint({
      relatedAssetIds: [REPO_ASSET],
      signalCategory: "Exposure",
      signalSubcategory: "Secret",
      sourceType: "gitleaks",
      sourceVendor: "GitHub"
    });

    const grouped = groupFindingsByFingerprint([
      {
        createdAt: "2026-07-01T00:00:00.000Z",
        findingId: "sig-old",
        fingerprint,
        // Older row is only Discovered — must remain the claim if chosen, or at
        // least never become Validated unless a representative already is.
        validationState: "Discovered",
        exploitability: "Unknown"
      },
      {
        createdAt: "2026-07-02T00:00:00.000Z",
        findingId: "sig-new",
        fingerprint,
        validationState: "Discovered",
        exploitability: "Unknown"
      }
    ]);

    expect(grouped).toHaveLength(1);
    // Representative is oldest; claims stay Discovered/Unknown — not upgraded.
    expect(grouped[0]!.validationState).toBe("Discovered");
    expect(grouped[0]!.exploitability).toBe("Unknown");
    expect(grouped[0]!.occurrenceCount).toBe(2);
  });
});

describe("absorbContributingSignalsIntoPathFindings", () => {
  it("absorbs signals that feed a path into the path occurrence", () => {
    const pathId = "99999999-9999-4999-8999-999999999999";
    const pathFp = computePathFindingFingerprint({
      assetCorrelationKeys: [REPO_ASSET, CLOUD_ASSET],
      patternId: "repo-secret-cloud-role",
      name: "Repository secret to production cloud role"
    });
    const signalFp = computeSignalFindingFingerprint({
      correlationKeys: ["gitleaks:aws-access-key"],
      relatedAssetIds: [REPO_ASSET],
      signalCategory: "Exposure",
      signalSubcategory: "Secret",
      sourceType: "gitleaks",
      sourceVendor: "GitHub"
    });

    type Row = {
      createdAt?: string;
      evidenceIds?: string[];
      findingId: string;
      fingerprint: string;
      lastSeenAt?: string | null;
      occurrenceCount?: number;
      relatedAssetIds?: string[];
      relatedPathIds?: string[];
      sourceEntityType: string;
      updatedAt?: string;
      validationState?: string;
    };

    const absorbed = absorbContributingSignalsIntoPathFindings<Row>([
      {
        createdAt: "2026-07-01T00:00:00.000Z",
        evidenceIds: ["eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"],
        findingId: pathId,
        fingerprint: pathFp,
        occurrenceCount: 1,
        relatedAssetIds: [REPO_ASSET, CLOUD_ASSET],
        relatedPathIds: [pathId],
        sourceEntityType: "AttackPath",
        updatedAt: "2026-07-01T00:00:00.000Z",
        validationState: "Validated"
      },
      {
        createdAt: "2026-07-05T00:00:00.000Z",
        evidenceIds: ["ffffffff-ffff-4fff-8fff-ffffffffffff"],
        findingId: "signal-1",
        fingerprint: signalFp,
        occurrenceCount: 1,
        relatedAssetIds: [REPO_ASSET],
        relatedPathIds: [pathId],
        sourceEntityType: "Signal",
        updatedAt: "2026-07-05T00:00:00.000Z",
        validationState: "Validated"
      },
      {
        // Unrelated signal (different path) stays standalone.
        createdAt: "2026-07-06T00:00:00.000Z",
        findingId: "signal-2",
        fingerprint: signalFp,
        relatedAssetIds: [REPO_ASSET_B],
        relatedPathIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01"],
        sourceEntityType: "Signal",
        updatedAt: "2026-07-06T00:00:00.000Z"
      }
    ]);

    expect(absorbed).toHaveLength(2);
    const path = absorbed.find((row) => row.findingId === pathId)!;
    expect(path.occurrenceCount).toBe(2);
    expect(path.evidenceIds).toHaveLength(2);
    expect(path.lastSeenAt).toBe("2026-07-05T00:00:00.000Z");
    // Path claim language unchanged (not invented/upgraded from signal).
    expect(path.validationState).toBe("Validated");
    expect(path.sourceEntityType).toBe("AttackPath");

    const leftover = absorbed.find((row) => row.findingId === "signal-2");
    expect(leftover).toBeDefined();
  });

  it("leaves signals alone when no path is linked", () => {
    const rows = [
      {
        findingId: "signal-only",
        fingerprint: "abc",
        relatedPathIds: [],
        sourceEntityType: "Signal" as const
      }
    ];
    expect(absorbContributingSignalsIntoPathFindings(rows)).toEqual(rows);
  });
});
