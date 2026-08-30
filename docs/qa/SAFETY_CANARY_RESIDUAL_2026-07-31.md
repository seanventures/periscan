# Safety canary residual — 2026-07-31 (PERISCAN-13 Phase C)

Honest inventory of **safety-equivalent specialist packs** (scorecard rows
**16 / 19 / 21 / 22**) and what can elevate a *substitute* to Partial later vs
what stays **forever refuse**.

**Hard rules (unchanged):** never implement real ransomware, credential theft,
lateral spray, SharpHound collector, Caldera live, Atomic live inject, or real
data exfiltration. Only benign markers / DNS canary / exact-marker style modules.

**Scorecard JSON:** **not bumped** this residual. Scaffold/gated rows stay gated
until blind rescore with lab evidence. This memo + matrix notes describe canary
*class* honesty only.

---

## 1. Inventory (scaffold safety rows vs safe modules)

| Scorecard | Requirement | Scorecard verdict | Claim class | Safe modules (substitute) | Peer forever refuse |
|----------:|-------------|-------------------|-------------|---------------------------|---------------------|
| **16** | Agentless APT Execution | Scaffold/gated | `plan_only` | `exploitation.killchain.engine` (catalog plan-only), `periscan.endpoint_benign_marker_emit`, `periscan.dns_exfil_canary`, exposure hand-offs (`gitleaks`, `web.zap_baseline`, `prowler`) | Live multi-stage agentless APT; autonomous exploit chain; Caldera/Atomic as APT |
| **19** | Data Exfiltration over DNS | Strong (canary class) | `benign_marker_only` | `periscan.dns_exfil_canary` + `POST …/dns-exfil-canary-proof` | Real bulk data tunnel; unscoped beacon farms |
| **21** | Ransomware Emulation | Scaffold/gated | `forever_refuse` | Detection substitutes only: `periscan.endpoint_benign_marker_emit`, `periscan.detection_marker_emit_observe` | Live crypto, mass lock, shadow-copy delete, “ransomware emulation” marketing |
| **22** | Identity Abuse & Credential Harvesting | Scaffold/gated | `exposure_only` | `gitleaks.repo_secrets`, `identity.cred_spray` / kerberos / bloodhound (**all** `liveSupported:false` or dry-run) | Live spray, token theft, privilege abuse, SharpHound collector |

Source of truth (machine-readable):
`packages/shared/src/safety-equivalent-packs.ts` →
`GET /api/v1/safety-equivalent-packs`.

UI honesty: `apps/web/src/components/specialist-coverage-honesty.tsx`.

Matrix: `docs/COMPETITIVE_COVERAGE_MATRIX.md` multi-vector + APT rows (2026-07-31).

---

## 2. What shipped this residual

| Item | Path |
|------|------|
| Shared inventory + tests | `packages/shared/src/safety-equivalent-packs.ts` (+ `.test.ts`) |
| DNS canary product path | `POST /api/v1/control-sources/:id/dns-exfil-canary-proof` |
| Honesty pins on result | `exfilClaimClass: "benign_marker_only"`, `realDataExfiltrated: false`, `fullExfilLibrary: false` |
| Read-only pack list | `GET /api/v1/safety-equivalent-packs` |
| Module honesty tests | `apps/api/src/services/dns-exfil-canary-proof.test.ts` (fixture → `measured:false`, never real exfil) |
| Specialist UI labels | claim class + substitute modules + forever-refuse ransomware |
| Matrix lag fix | Multi-vector no longer claims “DNS-exfil has no executing module” |

---

## 3. What can elevate Partial *later* (substitute class only)

| Row | Can elevate substitute? | Criteria for honest Partial (not peer BAS) |
|----:|-------------------------|--------------------------------------------|
| **16** APT | **Yes — plan/canary class only** | Kill-chain remains `measured:false` / plan-only; safe-stage playbooks documented; optional hand-off missions to Exposure/Detection/Config modules under verified scope. **Never** claim live agentless APT or kill-chain execution. Scorecard may move Scaffold→Partial only after blind rescore on the *planner + canary* product story. |
| **19** DNS exfil | **Yes — detection canary already Partial/Strong class** | Keep `realDataExfiltrated:false`. `measured:true` only with real emit + liveTelemetry. Ops: live SIEM/DNS-monitor correlation lab memo. Do **not** promote to Fully-E2E multi-vector BAS. |
| **21** Ransomware | **No for ransomware emulation** | Forever refuse Impact (T1486). Optional detection-canary language is DRV/endpoint marker class — **must not** rebrand as ransomware emulation or elevate row 21 as such. |
| **22** Identity | **Yes — exposure class only** | Secrets exposure (gitleaks) measured on authorized repos; identity modules stay dry-run / `liveSupported:false` with `measured:false` on non-live paths. Live spray remains disabled forever in product. |

---

## 4. Forever refuse (do not build)

From `SECURITY_BOUNDARIES.md` + `SAFE_STAGE_PLAYBOOKS` + this residual:

- Live ransomware encryption / mass file lock / shadow-copy delete
- Live credential spray, hash dump, token theft
- SharpHound collector in product; Caldera live; Atomic live inject
- Real bulk data exfiltration (DNS or otherwise)
- Autonomous multi-stage APT / kill-chain execution engines
- Lateral movement / priv-esc / persistence / domain compromise product modules

Partner-gated (not safety canaries): dark-web monitoring (row 2), OT/ICS Validated
packs (row 26), crowdsourced HITL (row 28).

---

## 5. Tests proving honesty

| Proof | Expectation |
|-------|-------------|
| `periscan.dns_exfil_canary` fixtureMode + telemetry | Detected OK; **`measured:false`**, **`realDataExfiltrated:false`**, **`emitted:false`** |
| `periscan.dns_exfil_canary` no telemetry | **Inconclusive** — never false Missed |
| `DnsExfilCanaryProofResultSchema` pins | `exfilClaimClass=benign_marker_only`, `realDataExfiltrated=false`, `fullExfilLibrary=false` |
| Marker allowlist | Non-`periscan-*` ids rejected (no malware/spray theater IDs) |
| T1486 playbook | `Forbidden`, `defaultModuleId: null` |
| `identity.cred_spray` live | disabled / `measured:false` on dry-run (existing module tests) |
| Kill-chain engine | Catalog-only / non-executable registry (existing P05-12 tests) |

Run (focused):

```bash
pnpm --filter @periscan/shared test -- safety-equivalent-packs
pnpm --filter @periscan/api test -- dns-exfil-canary-proof
pnpm --filter @periscan/web test -- specialist-coverage-honesty
pnpm --filter @periscan/modules test -- dns_exfil_canary
```

---

## 6. Recommended score delta

| Action | Recommendation |
|--------|----------------|
| `analyst-scorecard.json` dim bumps for 16/21/22 | **None this residual** |
| Row 19 already Strong | Hold; do not invent Fully-E2E multi-vector |
| Matrix multi-vector | **Updated** — DNS canary Partial; malware/phishing Missing |
| Blind rescore of 16/22 as Partial | Defer until lab memo on planner + exposure canaries |

**Recommended score delta: 0 points.**

---

## 7. Traceability

| Artifact | Role |
|----------|------|
| `packages/shared/src/safety-equivalent-packs.ts` | Inventory + elevate/refuse rules |
| `packages/shared/src/safe-stage-playbooks.ts` | T1486 Forbidden; T1041 DNS canary; T1110 exposure |
| `packages/modules` `periscan.dns_exfil_canary` | Bounded DNS canary module |
| `apps/api` `runDnsExfilCanaryProof` | Product path + audit metadata |
| `docs/COMPETITIVE_COVERAGE_MATRIX.md` | External language |
| `SECURITY_BOUNDARIES.md` | Safety floor |
| `docs/qa/analyst-scorecard.json` | Unchanged index |
