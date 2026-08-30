# Forced ICP wedge (refuse audience sprawl)

Status: **canonical GTM rule**  
Related: P08-1 / ticket #420  
Source product decision: [`../qa/UI_RELEASE_ICP_ROADMAP.md`](../qa/UI_RELEASE_ICP_ROADMAP.md)

## The wedge (day-one only)

**Primary ICP:** mid-market / upper-mid-market **security leader** with at least one
**hands-on security engineer or analyst** who will run **one measured proof loop this
week** against authorized scope.

| Role | Job | Product default |
| ---- | --- | --------------- |
| **Buyer** | Security leader who must answer six questions (below) | Outcomes: top validated risk, control misses, fix status, shareable proof |
| **Daily user** | Security engineer / analyst | Work: Needs you queue, missions, paths, findings, remediation, re-validation |
| **Downstream** | GRC / auditor / customer reviewer | Proof packs only — never claim Periscan certifies compliance |
| **Scale (not day-one existence)** | MSSP / vCISO operator | Same loop across client tenants **after** single-org loop is boring |

**Promise (only sentence sales may lead with):**

> Find the path. Validate the risk. Prove it's fixed.

**North-star metric:**

> Weekly tenants completing a measured **Validate → Remediate → Re-validate** proof loop
> without a Periscan employee narrating the UI.

**First sellable offer:** **Validation Snapshot** (PRD §19) — not the full platform
catalog. Success quote to earn:

> “This is not a scanner. This is the report I wish I had before the audit / customer
> review / insurance renewal / board meeting.”

## The six buyer questions

Every demo and deck must answer only these, with evidence:

1. What can compromise us?
2. What controls caught it (or missed it)?
3. Which path matters most?
4. What should we fix first?
5. Did the fix work (measured re-validation)?
6. What can we show leadership, a customer, or an auditor without lying?

If a surface does not advance one of these six, it is not in the first-session or
first-deal path.

## Forced prioritization rules

1. **One door.** Land path is: verified domain → one real connector (GitHub **or** AWS)
   → Snapshot mission → measured path → remediation → measured verify → evidence pack.
2. **MSSP is expansion.** Architecture is real; GTM primary is not. Prove one client
   loop, then sell portfolio.
3. **GRC is consumer, not buyer.** Do not sell “compliance certification.”
4. **AI product teams, multi-BU enterprise programs, OT/ICS, NHI-first** are later
   cohorts until the north-star metric moves for the primary ICP.
5. **TAM language in the full PRD is not the ICP.** “Feel premium for everyone”
   is product quality bar, not sales targeting.

## Explicit non-ICP (day-one)

Do **not** prioritize outreach, demos, or roadmap for these as primary:

| Cohort | Why later |
| ------ | --------- |
| Pure vulnerability-management buyers wanting scanner replacement | We are the proof layer on tools they already bought |
| Buyers shopping autonomous pentest theater (Pentera/Horizon3 war) | We refuse destructive theater; different buyer |
| GRC-only teams without an engineer to run a loop | No north-star completion |
| MSSP partner as first deal ever | Channel before product-market rhythm |
| AI red-team teams only | AI Security Validation is Beta; not existence proof |
| “Show me everything” platform RFPs | Feature zoo kills wartime focus |

## Product surface discipline (GTM)

New and design-partner tenants should experience progressive disclosure around the
Snapshot → Verify path. Primary rail should not force Autonomous / MCP / Swarm /
Model Gateway / multi-pillar tours mid-demo.

Canonical demo path (wartime):

1. Connect source + explain read capability honestly  
2. Authorize smallest comfortable scope  
3. State measured vs heuristic / simulated / unconfigured / pending **before** run  
4. Run Snapshot; show path + evidence  
5. Assign path-breaking remediation  
6. Re-validate; show Fixed demotion if still open  
7. Compose audience-specific proof pack  

Scaffold or Partial pillars (SCV stimulus, DRV inject, kill-chain live, etc.) are
**not** in the deck until Fully-E2E for that prospect.

## How to refuse sprawl in the room

| Pressure | Wartime answer |
| -------- | -------------- |
| “Also show AI / swarm / BAS library depth” | “We only demo what is measured for *your* scope today. Here is NotConfigured / Partial honestly.” |
| “We need full CTEM parity first” | “Existence proof is one weekly measured loop. Parity is peacetime.” |
| “MSSP multi-tenant for our channel day one” | “After one client completes fix-verified proof. Isolation report comes with the partner motion.” |
| “Publish public prices / Marketplace” | “Invoice design partners until two paid conversions are boring.” |
| “Add this logo to the website” | **No logos without signed reference consent and production deploy.** |

## Evidence of ICP learning

ICP is proven only by real sessions and conversions:

- Session instrument: [`../qa/ICP_FIRST_SESSION_RESEARCH_PROTOCOL.md`](../qa/ICP_FIRST_SESSION_RESEARCH_PROTOCOL.md)
- Operator checklist: [`../qa/DESIGN_PARTNER_REFERENCE_PLAYBOOK.md`](../qa/DESIGN_PARTNER_REFERENCE_PLAYBOOK.md)
- Until five sessions close: **do not claim ICP validation complete**

## Related docs

- Wartime motion: [`WARTIME_SALES_MOTION.md`](./WARTIME_SALES_MOTION.md)
- Moat: [`../MOAT_TRUTH_ARCHITECTURE.md`](../MOAT_TRUTH_ARCHITECTURE.md)
- Product copy: [`PRODUCT_COPY_RULES.md`](./PRODUCT_COPY_RULES.md)
