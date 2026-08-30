# Feature Zoo & Product UI/UX Reorganization Plan

**Date:** 2026-07-29  
**Source:** Exhaustive 20-persona panel (**398 findings**) + prior panel synthesis  
**Goal:** Product organization that makes **5.0-ready** proof-loop UX inevitable — not a catalog of every PRD noun  

Companion: [triage/MASTER_BACKLOG.md](./triage/MASTER_BACKLOG.md) · [00-EXECUTIVE_SYNTHESIS.md](./00-EXECUTIVE_SYNTHESIS.md)

---

## 1. Diagnosis (panel consensus)

| Symptom | Evidence |
|---------|----------|
| **Feature zoo** | ~35–50 primary destinations; Autonomous group (Swarm, Workflows, Operators, Engagements, MCP) on main rail |
| **Dual systems** | `primary-nav.tsx` vs `app-navigation.ts`; design system globals vs Tailwind kit; findings v1/v2 orphans |
| **Triple loop vocabulary** | Product 8 stages · CTEM 6 radar · marketing 3-step / PRD north star |
| **Dual first-run** | Dashboard GetStarted (3) + `/getting-started` (9) + Welcome personas |
| **Naming lies** | Findings → “Validated Results”; Missions → “Validation Snapshot”; Exposure vs Findings |
| **Dead links** | Hop detail → `/scopes` (no route) |
| **Trust tax** | Zoo surfaces invite RFP risk, demo distraction, GTM confusion |

**Jobs/Horowitz/Gartner/Practitioner:** Freeze surface growth; collapse IA; ship hero loop.

---

## 2. Product essence (north star)

> **See the path. Break the cheapest link. Re-run. Prove it closed.**  
> Only say what you measured. Only close what you re-tested. Only run where authorized.

Every surface is **Core**, **Setup**, **Prove**, **Labs**, or **Admin**. Nothing else on the primary rail.

---

## 3. Target information architecture

### 3.1 Primary rail (Operating maturity) — max **10** items

| Order | Label | Route | Job |
|------:|-------|-------|-----|
| 1 | **Home** | `/dashboard` | Needs you + next proof (not airport BI) |
| 2 | **Validate** | `/missions` | Snapshots / missions (honest multi-type when mounted) |
| 3 | **Paths** | `/attack-paths` | Hypothesis → measure hops → breaker |
| 4 | **Findings** | `/findings` | Unique work queue (fingerprint, Active default) |
| 5 | **Remediation** | `/remediation` | Own fix · ticket · verify |
| 6 | **Evidence** | `/evidence` | Inspect claims |
| 7 | **Reports** | `/reports` | Proof packs |
| 8 | **Schedule** | `/schedules` | Continuous validation |
| 9 | **Connect** | `/integrations` | Signals in |
| 10 | **Engines** | `/engines` *(new)* | Engine Lab package manager |

**Overflow (command palette / “More” / account):** Audit, Admin, Trust & Safety, Billing, Runners, Data fabric (Assets & Scope), External validation (or nest under Validate), Controls, Compliance, Account security.

### 3.2 New / Activating maturity rail — max **7**

Home · Connect · Validate · Paths · Findings · Remediation · Help/Getting started  

**Must include Findings + Remediation** (panel: Activating rail currently omits handoffs).

### 3.3 Labs (demote — not deleted)

Single entry **Labs** (or Settings → Advanced):

- Agent Swarm, Agent Workflows, Operators, Engagements, MCP, Model Gateway  
- Proof-loop Packs (merge into Reports later)  
- Tool Registries / certification factory  
- Threat Center / Threat Feed / Signal Activity → merge into **Operations** hub later  
- NHI, ATT&CK catalog, Validation Ops (until continuous hub exists)

### 3.4 Setup group (secondary)

Runners · Engines · Integrations · Scope/Assets (promote Data fabric as **Assets & Scope**) · Policies  

### 3.5 Admin group

Members · SSO · API keys · Webhooks · Audit · Billing · Trust & Safety · MSSP (if role)

---

## 4. Naming dictionary (one word each)

| Concept | Canonical UI word | Forbidden / deprecate |
|---------|-------------------|------------------------|
| Work items | **Findings** | Exposure (nav), Validated Results (H1) |
| Runs | **Validation** / mission type subtitle | Dual “Command center” vs Dashboard |
| Assets authorization | **Assets & Scope** | Scope only under Missions |
| Continuous | **Schedule** | “Remediate” eyebrow on schedules |
| Package manager | **Engines** | Tool Governance (internal only) |
| Proof stages | **Connect → Authorize → Validate → Understand → Act → Verify → Prove** | Parallel CTEM radar labels on first-run (map with legend only) |

---

## 5. Hero loop screens (Jobs H0–H6)

| Step | Screen | Must-have CTA |
|------|--------|----------------|
| H0 | Welcome (persona optional) | Continue → Home |
| H1 | Get Started (empty only) | Connect · Authorize · First validation |
| H2 | Validate | Run snapshot / external / path measure |
| H3 | Path detail | Measure hop · Create remediation |
| H4 | Findings | Own / disposition / route to rem |
| H5 | Remediation detail | Mark ready · **Create ticket** · Verify |
| H6 | Evidence / Report | Share proof |

Everything else is fuel or Labs.

---

## 6. Kill / merge / rename matrix

### Kill from primary rail (move to Labs)

| Surface | Why |
|---------|-----|
| Swarm | Theater; sessions ≠ agents |
| MCP (primary) | Platform integration |
| Model Gateway | Deprioritized product gravity |
| Operators / Engagements / Workflows (primary) | Overlapping agent governance |
| ATT&CK techniques as peer | Reference material |
| Dual Threat* + Signal + Validation Ops as four peers | Fragmentation |

### Merge

| Into | From |
|------|------|
| **Operations** (phase 2) | Threat Center + Threat Feed + Signal Activity + Validation Ops |
| **Reports** | Proof-loop Packs |
| **Assets & Scope** | Data fabric primary job + scope verify UX |
| **Engines** | Tool governance marketplace + install path |
| **One nav source** | Delete dual `APP_NAV` product contract; tests use primary-nav |

### Rename

| From | To |
|------|-----|
| Tool Governance | Engines |
| Validated Results | Findings |
| Validation Snapshot (nav-only) | Validate (with mission types inside) |
| Command center (duplicate) | Home / Dashboard only |

### Fix dead ends

| Issue | Fix |
|-------|-----|
| `/scopes` links | Route to Assets & Scope or missions scope panel |
| Rem ticket only on snapshot | Create ticket on remediation detail |
| Recovery routes | Public middleware allow-list |
| Login `?next=` | Honor after auth |

---

## 7. Design system & chrome (UI 5.0)

| Work | Outcome |
|------|---------|
| Single design system | Tailwind kit wins; migrate legacy teal panels/pills |
| Single landmark | `PageShell` not a second `<main>` |
| Severity map | One token set for Critical/High/Med/Low everywhere |
| Badge budget | Max 2 chips/row default; rest in expand |
| Empty/error kit | One NotConfigured / ErrorState language |
| Focus / a11y | Shared modal trap; focus-visible; hop measure live regions |

---

## 8. Phased delivery to “organized product”

### Phase A — Freeze & rail (1–2 weeks) — **P0 zoo**

1. Single `primary-nav` source; kill dual product nav  
2. Operating rail ≤ 10; New rail ≤ 7 with Findings+Remediation  
3. Autonomous → Labs  
4. Rename Findings H1; fix Exposure  
5. Public recovery + `?next=`  
6. Nested main fix  

**Exit:** Practitioner can complete hero loop without “Show all navigation.”

### Phase B — Hero loop completeness (2–3 weeks)

1. Ticket create on rem detail  
2. Findings Active default + occurrence/fingerprint UI  
3. Path → rem CTA; fix `/scopes`  
4. Dashboard: Needs you + top paths only until Prove milestones  
5. One first-run spine (merge 3-step + 9-milestone)  
6. One proof-loop vocabulary (retire dual radar labels on first-run)  

**Exit:** Uncoached pilot can Connect → Validate → Path → Own → Ticket → Verify → Report.

### Phase C — Engines + truth (parallel)

1. Engine Lab `/engines` (package manager plan)  
2. License dual-truth fix  
3. Measured hop journey residual + receipt integrity  
4. Webhook truth  

### Phase D — Ontology cleanup (ongoing)

1. ValidationState partition  
2. Finding identity = fingerprint  
3. Threat dual stack merge  
4. Graph nodeType enum  

### Phase E — Enterprise packaging (sales-led)

Trust pack, SCIM decision, force-MFA, status/SLA contractual, demote Autonomous from demos.

---

## 9. What 5.0 means (by lens)

| Lens | 5.0 definition |
|------|----------------|
| UI | One system, one chrome, no dead routes, severity truth |
| UX | One loop vocabulary; inevitable first hour |
| Jobs | Hero sentence product; Labs for the rest |
| Practitioner | Monday: Needs you → ticket → re-test → schedule |
| CISO | Board pack with zero overclaim; measured paths default |
| Gartner/Forrester | AEV/CTEM proof narrative; refs; no score theater |
| AppSec | No Measured forge; mTLS default; policy re-eval |
| OSS | One license truth; BYO install for restricted engines |

---

## 10. Governance rules (stop the zoo returning)

1. **No new primary-nav item** without removing one or placing in Labs.  
2. **No new stage vocabulary** without deprecating the old.  
3. **No Leading scorecard row** without competitive-matrix agreement + evidence.  
4. **No “Validated” from fixtures** in product UI.  
5. **Feature flags for Labs** — not default-visible to New maturity.  
6. Panel backlog items linked to Plane epics; P0s block release claims.

---

## 11. Mapping to backlog epics

See [00-EXECUTIVE_SYNTHESIS.md](./00-EXECUTIVE_SYNTHESIS.md) epic list and [triage/MASTER_BACKLOG.csv](./triage/MASTER_BACKLOG.csv) for 398 findings.

| Epic | Owns zoo/UX |
|------|-------------|
| E1 Feature zoo & nav | Phase A |
| E2 First-run & vocabulary | Phase B |
| E3 Hero loop handoffs | Phase B |
| E4 Design system & a11y | Phase A–B |
| E5 Engine Lab | Phase C |
| E6 Ontology | Phase D |
