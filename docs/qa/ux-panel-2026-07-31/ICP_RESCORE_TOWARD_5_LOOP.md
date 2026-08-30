# ICP re-score toward 5.0 loop (2026-07-31) — Swarm E

**Method:** Code-evidence re-panel against `ICP_STUDY_PROTOCOL.md` + residual walk of `ICP_USABILITY_STUDY_10_PROFILES.md` / `ICP_RESCORE_AFTER_FEATURES.md`.  
**Not** live browser Layer 1. **Not** invented market presence.  
**Branch tip family:** `overnight-loop` @ `397b8602` + concurrent WIP surfaces (MSSP enter-client, Executive buyer path, operator clarity, automation honesty).  
**Tests (focused, package vitest):** findings-workbench, mssp-portfolio, executive-overview, trust-safety, primary-nav, working-tenant, a11y-smoke, controls, compliance — **83 passed** after thrash fixes.

---

## Explicit honesty floors (do not violate)

1. **Do not claim 5.0 on `por_purchase` for P03 or P10 while `publicReferenceCount = 0`.**  
   Market presence remains **Fail** (correct). PoR / sole board SoR is honesty-capped until ≥1 real NDA-referenceable design partner exists.
2. **Do not claim panel mean 5.0** while SCIM inbound, vendor SOC 2 Type II, and public SLA remain **NotConfigured** / honest residual.
3. **Do not claim BAS peer parity** for P08. Purchase scores below are **AEV / continuous measure** framing only.
4. **Operator 5.0 cells only where code truly supports them** (wired UI + tests / acceptance), not aspirational craft.

---

## What shipped this loop (maps to ICP findings)

| Finding | Evidence (files / commits) |
|---------|----------------------------|
| **ICP-P0-1/2** enter-client | `working-tenant` + Open client → Findings; chrome Working as / Leave (`360a1bd0`, MSSP workbench) |
| **ICP-P1-11** create client UI | MSSP Create client panel; empty-portfolio auto-expand (P05) |
| **ICP-P1-1** mute UI | Single + bulk fingerprint mute default-on; `Muted via fingerprint` badge |
| **ICP-P1-2** dual-pane | Findings list \| detail; ArrowUp/Down + Esc; phone sticky disposition |
| **ICP-P1-3** Home triage | Needs you + primary CTA first; program context collapsible |
| **ICP-P1-4** Executive Operate | `/executive` on Operate rail (≤10); Evidence demoted to Setup |
| **ICP-P1-5** Board pack | `ExecutiveRiskSummary` / Board brief / Build board pack CTA |
| **ICP-P1-6** honestyTrust | Executive strip: % Measured, Fixed revalidated, denied-never-queued |
| **ICP-P1-7** Continuous | `ContinuousHealthStrip` on Shift + Schedules; `/continuous` deep-link |
| **ICP-P1-8** webhooks typed | Per-event schemas + event-catalog; OAS event list honesty |
| **ICP-P1-9** key privilege | `webhook:admin` alone → Viewer; capability-gated webhook admin |
| **ICP-P1-10** proof-loop | `examples/proof-loop.sh` → mounted OpenAPI (not dead lab route) |
| **ICP-P1-12** compliance links | `/evidence?q=` deep-links + longer labels |
| **ICP-P1-14** DRV UI | Detection marker proof panel on Controls (benign marker only) |
| **ICP-P1-15/16** path CTAs | Measure hops primary; NeedsScope → `/scopes` |
| **ICP-P2-1** schedules | List-first program health |
| **ICP-P2-2** storm findings | Severity chips + select-matching; seen window on rows |
| **ICP-P2-3** marketPresence | Trust dashboard binds live API (0 refs Fail, no logos) |
| **ICP-P2-4** compliance help | GRC-shaped guide residual |
| **ICP-P2-6** LiveUpdatePill | **"Polled …" honesty** — never Live / SIEM real-time |
| **P08 residual** | Path chrome collapse, BASLite demotion, axe smoke expand, reduced-motion (`397b8602`) |
| **Multi-hop FullyMeasured** | Acceptance receipts auto-apply + claim clamp (`5d757a84`) |
| **GTM path** | First design partner without inventing refs (`677c4674`) |

### Still open (score caps)

| Residual | Cap |
|----------|-----|
| Zero public customer references | **por_purchase** for P03/P10 ≤ ~2.8 |
| SCIM / JIT NotConfigured | Enterprise packaging / PoR |
| Vendor SOC 2 Type II NotConfigured | Buyer diligence pack |
| Compliance catalogs partial (honest) | GRC SoR / cert path |
| Live L1 browser re-panel not run | A11y / delight ceiling |
| Not SIEM SoR / not full BAS | P02 / P08 framing |

---

## Full 10-profile scoreboard (1–5)

**Purchase is split:**

- **`pilot_purchase`** — scoped paid pilot / SE champion / design-partner week.  
- **`por_purchase`** — multi-year platform-of-record / sole board SoR / full client-book MSSP contract.

**Mean column uses `pilot_purchase`** (pilot-framing overall).  
`por_purchase` is reported for honesty; it is **not** averaged into the panel mean.

| ID | Profile | Task | Clarity | Trust | Delight | A11y | pilot_purchase | por_purchase | Mean (pilot) | Δ vs study (~3.5) | Δ vs after-features (~4.2) |
|----|---------|:----:|:-------:|:-----:|:-------:|:----:|:--------------:|:------------:|:------------:|:-----------------:|:--------------------------:|
| P01 | SE | **5.0** | 4.8 | **5.0** | 4.5 | 4.6 | 4.9 | 4.2 | **4.8** | +1.0 | +0.2 |
| P02 | SOC L2 | 4.9 | 4.8 | 4.9 | 4.3 | 4.5 | 4.6 | 3.8 | **4.7** | +0.9 | +0.3 |
| P03 | CISO | 4.5 | 4.6 | 4.8 | 4.0 | 4.2 | 4.0 | **2.6**† | **4.3** | +1.2 | +0.3 |
| P04 | VP Eng | 4.7 | 4.5 | 4.4 | 4.2 | 4.0 | 4.4 | 3.6 | **4.4** | +0.8 | +0.2 |
| P05 | MSSP | 4.8 | 4.7 | 4.8 | 4.3 | 4.2 | 4.6 | 3.8 | **4.6** | +1.6 | +0.3 |
| P06 | GRC | 4.4 | 4.7 | 4.6 | 3.9 | 4.0 | 3.9 | 3.0 | **4.2** | +1.1 | +0.2 |
| P07 | Automation | 4.9 | 4.8 | 4.7 | 4.5 | 4.0 | 4.8 | 4.0 | **4.6** | +0.8 | +0.2 |
| P08 | Red team | 4.7 | 4.6 | **5.0** | 4.4 | 4.4 | 4.3†† | 1.5††† | **4.6** | +0.9 | +0.4 |
| P09 | Mid-market | 4.6 | 4.6 | 4.7 | 4.3 | 4.2 | 4.4 | 3.5 | **4.5** | +1.0 | +0.3 |
| P10 | Board | 4.5 | 4.6 | 4.7 | 4.0 | 4.0 | 4.0 | **2.7**† | **4.3** | +1.1 | +0.3 |
| | **Panel mean** | **4.7** | **4.7** | **4.8** | **4.2** | **4.2** | **4.4** | **~3.3** | **~4.5** | **+1.0** | **+0.3** |

† **P03/P10 `por_purchase` honesty-capped by zero public refs** + enterprise packaging residuals.  
†† AEV / continuous-measure complement (not BAS peer).  
††† BAS peer replacement — excluded from pilot mean; shown only as refuse floor.

### Dimension means (pilot-framing)

| Dimension | Mean |
|-----------|:----:|
| Task | 4.7 |
| Clarity | 4.7 |
| Trust | 4.8 |
| Delight | 4.2 |
| A11y | 4.2 |
| pilot_purchase | 4.4 |
| **Overall (pilot)** | **~4.5** |

### Operator cluster (P01 / P02 / P05 / P07 / P09)

| Cluster | Pilot mean |
|---------|:----------:|
| P01 SE | **4.8** |
| P02 SOC L2 | **4.7** |
| P05 MSSP | **4.6** |
| P07 Automation | **4.6** |
| P09 Mid-market | **4.5** |
| **Operator cluster mean** | **~4.6** |

---

## Where 5.0 is scored (and why)

| Profile × dim | Score | Code support |
|---------------|:-----:|--------------|
| **P01 × Task** | 5.0 | Hop Measure primary, dual-pane disposition, fingerprint mute, Home triage-first, Fixed-only-via-verification UI refuse — SE JTBD 1–4 complete in product UI |
| **P01 × Trust** | 5.0 | Claim-safe path/finding labels, hop receipts, no raw Validated when partial |
| **P08 × Trust** | 5.0 | Inject refuse, DRV Partial honesty, BASLite demotion, counterfactual estimate-only |

**No profile mean is 5.0.** Closest: **P01 mean 4.8**.  
**No `por_purchase` is 5.0** for any profile.  
**P03/P10 `por_purchase` must not be marketed as 5.0** (or even 4.0) while refs = 0.

---

## Residual findings after this loop (still real)

| ID | Severity | Note |
|----|----------|------|
| ICP-P0-3 | Program | CISO/board PoR blocked by zero refs + packaging — product honesty correct |
| ICP-P1-13 | Honest partial | Compliance catalogs still thin (2–5 controls/framework) |
| ICP-P2-5 | Polish | Phone storm tables still dense despite sticky disposition |
| — | QA | Live Layer 1 browser walk + Lighthouse not re-run this loop |
| — | GTM | First real NDA design-partner reference still required for por_purchase lift |

---

## Focused test evidence (Swarm E)

```
pnpm --filter @periscan/web test -- \
  findings-workbench mssp-portfolio executive-overview trust-safety \
  primary-nav working-tenant a11y-smoke controls compliance
→ 9 files / 83 tests passed
```

**Thrash fixes applied (tests only):**

1. `findings-workbench.test.tsx` — data-age assertion accepts **Polled** (not Live / Updated-only).  
2. `mssp-portfolio-workbench.test.tsx` — wait for expanded **Client name** field (forceOpen after load).  
3. `compliance-workbench.test.tsx` — scope drill assertions with `within(panel)` (page chrome also says “evidence deep-links”).  
4. `executive-overview.test.tsx` — reconstruct after parallel merge parse break; keep period metrics + leadership surface tests.

---

## Champion / purchase matrix (updated)

| ID | Pilot decision | PoR decision |
|----|----------------|--------------|
| P01 | **Yes — champion** | Platform eng later |
| P02 | **Yes daily** as proof layer next to SIEM | Not SOC SoR |
| P03 | **Conditional paid pilot** | **No PoR** (refs=0) |
| P04 | **Yes pilot eng budget** | No unrestricted platform yet |
| P05 | **Yes enter-client book ops pilot** | Full channel PMF not claimed |
| P06 | **Yes constrained audit packs** | Not GRC SoR / not cert |
| P07 | **Yes integrate** REST + webhooks + runners | Boring contracts still maturing |
| P08 | **Yes as AEV** | **No as BAS peer** |
| P09 | **Yes design-partner week** | Not replace Monday stack yet |
| P10 | **Conditional board appendix** | **No sole board SoR** (refs=0) |

---

## Path remaining toward true 5.0 (honest)

1. **≥1 NDA design-partner public-or-referenceable proof** → lifts P03/P10 `por_purchase` ceiling.  
2. SCIM or contractual provisioning SLA + pen-test summary path.  
3. Live Layer 1 re-panel (browser + axe/Lighthouse) to unlock a11y/delight 5.0 cells.  
4. Routine FullyMeasured multi-hop as **default demo tenant path** (acceptance exists; demo default still Partial-capable).  
5. Keep refuse list — never greenwash market presence or Type II.

---

## Honest summary for dispatch

| Signal | Value |
|--------|-------|
| **Panel mean (pilot-framing)** | **~4.5 / 5** |
| **Operator cluster mean** | **~4.6 / 5** |
| **Any profile mean = 5.0?** | **No** (max P01 **4.8**) |
| **Any 5.0 dimension cells?** | **Yes** — P01 Task, P01 Trust, P08 Trust |
| **P03/P10 por_purchase = 5.0?** | **No — capped ~2.6–2.7 by refs=0** |
| **Prior study → this loop** | ~3.5 → **~4.5** (+1.0) |
| **After-features → this loop** | ~4.2 → **~4.5** (+0.3 residual polish) |

*Swarm E complete. Pilot-framing panel ~4.5. Trust remains the unfair advantage. Purchase PoR remains honesty-capped until real references exist.*
