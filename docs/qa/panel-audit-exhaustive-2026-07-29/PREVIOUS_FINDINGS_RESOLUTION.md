# Previous panel findings → planned resolution

Maps **2026-07-29 first panel** themes (U-xx from `PREVIOUS_PANEL_SYNTHESIS` / `00-EXECUTIVE-SYNTHESIS` in panel-audit-2026-07-29) and known Slice plan to **exhaustive panel IDs** and **epics**.

**Status legend (2026-07-29 wave honesty pass):** **Done** = linked exhaustive finding(s) are Plane Done with test/product evidence. **Partial** = primary P0s Done, residual P1–P3 open. **Open** = core work remaining. **Mitigated** = code path closed; keep regression.

| Prior ID | Theme | Status | Resolution plan | Exhaustive IDs | Epic |
|----------|--------|--------|-----------------|----------------|------|
| U-01 | Auth recovery not public | **Done** | Middleware public allow-list | P02-1, P03-8, P04-5 | E2 |
| U-02 | Three proof-loop vocabularies | **Partial** | FEATURE_ZOO plan §4 dictionary; P09-20 residual | P02-3, P07-4 Done; P09-20 open | E3 |
| U-03 | 35–50 nav / dual nav | **Partial** | Rail ≤10 + Labs (Operate cap shipped); residual zoo tickets | P02-6, P01-6, P07-3 Done; more P07/P14 open | E1 |
| U-04 | Module license dual-truth | **Partial** | SPDX sync + licenseRisk; residual inventory/policy | P15-3, P15-4 Done; P15-1–2/5+ open | E8 |
| U-05 | Hop CTA Eligible/NeedsApproval | **Done** | launchable NeedsApproval; Allowed queues only | P05-2 | E6 |
| U-06 | Correlation Measured without receipts | **Mitigated** | hopKey + draft basis helpers | Keep regression tests | E6 |
| U-07 | Scorecard inflation | **Partial** | Freeze + demote Leading mismatches (P12-3, P13-2 Done); Phase 0 blind rescore still open | P12-3, P13-2 Done; P19 residual | E13 |
| U-08 | policy.denied webhook never emits | **Done** | Emit on hop/mission/control deny paths | P20-1 | E11 |
| U-09 | Dual first-run 3 vs 9 | **Open** | One spine | P02-4, P02-5 | E2 |
| U-10 | Login ignores `?next=` | **Done** | Auth form honor next | P02-2 | E2 |
| U-11 | Findings UI ignores fingerprints | **Partial** | Fingerprint/occurrence/Active queue shipped; deeper ops residual | P18-1–3 Done; P18 P1–P2 open | E5 |
| U-12 | Ticket create missing on rem detail | **Done** | Wire existing API on detail | P14-3, P06-7 | E4 |
| U-13 | Nested main / a11y | **Done** | PageShell single main + axe gate | P01-2, P16-1 | E9 |
| U-14 | Dual design systems | **Done** | Tailwind kit primary; globals product chrome deprecated | P01-1 | E9 |
| U-15 | Severity color disagreement | **Done** | One severity visual map | P01-4 | E9 |
| U-16 | Autonomous on primary rail | **Done** | Labs demotion | P07-3 | E1 |
| U-17 | Fixture Validated | **Done** | Ban fixture → Validated product claims | P05-1 | E6 |
| U-18 | Stale module cert report | **Done** | CI regenerate / certify:check | P05-4 | E8 |
| U-19 | SCIM/SLA/billing/status | **Partial** | Billing NotConfigured honesty; SCIM NotConfigured; force-MFA partial | P08-4 Done; P17-1/5/12 residual | E13 |
| U-20 | RLS reads / mTLS / rebind | **Partial** | mTLS default-on prod; RLS write-path honesty docs; rebind residual | P10-1 Done; P03 residual | E7 |
| U-21 | Webhook thin / pagination docs | **Partial** | remediation.verified + OpenAPI pagination; payload schemas residual | P20-1,2,4 Done; P20-5/16 open | E11 |
| U-22 | Signal correlationKeys | **Mitigated** | extract keys at build | Regression | E5 |
| U-23 | Threat/ops fragmentation | **Open** | Operations hub later | P06-9, P18-11 | E1/E10 |
| U-24 | Compliance thin + Leading | **Partial** | Measured evidence-support naming + disclaimers | P04-3 Done; packs still thin | E13 |
| U-25 | No customer references | **Open** | Design-partner program | P08-9, P12-6 | E13 |
| U-26–31 | Competitive co-exist | **Partial** | POSITIONING + BATTLECARDS + demo rules (P19-1–4 Done); market residual | P19-1–4 Done; P19-5+ open | E15 |
| Slice 3 | Measured paths | **Partial** | Edge plan/receipts + multi-hop default; residual journey polish | P05-2, P12-4 Done | E6 |
| Slice 4 | Findings ops | **Partial** | Fingerprint/Active/unowned P0s Done; queue depth residual | P18-* | E5 |
| Slice 5 | Control model honesty | **Done (honesty)** | Claims match capability: inject disabled, Atomic dry-run, SCV/DRV demoted — **not** live inject BAS | P05-3, P06-5, P12-5, P13-4 | E12 |
| Slice 6–9 | Assets / Evidence / CV ops / scaffold rows | **Partial (wave4)** | Slice 6: `/scopes` Setup nav + ownership queue + cross-links. Slice 7: evidence Inspect provenance + linked claims. Slice 8: continuous hub live schedule depth + schedule History/priorDiffs. Slice 9: specialist scaffold honesty panel (rows 2/16/21/22/26/28). Residual: release qual (Slice 10) + deeper runner pool/notification config | plan `ANALYST_94_ASV_CTEM_95_SCORE_PLAN.md` | — |
| Slice 10 / Phase 0 | Release qual + blind rescore | **Open** | Multi-wave hard gates | — | — |
| Engine Lab | Package manager | **Partial** | Phase 0–2 UI/acceptance shipped; Phase 3+ runner install open | P15-8,9; P19-9 | E8 |
| PERISCAN-16 | Outside-plan packaging | **Superseded** | Exhaustive backlog + epics | — | E1–E2 |

## Epic close rule (process)

Close an epic in Plane **only** when its exhaustive children are **largely Done** (all P0s and vast majority of children). As of 2026-07-29 wave process pass:

| Epic | Plane # | Children closed | Action |
|------|---------|-----------------|--------|
| **E12** Control inject honesty | 29 | **4/4 (100%)** | **Close** — honesty path complete; live inject remains deliberately off |
| E2 Auth recovery & first-run | 19 | ~5/19 | Leave open (dual first-run spine residual) |
| E3 Proof-loop vocabulary | 20 | ~3/22 | Leave open |
| E4 Hero loop handoffs | 21 | ~3/8 | Leave open (P0s Done; path/rem residual) |
| E5 Findings operationalization | 22 | ~12/29 | Leave open |
| E6 Measured paths & evidence | 23 | ~12/26 | Leave open (P0s Done; residual integrity) |
| E7 Security hard gates | 24 | ~12/31 | Leave open |
| E9 Design system & a11y | 26 | ~8/29 | Leave open |
| E10 Continuous validation & runners | 27 | ~4/43 | Leave open |
| E11 API & webhook honesty | 28 | ~6/23 | Leave open (P0s Done; depth residual) |
| E13 Enterprise trust & GTM | 30 | ~11/45 | Leave open |
| E14 Ontology cleanup | 31 | ~6/34 | Leave open |
| E15 Competitive positioning | 32 | ~8/22 | Leave open (P0 market refs open) |

## Mitigation already on main (do not re-open as new work)

| Commit / work | What |
|---------------|------|
| `611939b2` and follow-ons | Hop NeedsApproval launchable; Measured honesty; fingerprint keys; draft basis |
| `d55bb75d` | Remediation per fingerprint + owner/SLA projection |
| hopKey receipt reattach | Evidence reattach durability |
| Control effectiveness foundations | Single model foundations |
| Slice 2 | External validation workbench |
| Slice 1 | Claim language contract |
| Control inject honesty wave | Atomic dry-run labels; `control_live_execution_disabled`; SCV/DRV score demotion |
| Competitive docs wave | `docs/competitive/*` AEV/CTEM home; co-exist with Wiz/Tenable/Pentera |
| Engine Lab Phase 0–2 | `/engines` license ceremony + install plan |

## Rule

No prior U-xx is “closed” until linked exhaustive finding is **Done** in Plane with test evidence — except explicit **Mitigated** rows above, which need only regression tests. Epic Done requires children largely Done, not milestone prose alone.
