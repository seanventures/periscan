import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import { ingestThreatIntelItems } from "../../apps/api/src/services/threat-intel-catalog.js";
import { createPrismaClient } from "../../packages/db/src/client.js";

/**
 * Proves the global super-feed catalog dedupes the SAME canonical threat across
 * feeds: one ThreatIntelItem, one provenance row per source, worst-wins merge,
 * and an honest new-vs-merged count (the basis for realtime new-item alerts).
 */
describe("Global threat-intel catalog dedup + merge", () => {
  const prisma = createPrismaClient();
  // Unique per run so the GLOBAL (non-tenant-scoped) catalog doesn't collide.
  const cveId = `CVE-2026-${BigInt(
    `0x${randomUUID().replaceAll("-", "").slice(0, 16)}`
  ).toString()}`;
  const canonicalKey = `cve:${cveId}`;

  afterAll(async () => {
    await prisma.threatIntelItem.deleteMany({ where: { canonicalKey } });
    await prisma.$disconnect();
  });

  it("creates once, then merges a second feed's report worst-wins with provenance", async () => {
    // Feed A (NVD-like): High severity, no KEV.
    const first = await ingestThreatIntelItems(prisma, [
      {
        kind: "Vulnerability",
        canonicalKey,
        title: `${cveId} in acme/widget`,
        summary: "Initial NVD summary.",
        cveIds: [cveId],
        cvssScore: 7.5,
        epssScore: 0.2,
        severity: "High",
        kev: false,
        techniqueIds: ["T1190"],
        tags: ["nvd"],
        publishedAt: "2026-06-10T00:00:00.000Z",
        sourceKey: "nvd",
        externalId: cveId
      }
    ]);

    expect(first.created).toBe(1);
    expect(first.merged).toBe(0);
    expect(first.newProvenance).toBe(1);

    // Feed B (CISA KEV): escalates to Critical + KEV + ransomware, adds a CVE.
    const second = await ingestThreatIntelItems(prisma, [
      {
        kind: "Vulnerability",
        canonicalKey,
        title: "later KEV report",
        summary: "",
        cveIds: [cveId, `${cveId}`],
        cvssScore: 9.1,
        severity: "Critical",
        kev: true,
        kevRansomware: true,
        techniqueIds: ["T1059"],
        tags: ["cisa-kev"],
        sourceKey: "cisa-kev",
        externalId: cveId
      }
    ]);

    // Same canonical record — created again is 0, it merged.
    expect(second.created).toBe(0);
    expect(second.merged).toBe(1);
    expect(second.newProvenance).toBe(1);

    const item = await prisma.threatIntelItem.findUniqueOrThrow({
      where: { canonicalKey },
      include: { provenance: { orderBy: { sourceKey: "asc" } } }
    });

    // ONE canonical item, deduped across both feeds.
    expect(item.sourceCount).toBe(2);
    expect(item.provenance.map((p) => p.sourceKey)).toEqual([
      "cisa-kev",
      "nvd"
    ]);
    // Worst-wins merge: never downgraded by a later report.
    expect(item.severity).toBe("Critical");
    expect(item.kev).toBe(true);
    expect(item.kevRansomware).toBe(true);
    expect(item.cvssScore).toBe(9.1);
    expect(item.epssScore).toBe(0.2);
    expect(item.techniqueIds.sort()).toEqual(["T1059", "T1190"]);
    expect(item.tags.sort()).toEqual(["cisa-kev", "nvd"]);
    // Earliest known publish retained; non-empty title preserved.
    expect(item.publishedAt?.toISOString()).toBe("2026-06-10T00:00:00.000Z");
    expect(item.title).toBe(`${cveId} in acme/widget`);
  });

  it("re-ingesting the same feed is idempotent (no provenance/sourceCount inflation)", async () => {
    const again = await ingestThreatIntelItems(prisma, [
      {
        kind: "Vulnerability",
        canonicalKey,
        title: `${cveId} in acme/widget`,
        cveIds: [cveId],
        severity: "High",
        sourceKey: "nvd",
        externalId: cveId
      }
    ]);
    expect(again.created).toBe(0);
    expect(again.merged).toBe(1);
    expect(again.newProvenance).toBe(0);

    const item = await prisma.threatIntelItem.findUniqueOrThrow({
      where: { canonicalKey }
    });
    // Still exactly two sources after a same-feed re-poll.
    expect(item.sourceCount).toBe(2);
    // Severity not downgraded by the re-report.
    expect(item.severity).toBe("Critical");
  });

  it("rejects malformed items instead of silently dropping them", async () => {
    const result = await ingestThreatIntelItems(prisma, [
      { kind: "Vulnerability" }, // missing canonicalKey/title/sourceKey
      { not: "an item" }
    ]);
    expect(result.rejected).toBe(2);
    expect(result.ingested).toBe(0);
  });
});
