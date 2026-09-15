#!/usr/bin/env node
// Periscan performance baseline probe (WS4).
//
// Fires concurrent requests at a set of representative endpoints against a
// RUNNING API and reports throughput + latency percentiles per endpoint, plus a
// pass/fail against a p95 SLO. No external deps. Establishes a baseline and
// surfaces gross regressions (N+1s, unindexed queries) — it is not a substitute
// for a production load test.
//
//   PERISCAN_PERF_URL=http://127.0.0.1:3001 \
//   PERISCAN_PERF_CONCURRENCY=20 PERISCAN_PERF_DURATION_SECONDS=8 \
//     node scripts/perf-baseline.mjs
//
// Exit non-zero if any endpoint breaches its p95 SLO.
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";

const BASE = process.env.PERISCAN_PERF_URL ?? "http://127.0.0.1:3001";
const API = `${BASE}/api/v1`;
const CONCURRENCY = Number(process.env.PERISCAN_PERF_CONCURRENCY ?? "20");
const DURATION_MS =
  Number(process.env.PERISCAN_PERF_DURATION_SECONDS ?? "8") * 1000;
// p95 SLO per endpoint (ms). Dev-mode + local DB; tune for the deploy target.
const P95_SLO_MS = Number(process.env.PERISCAN_PERF_P95_SLO_MS ?? "750");
const RESULT_PATH = process.env.PERISCAN_PERF_RESULT_PATH;
const ENVIRONMENT_LABEL =
  process.env.PERISCAN_PERF_ENVIRONMENT_LABEL ?? "local-development";

function requireBoundedNumber(label, value, minimum, maximum) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(
      `${label} must be a number from ${minimum} through ${maximum}; received ${value}.`
    );
  }
  return value;
}

requireBoundedNumber("PERISCAN_PERF_CONCURRENCY", CONCURRENCY, 1, 500);
requireBoundedNumber(
  "PERISCAN_PERF_DURATION_SECONDS",
  DURATION_MS / 1000,
  1,
  300
);
requireBoundedNumber("PERISCAN_PERF_P95_SLO_MS", P95_SLO_MS, 1, 60_000);

function pct(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.floor((p / 100) * sorted.length)
  );
  return sorted[idx];
}

async function signup() {
  const res = await fetch(`${API}/auth/signup`, {
    body: JSON.stringify({
      email: `perf-${randomUUID()}@periscan.test`,
      name: "Perf Probe",
      password: "periscan-perf-password",
      tenantName: "Perf Tenant"
    }),
    headers: { "content-type": "application/json" },
    method: "POST"
  });
  if (res.status !== 201) {
    throw new Error(`signup failed: ${res.status} ${await res.text()}`);
  }
  const cookie = (res.headers.get("set-cookie") ?? "").split(";")[0];
  if (!cookie) throw new Error("no session cookie from signup");
  return cookie;
}

// Optional: seed the probe's tenant with real data so the baseline reflects
// aggregation cost under load, not an empty-tenant floor. Creates N verified
// scopes, each with a fixture posture-check that produces measured signals →
// findings. Controlled by PERISCAN_PERF_SEED_SCOPES (default 0).
const SEED_SCOPES = Number(process.env.PERISCAN_PERF_SEED_SCOPES ?? "0");
requireBoundedNumber("PERISCAN_PERF_SEED_SCOPES", SEED_SCOPES, 0, 5_000);
const DAY_MS = 24 * 60 * 60 * 1000;

async function seedTenant(cookie) {
  if (SEED_SCOPES <= 0) return;
  process.stdout.write(`seeding ${SEED_SCOPES} scopes + posture checks… `);
  for (let i = 0; i < SEED_SCOPES; i += 1) {
    const scopeRes = await fetch(`${API}/scopes`, {
      body: JSON.stringify({
        scopeType: "Domain",
        value: `perf-${i}-${randomUUID()}.example.com`
      }),
      headers: { "content-type": "application/json", cookie },
      method: "POST"
    });
    if (scopeRes.status !== 201) continue;
    const scopeId = (await scopeRes.json()).scopeId;
    await fetch(`${API}/scopes/${scopeId}/verify`, {
      body: JSON.stringify({ devModeManual: true }),
      headers: { "content-type": "application/json", cookie },
      method: "POST"
    });
    await fetch(`${API}/scopes/${scopeId}/posture-check`, {
      body: JSON.stringify({
        executionMode: "Fixture",
        fixtures: {
          "periscan.tls_certificate_check": {
            fixtureCertificate: {
              issuer: "CN=Real CA,O=CA",
              subject: "CN=perf.example.com,O=Acme",
              validFrom: new Date(Date.now() - 400 * DAY_MS).toISOString(),
              validTo: new Date(Date.now() - 10 * DAY_MS).toISOString()
            }
          }
        }
      }),
      headers: { "content-type": "application/json", cookie },
      method: "POST"
    });
  }
  process.stdout.write("done\n");
}

async function loadEndpoint(label, path, cookie) {
  // Only successful (2xx) responses count toward latency/throughput. Everything
  // else (429 rate-limit, 4xx, 5xx, network) is a failure — otherwise a fast
  // rejection would masquerade as fast success.
  const latencies = [];
  let ok = 0;
  let failed = 0;
  const byStatus = new Map();
  const deadline = Date.now() + DURATION_MS;

  async function worker() {
    while (Date.now() < deadline) {
      const start = performance.now();
      try {
        const res = await fetch(`${API}${path}`, {
          headers: cookie ? { cookie } : {}
        });
        const ms = performance.now() - start;
        byStatus.set(res.status, (byStatus.get(res.status) ?? 0) + 1);
        if (res.status >= 200 && res.status < 300) {
          ok += 1;
          latencies.push(ms);
        } else {
          failed += 1;
        }
        await res.arrayBuffer();
      } catch {
        failed += 1;
        byStatus.set(0, (byStatus.get(0) ?? 0) + 1);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  latencies.sort((a, b) => a - b);
  const throughput = (ok / DURATION_MS) * 1000;
  return {
    byStatus,
    failed,
    label,
    ok,
    p50: pct(latencies, 50),
    p95: pct(latencies, 95),
    p99: pct(latencies, 99),
    path,
    throughput
  };
}

async function main() {
  const qualificationId = randomUUID();
  const startedAt = new Date();
  console.log(
    `perf baseline → ${BASE} · concurrency=${CONCURRENCY} · duration=${DURATION_MS / 1000}s · p95 SLO=${P95_SLO_MS}ms\n`
  );
  const cookie = await signup();
  await seedTenant(cookie);

  const endpoints = [
    ["health (unauth)", "/health", null],
    ["list findings", "/findings", cookie],
    ["list attack-paths", "/attack-paths", cookie],
    ["executive trends", "/tenants/current/executive-trends", cookie],
    ["global search", "/search?q=example", cookie]
  ];

  const results = [];
  for (const [label, path, ck] of endpoints) {
    results.push(await loadEndpoint(label, path, ck));
  }

  const pad = (s, n) => String(s).padEnd(n);
  const num = (v) => `${v.toFixed(0)}`.padStart(6);
  console.log(
    `${pad("endpoint", 22)} ${pad("ok", 7)} ${pad("rps", 7)} ${pad("p50", 7)} ${pad("p95", 7)} ${pad("p99", 7)} ${pad("fail", 6)} statuses`
  );
  let bad = false;
  for (const r of results) {
    const statuses = [...r.byStatus.entries()]
      .map(([code, n]) => `${code}:${n}`)
      .join(" ");
    // Fail the gate on any failed responses OR a p95 SLO breach on a real sample.
    const sloBreach = r.ok > 0 && r.p95 > P95_SLO_MS;
    if (r.failed > 0 || sloBreach) bad = true;
    const note = r.failed > 0 ? "  ✗ failures" : sloBreach ? "  ✗ p95 SLO" : "";
    console.log(
      `${pad(r.label, 22)} ${num(r.ok)} ${num(r.throughput)} ${num(r.p50)} ${num(r.p95)} ${num(r.p99)} ${num(r.failed)}  ${statuses}${note}`
    );
  }
  const completedAt = new Date();
  const report = {
    claimBoundary:
      "This report qualifies only the declared environment and request mix. It is not a 10,000-concurrent production certification.",
    completedAt: completedAt.toISOString(),
    concurrency: CONCURRENCY,
    durationSeconds: DURATION_MS / 1000,
    environmentLabel: ENVIRONMENT_LABEL,
    p95SloMs: P95_SLO_MS,
    passed: !bad,
    productionScaleClaimValidated: false,
    qualificationId,
    results: results.map((result) => ({
      failed: result.failed,
      label: result.label,
      ok: result.ok,
      p50Ms: Number(result.p50.toFixed(3)),
      p95Ms: Number(result.p95.toFixed(3)),
      p99Ms: Number(result.p99.toFixed(3)),
      path: result.path,
      requestsPerSecond: Number(result.throughput.toFixed(3)),
      statuses: Object.fromEntries(result.byStatus)
    })),
    seedScopes: SEED_SCOPES,
    startedAt: startedAt.toISOString()
  };
  if (RESULT_PATH) {
    await writeFile(
      RESULT_PATH,
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8"
    );
    console.log(`qualification artifact → ${RESULT_PATH}`);
  }
  console.log(
    `\n${bad ? "✗ FAIL — failures or a p95 SLO breach (see rows above)" : "✓ PASS — all endpoints 2xx and within p95 SLO"}`
  );
  process.exit(bad ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
