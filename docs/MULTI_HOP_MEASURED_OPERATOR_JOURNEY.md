# Measured multi-hop operator journey

**Status:** default product journey for attack-path proof (Slice 3 UX).  
**Related:** `docs/MEASURED_TEST_RANGE.md`, path edge receipts API, `demo/DEMO_SCRIPT.md`.

---

## 1. Product claim

Periscan’s flagship differentiator is **measured multi-hop proof**:

- A path is **Measured** only when **every hop** has a Measured edge receipt with tenant-owned evidence IDs.
- **Launch is not measurement.** Creating a mission or queuing a probe never upgrades hop or path certainty.
- Empty is honest: if no receipts exist, the UI says so — it does not invent Measured labels.

---

## 2. Default operator journey

| Step | Surface | Operator action | Honest outcome |
|------|---------|-----------------|----------------|
| 1 | Connect → Authorize → Validate | Connect a source, verify scope, run a Validation Snapshot | Paths appear as **Heuristic hypothesis** until hops are measured |
| 2 | **Attack paths** list | Read **Multi-hop measurement** strip (`N/M hops`, fully / partial / hypothesis counts) | `0/M` is valid — not a failure of the product |
| 3 | Path detail (deep-links to `#hop-measurement`) | Primary CTA **Measure path hops** when not fully measured | Secondary: whole-path validate / export |
| 4 | Hop card | **Measure hop (safe)** when eligibility is Eligible or NeedsApproval | **Allowed** → probe auto-queued; **RequiresApproval** → mission, no queue; **Denied** → never queued |
| 5 | Edge receipts | Confirm receipt + evidence IDs after the run | Measured edge ratio and claim language recompute from weakest edge |
| 6 | Breakers / remediation | Choose path breakers only after understanding hop certainty | Recommendation ≠ proof of fix |

---

## 3. First-run and getting-started

- Dashboard **Get started** (after first measured validation) surfaces **Measure multi-hop paths** with a link to `/attack-paths`.
- **Getting started → After the first proof loop** leads with **Measure multi-hop paths**.
- Product help on Attack paths (`product-help` guide id `attack-paths`) teaches hop measurement as the default loop.
- **Home (Command center)** surfaces primary CTA **Measure path hops** when paths have unmeasured hops and verified scope exists — deep-links to the top unmeasured path `#hop-measurement` (not a SIEM dump).
- **Attack paths** list multi-hop strip uses the same primary CTA when measure-ready; otherwise honest secondary labels (e.g. authorize scope first).
- **Continuous Validation** hub links **Measure multi-hop paths** and the operator journey (getting-started + page help id `continuous`).
- Empty path boards stay honest: never claim **FullyMeasured** without hop receipts.

---

## 4. What not to demo

- Do not present Heuristic correlation as Measured multi-hop proof.
- Do not claim a hop Measured after Measure hop launch alone.
- Do not use fixture-only demo data as live customer proof without labeling it sample/demo.
- Do not enable live exploit chaining, credential theft, or destructive modules for this journey.

---

## 5. Demo script (authenticated)

Prerequisites: verified scope, connected source (or lab range), tenant policy that can Allow safe ActiveNonInvasive hop probes when you want auto-queue.

```bash
pnpm seed:demo   # or real lab tenant
pnpm dev
```

Walkthrough:

1. Complete setup (source + verified scope + first validation) if needed.
2. Open **Attack paths**. Read the multi-hop measurement strip — if `0/N hops`, say so explicitly.
3. Open the top path (lands on hop measurement). Primary button: **Measure path hops**.
4. On hop 1 with Eligible (or NeedsApproval), click **Measure hop (safe)**.
5. If **Queued**: open the mission, wait for completion, refresh — **Edge receipts** gains a row; ratio increments only then.
6. If **RequiresApproval**: open missions, approve/start under policy; still no Measured until receipt.
7. Repeat remaining hops. FullyMeasured only when every hop has a receipt.
8. Only then discuss path breakers and remediation re-test.

Sample public report (`/demo`) remains labeled sample; it does not complete real workspace multi-hop milestones.

---

## 6. Lab / live range (optional)

For non-fixture hop probes against known posture, use the measured test range (`docs/MEASURED_TEST_RANGE.md`, `infra/test-range/`) and the runner-measured multi-hop E2E path when runners are enrolled. That produces real `evidenceBasis=Measured` evidence — still never fabricate UI Measured badges without receipts.
