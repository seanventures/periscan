# E2E Swarm S5 — ASV/EASM + CSV cloud + Connector Production qualification

**Agent:** Swarm S5  
**Date:** 2026-07-31  
**Worktree:** `overnight-loop`  
**Scope:** Close E2E acceptance for (1) ASV/EASM discover path, (2) CSV measured cloud config loop, (3) connector Production dry-run + elevation gate with catalog honesty **0 Production**.

## Contracts

| Rule | Enforcement |
| --- | --- |
| Real-first | Product data from real persistence, mock runner, or stubbed vendor HTTP — no fabricated Production cert |
| Scope-authorized only | Discover + continuous EASM require **Verified** scope; no autonomous CT/whois pivot |
| Heuristic vs Measured | Path `evidenceBasis` / edges never upgrade hypothesis multi-signal correlation to Measured; Measured only from authoritative-config or hop receipts |
| Fixed only via verification | CSV loop uses connector resync re-validation (`digitalocean-fix-verification-flow`) |
| No fake Production | Catalog `availability !== Production` and `certificationLevel !== Certified` until receipt gate + Plane evidence |

Forbidden by this swarm: fake Production cert, fake live partner keys, autonomous CT/whois without scope.

---

## 1. ASV/EASM discover path (matrix #1)

### Product path

```text
User-declared Verified scope
  → Continuous EASM allowlist (schedule) / recon discover task (runner)
  → Signed InternalRunner task
  → Mock runner result (evidence + signals)
  → SignalEnvelope + graph projection
  → Snapshot path correlation
  → Honest Heuristic vs Measured labels
```

### What is **not** claimed

- Not full autonomous external ASV / living map / terrain swarm  
- Not cert-transparency or whois seed expansion  
- Not Atomic / Caldera / SharpHound / exploit modules on continuous or discover allowlists  
- Multi-signal pattern paths remain **Heuristic** (never Validated/Exploitable from inference alone)

### Acceptance

| File | Proves |
| --- | --- |
| `tests/acceptance/asv-easm-discover-path-flow.test.ts` | Continuous EASM allowlist honesty; verified-scope discover dispatch; deny unverified/offensive; mock runner complete with hosts evidence + External/Cloud heuristic signals + Measured DO-shaped signal; snapshot correlation → **Heuristic** + **Measured** paths; assets for measured droplet |
| `tests/acceptance/runner-discover-task-flow.test.ts` | Discover allowlist + signed envelope (dispatch-only residual) |
| `packages/shared/src/continuous-easm.test.ts` | Allowlist pure functions |
| `apps/api/src/services/continuous-easm-schedule.test.ts` | ContinuousValidation schedule fire queues allowlisted modules only |

### Continuous EASM defaults (verified scopes)

| Scope type | Default modules |
| --- | --- |
| Domain / Subdomain | `nuclei.external_exposure_safe`, `periscan.dns_resolution_check`, `periscan.tls_certificate_check` |
| InternalNetwork / IPRange | `recon.host_discovery`, `recon.dns_probe` |

Config `moduleIds` are **intersected** with the hard allowlist; Atomic/exploit ids are dropped.

---

## 2. CSV — measured cloud config loop (DigitalOcean firewall)

### Product path

```text
Live-mode DigitalOcean integration (stubbed HTTP)
  → Health → Connected
  → Snapshot sync parses firewall + droplet inventory
  → Measured path: internet-open sensitive port (authoritative-config)
  → Remediation → verify (StillExposed while open)
  → Mutate firewall to private range → verify Fixed (connector-resync)
  → Due reverify on regression → Reopened
```

### Measurement honesty

| Claim | Basis |
| --- | --- |
| `evidenceBasis: Measured` | Authoritative DO firewall ingress (`0.0.0.0/0` / `::/0`) |
| `measurementMethod` | `authoritative-config:digitalocean-firewall-ingress` |
| `validationState: Reachable` | Config proves reachability — **not** Exploitable |
| `Fixed` | Only after re-fetch no longer re-correlates exposure |

### Acceptance

| File | Proves |
| --- | --- |
| `tests/acceptance/digitalocean-fix-verification-flow.test.ts` | Full measured open → StillExposed → fix → Fixed → regress → Reopened; no token/IP leak |
| `packages/connectors/src/index.test.ts` | DO inventory + internet-open sensitive port parse |
| `packages/evidence/src/correlation.ts` | `createDigitalOceanInternetOpenPortPath` |

**K8s open-service pattern:** measured multi-hop Kubernetes public exposure + CIS failure fusion exists in correlation (`measured-kubernetes-exposure-cis`) for when live collectors attach both signal classes; DO firewall remains the closed CSV E2E for this swarm.

---

## 3. Connector Production qualification

### Gate (fail-closed)

```text
runConnectorProductionQualDryRun
  missing live env keys     → NotConfigured (never pretend ready)
  keys, no receipt          → Blocked
  invalid / mock / fixture  → InvalidReceipt / Blocked
  keys + full PASS receipt  → EligibleForElevation
                              (catalog still unchanged until explicit generator + Plane)
```

Checklist items (all PASS required):  
`health_probe`, `technique_observe`, `redaction`, `rate_limits`, `tenant_isolation`, `audit`.

### Catalog honesty (shipped)

| External tier | Count | Meaning |
| --- | ---: | --- |
| **Production** | **0** | Customer-credential live-smoke certified |
| Beta / ReadyForCredentials | ~126 | Connectable dedicated clients — **not** Production |
| Planned / NotConnectable | ~141 | Scaffold only — cannot Configure with live keys |

### Acceptance / unit

| File | Proves |
| --- | --- |
| `tests/acceptance/connector-production-qualification-flow.test.ts` | Dry-run fail-closed; elevation gate; catalog API 0 Production/Certified; Planned `connector_not_connectable` |
| `packages/shared/src/connector-production-qualification.test.ts` | Receipt schema + dry-run unit matrix |
| `packages/connectors/src/catalog-production-honesty.test.ts` | Manifest never Production/Certified |
| `apps/web/src/components/integrations-marketplace.test.tsx` | UI `integration-production-honesty` → **0 Production-certified** |
| `scripts/connector-production-qual-dry-run.ts` | CLI dry-run (`pnpm connectors:qual:dry-run <key>`) |

### Explicit non-actions

- Did **not** set any connector `productionCertified` / `availability: Production`  
- Did **not** invent design-partner live keys or Plane smoke receipts  
- Eligible dry-run outcome is **permission to elevate in a later code+Plane change**, not elevation itself  

Runbook: `docs/ops/CONNECTOR_PRODUCTION_QUALIFICATION.md`.

---

## 4. How to re-run

```bash
# Prefer non-conflicting Postgres publish port when 5432 is busy
export PERISCAN_POSTGRES_PUBLISHED_PORT=5434
docker compose -f infra/docker-compose/docker-compose.yml up -d
export DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan

pnpm --filter @periscan/shared exec vitest run \
  src/connector-production-qualification.test.ts \
  src/continuous-easm.test.ts \
  src/integration-external-tiers.test.ts

pnpm --filter @periscan/connectors exec vitest run src/catalog-production-honesty.test.ts

pnpm --filter @periscan/web exec vitest run \
  src/components/integrations-marketplace.test.tsx

pnpm exec vitest run \
  tests/acceptance/asv-easm-discover-path-flow.test.ts \
  tests/acceptance/digitalocean-fix-verification-flow.test.ts \
  tests/acceptance/connector-production-qualification-flow.test.ts \
  tests/acceptance/runner-discover-task-flow.test.ts \
  --testTimeout=60000

# Dry-run CLI (expect exit 2 NotConfigured without partner env keys)
pnpm connectors:qual:dry-run crowdstrike || true
```

---

## 5. Residual (honest)

| Item | Why residual |
| --- | --- |
| Matrix #1 Fully-E2E autonomous EASM | Seeds remain **user-declared verified scopes**; CT/whois pivot is refused |
| Connector Production elevation | Needs real design-partner tenants + live-smoke receipts in Plane — fixtures never suffice |
| K8s CSV closed loop | Correlation path exists; full connector fix-verify E2E still DO-first |
| Living map / continuous terrain | Quarantined / fixture-only — not product ASV |

---

## 6. Safety checklist

- [x] Verified customer-authorized scope only  
- [x] Denied / non-allowlisted tasks never queued as discover  
- [x] No Atomic live, Caldera, SharpHound, ransomware, uncontrolled exploit chaining  
- [x] Fixed only via verification event (CSV DO loop)  
- [x] No fake Production certification  
- [x] No real data exfiltration / destructive actions  
