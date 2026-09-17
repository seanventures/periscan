import { afterEach, describe, expect, it } from "vitest";

/**
 * Optional Phase 2 lab E2E: product Splunk connector observe against live mocksiem.
 *
 * Runs only when PERISCAN_LAB_E2E=1 and mocksiem answers on
 * PERISCAN_LAB_SIEM_URL (default http://127.0.0.1:9200).
 *
 * Does not invent FullyMeasured multi-hop or full BAS claims.
 */
const labE2e = process.env.PERISCAN_LAB_E2E === "1";
const siemUrl = process.env.PERISCAN_LAB_SIEM_URL ?? "http://127.0.0.1:9200";

describe.skipIf(!labE2e)("lab mocksiem canary e2e (optional)", () => {
  afterEach(() => {
    // no app lifecycle here — pure HTTP against lab SIEM
  });

  it("mocksiem health + native search + splunk export", async () => {
    const health = await fetch(`${siemUrl}/health`);
    if (!health.ok) {
      throw new Error(
        `mocksiem not reachable at ${siemUrl} — start infra/lab or unset PERISCAN_LAB_E2E`
      );
    }
    const healthBody = (await health.json()) as { status?: string };
    expect(healthBody.status).toBe("ok");

    await fetch(`${siemUrl}/v1/events`, { method: "DELETE" });

    const marker = `periscan-lab-e2e-${Date.now()}`;
    const ingest = await fetch(`${siemUrl}/v1/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        marker,
        host: "marker.lab.range.test",
        source: "lab-e2e",
        techniqueId: "T1059"
      })
    });
    expect(ingest.status).toBe(201);

    const search = await fetch(
      `${siemUrl}/v1/events?marker=${encodeURIComponent(marker)}`
    );
    expect(search.ok).toBe(true);
    const searchBody = (await search.json()) as {
      total: number;
      hits: Array<{ marker?: string }>;
    };
    expect(searchBody.total).toBeGreaterThanOrEqual(1);
    expect(searchBody.hits.some((h) => h.marker === marker)).toBe(true);

    const form = new URLSearchParams({
      earliest_time: "-24h",
      latest_time: "now",
      output_mode: "json",
      search: `search index=* ("${marker}") | head 1`
    });
    const exportResp = await fetch(`${siemUrl}/services/search/jobs/export`, {
      method: "POST",
      headers: {
        authorization: "Bearer lab-token",
        "content-type": "application/x-www-form-urlencoded"
      },
      body: form
    });
    expect(exportResp.ok).toBe(true);
    const exportText = await exportResp.text();
    expect(exportText).toMatch(/"result"|_raw/);
    expect(exportText).toContain(marker);
  }, 30_000);

  it("product splunk observeControl hits mocksiem (connector package)", async () => {
    const { getConnectorByKey } = await import(
      "../../packages/connectors/src/index.js"
    );
    const connector = getConnectorByKey("splunk");
    expect(connector?.observeControl).toBeDefined();

    const marker = `periscan-lab-obs-${Date.now()}`;
    await fetch(`${siemUrl}/v1/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ marker, host: "lab", source: "lab-e2e" })
    });

    const result = await connector!.observeControl!({
      authType: "apiToken",
      config: {
        baseUrl: siemUrl,
        connectorKey: "splunk",
        correlationToken: marker,
        index: "main",
        techniqueId: "T1059",
        token: "lab-token"
      },
      integrationId: "00000000-0000-4000-8000-000000000099",
      mockMode: false,
      tenantId: "00000000-0000-4000-8000-000000000098"
    });

    expect(result).toMatchObject({
      outcome: "Logged",
      sourceType: "splunk.search.observer",
      correlationMatched: true
    });
    expect(JSON.stringify(result)).not.toContain("lab-token-secret-should-not-leak");
  }, 30_000);
});
