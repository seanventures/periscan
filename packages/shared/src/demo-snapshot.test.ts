import { describe, expect, it } from "vitest";

import {
  PUBLIC_DEMO_SNAPSHOT_ID,
  ValidationSnapshotSchema,
  createPublicDemoValidationSnapshot
} from "./index";

describe("public demo validation snapshot", () => {
  it("returns a schema-valid deterministic sample snapshot", () => {
    const snapshot = createPublicDemoValidationSnapshot();

    expect(ValidationSnapshotSchema.parse(snapshot).snapshotId).toBe(
      PUBLIC_DEMO_SNAPSHOT_ID
    );
    expect(snapshot.summary.overview).toContain("sample data");
    expect(snapshot.metrics.topPathCount).toBe(snapshot.topAttackPaths.length);
    expect(snapshot.metrics.controlObservationCount).toBe(
      snapshot.controlObservations.length
    );
    expect(snapshot.metrics.aiRiskCount).toBe(snapshot.aiAppRisks.length);
    expect(
      snapshot.topAttackPaths.every(
        (path) => path.attackPath.evidenceIds.length > 0
      )
    ).toBe(true);
  });

  it("uses redacted sample evidence without raw secret values", () => {
    const serialized = JSON.stringify(createPublicDemoValidationSnapshot());

    expect(serialized).toContain("redacted");
    expect(serialized).not.toContain("AKIA");
    expect(serialized).not.toContain("password=");
    expect(serialized).not.toContain("raw scanner");
  });
});
