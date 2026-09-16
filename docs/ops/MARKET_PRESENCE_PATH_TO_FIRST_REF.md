# Market presence — path to first customer reference

Status: **engineering residual closed for zero-ref honesty path; GTM-blocked at `publicReferenceCount = 0`**  
Tickets: PERISCAN-431 · PERISCAN-183 · PERISCAN-374 · PERISCAN-126 · Epic PERISCAN-30 (design-partner / trust-pack slices)  
Last updated: 2026-07-31  
Real-first: never invent logos, case studies, ARR, or NDA partner names

## Executive read

| Dimension | State |
| --------- | ----- |
| Wave / MQ / peer market presence | **Fail** (correct) |
| `publicReferenceCount` | **0** |
| Product honesty surfaces | **Shipped** (live API, no fabricated refs) |
| Design-partner reference factory process | **Shipped as docs + product path** |
| First real public reference | **GTM / commercial only** — cannot close in code |

**Do not mark PERISCAN-431 / 183 / 374 / 126 Done** until real consented production
references exist. Recommended Plane language:
`engineering residual closed; GTM-blocked at refs=0`.

See [`PLANE_G1_DISPATCH_NOTES.md`](./PLANE_G1_DISPATCH_NOTES.md).

## What is code-complete (engineering)

| Area | Location | Notes |
| ---- | -------- | ----- |
| Market presence readiness builder | `packages/shared/src/domain.ts` → `buildMarketPresenceReadiness` | Gates Fail while refs = 0; optional counts only from real ledger later |
| Claim deny / GTM refuse language | `packages/shared/src/claim-deny-list.ts`, `gtm-claim-language.ts` | No Leaders-ready / fake logos |
| Trust & Safety summary API | `GET /api/v1/trust-safety` → `marketPresence` | Live bind, not hardcoded UI zeros |
| Trust & Safety UI | `apps/web/src/components/trust-safety-dashboard.tsx` | Banner, readiness panel, enterprise trust pack |
| Admin zero-refs banner | `apps/web/src/components/admin-console.tsx` | Links to Trust & Safety |
| Design-partner workspace API | `GET/PATCH /api/v1/tenants/current/design-partner` | Checklists, analyst evidence honesty |
| Session learning notes API | `POST .../design-partner/session-notes` | Internal only; `isPublicReference: false` |
| Design Partner Mode UI | `apps/web/src/components/snapshot-workbench.tsx` | Zero-ref banner, session learning empty state, path CTA |
| Reference pack checklist | `docs/DESIGN_PARTNER/REFERENCE_PACK_CHECKLIST.md` | Inventory empty |
| Reference factory | `docs/DESIGN_PARTNER/REFERENCE_FACTORY.md` | Intake → proof → NDA rights → KPI |
| Session learning log | `docs/DESIGN_PARTNER/SESSION_LEARNING_LOG.md` | Template; 0/5 sessions |
| Session operator playbook | `docs/qa/DESIGN_PARTNER_REFERENCE_PLAYBOOK.md` | Five ICP sessions |
| ICP research protocol | `docs/qa/ICP_FIRST_SESSION_RESEARCH_PROTOCOL.md` | Moderator script |
| Unit / route coverage | shared `domain.test`, web trust-safety / design-partner client tests, API design-partner tests | Honest zero fixtures |

## What remains GTM-only (cannot close in engineering)

| Gate | Ticket theme | Blocker |
| ---- | ------------ | ------- |
| ≥1 production design partner | #183 / #431 | Real customer deploy + commercial relationship |
| ≥3 production + written reference-call consent | #183 / #431 / #374 | Legal consent + production proof |
| Public logos / case studies | #126 peer diligence | Separate consent; marketing |
| Five observed ICP first sessions with medians | P08-8 / #182 | Real participants (adjacent learning gate) |
| Wave / MQ questionnaire spend | #374 / #431 | Unlocked only after refs + consent gates |
| Filled reference pack A–C with names | P13-1 / #259 | Empty until real partners |
| Peer diligence “who uses you?” answer | #126 | Confidential design-partner narrative until consent |

## Path to first reference (operators)

Canonical factory: [`../DESIGN_PARTNER/REFERENCE_FACTORY.md`](../DESIGN_PARTNER/REFERENCE_FACTORY.md).

Short path:

1. **Recruit** one ICP org (`ICP_WEDGE.md`) — not audience sprawl.
2. **Enable** Design Partner Mode; authorize smallest real scope.
3. **Run** measured Snapshot → path → remediate → re-validate → evidence pack.
4. **Log** session (scorecard + optional product session note). Internal only.
5. **Convert** invoice / approval-reference (payment processor may stay NotConfigured).
6. **Request** written reference-call rights under NDA after production value.
7. **Only then** raise external consent ledger counts; product may reflect non-zero refs.
8. **Repeat** until ≥3 production + ≥3 signed permissions; fill pack; then Wave/MQ.

## Product CTA map (zero-refs UI)

| Surface | CTA / next action |
| ------- | ----------------- |
| Trust & Safety market presence panel | Path to first design partner → `/missions` Validate + factory doc pointer |
| Admin banner | Link Trust & Safety + Validate; factory protocol path |
| Validate (`/missions`) | Zero-ref path strip → Trust & Safety + REFERENCE_FACTORY.md |
| Snapshot workbench Design Partner Mode | Enable mode → checklist → session note form → factory stages |
| Session learning empty | “Need 5 sessions… notes ≠ public refs” + next action to protocol |

## Epic PERISCAN-30 shippable honesty slices (this group)

In scope for G1 residual:

- Design-partner / reference factory process productization  
- Zero-ref market presence Fail honesty  
- Trust pack pointer rows that stay **NotConfigured / NotClaimed** (no fake SOC 2)  
- SCIM inbound honesty (NotConfigured + sales-assisted path) already on Trust & Safety  

Out of scope / not claimed Done by docs alone:

- Real customer references  
- Vendor SOC 2 Type II  
- Inbound SCIM for Periscan memberships  
- Payment processor bank settlement  

## Acceptance for “engineering residual closed”

- [x] `publicReferenceCount` defaults to 0; gates Fail  
- [x] UI never invents logos or case studies  
- [x] Trust & Safety / Admin bind live `marketPresence`  
- [x] Design-partner session learning honest empty state  
- [x] Reference factory + pack checklist + path-to-first-ref ops doc  
- [x] Plane notes recommend leave-open / GTM-blocked language  
- [ ] First real public reference (GTM)  

## Change log

| Date | Change |
| ---- | ------ |
| 2026-07-31 | Consolidated code-complete vs GTM-blocked for G1 zero-ref tickets. |
