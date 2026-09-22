# Panel open-issues closeout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every 2026-09-22 panel finding that can be closed in code or public chrome, and record SETTLED/ops leftovers as caps.

**Architecture:** Private product tree (`swarm/integrate-5-loop`) owns in-app honesty. Public orphan `seanventures/periscan` owns fold chrome. Pathless Gitleaks findings stay Open; remediations can be Fixed. Cloud stays 3 until a live Connected-AWS Prowler walk.

**Tech Stack:** Fastify API, Next.js web, Prisma, Playwright lab, `gh` for public chrome.

## Global Constraints

- Gitleaks remains Community default start (`jobsQueued=1`).
- Pathless Gitleaks findings stay Open (`isPathlessGitleaksFinding`).
- Fixed only via measured verification event.
- Denied never queues.
- Do not retag `v0.12.0`.
- Do not invent `security@`, 4.0/5.0, MQ, or a star-farm.
- GitHub has no social-preview API (P1-OG is maintainer Settings upload).
- Connect is optional extra signal after Community Gitleaks evidence.

## Already shipped this loop (do not reopen)

| ID | SHA |
| --- | --- |
| P2-HOMEFIXED empty Top finding + cadence primary | private `682eef86` |
| P2-A11Y-SVG unnamed nivo svg | private `682eef86` |
| source_missing Attention after Measured | private `682eef86` |
| P1-SETUP 404, P2-HOUR first-hour fold | public `276cefb` |
| P3-ASVTOPIC `asv` | public topics PUT |

---

### Task 1: Findings honesty after measured Fixed

**Files:**
- Modify: `apps/web/src/components/findings-workbench.tsx`
- Modify: `apps/web/src/components/findings-workbench.test.tsx`
- Modify: `apps/web/src/lib/findings-honesty.ts` (create helper)

**Interfaces:**
- Produces: `findingsHonestyCopy(remediations): string`

When any related remediation is `Fixed`/`Mitigated` with `latestVerification`, the first-hour line must not say “Fixed still requires a verification event.” Pathless Gitleaks stay Open.

- [x] Write failing test that with a Fixed+verified remediation the honesty line matches `/Remediation Fixed after retest/` and not `/still requires a verification event/`.
- [x] Run `pnpm --filter @periscan/web exec vitest run src/components/findings-workbench.test.tsx` — expect FAIL.
- [x] Implement `findingsHonestyCopy` and wire the findings first-hour paragraph; fetch remediations via existing `api.listRemediations` if the workbench does not already.
- [x] Re-run tests — expect PASS.
- [ ] Commit.

---

### Task 2: CloudAccount Attested vs Verified

**Files:**
- Modify: `apps/web/src/components/scopes-workbench.tsx`
- Modify: `apps/web/src/components/scopes-workbench.test.tsx`

CloudAccount verified by `operator_attestation` / `OPERATOR_ATTESTATION` must paint **Attested**, not **VERIFIED**.

- [x] Failing test: CloudAccount with `verificationMethod: "OPERATOR_ATTESTATION"` and `verificationStatus: "Verified"` shows Attested, not Verified.
- [x] Implement `scopeVerificationBadgeLabel(scope)`.
- [x] Tests PASS. Commit.

---

### Task 3: Scope safety placeholders + Cloud token label

**Files:**
- Modify: `apps/web/src/components/scope-safety-editor.tsx`
- Modify: `apps/web/src/components/scope-safety-editor.test.tsx`
- Modify: `apps/web/src/components/scopes-workbench.tsx`

Replace OT/SCADA placeholders. Label Periscan authorization token as such on CloudAccount.

- [x] Placeholders: `prod-account-alias` / `production, staging` (not Plant line 2 / scada).
- [x] CloudAccount token chrome: “Periscan authorization token” (not implied IAM).
- [x] Tests PASS. Commit (`e2824649`).

---

### Task 4: GOVERNANCE vs SETTLED security intake

**Files:**
- Modify: `GOVERNANCE.md`

SETTLED intake is title-only public `[SECURITY]` issues. GOVERNANCE currently says “Do not file security … as public issues.”

- [x] Point governance at `SECURITY.md` title-only `[SECURITY]` template. Keep “no security@”.
- [x] Commit (`e2824649`).

---

### Task 5: Public leftover chrome

**Repos:** `seanventures/periscan` (orphan). Do not retag `v0.12.0`.

- [x] Delete leftover `dependabot/npm_and_yarn/*` branches (keep `main` and 8 open Dependabot PR heads).
- [x] Remove public `STAGING_README.md` and `mfa_repro.mts` if present.
- [x] Confirm `docs/SETUP.md` 200 and README Keep proving still on main.
- [x] Do not star-farm. Do not invent mailbox.

---

### Task 6: P1-OG maintainer step

GitHub has no social-preview API. Asset `docs/images/github-social-preview.png` is 1280×640 HTTP 200.

- [x] Author a one-stage wizard that opens `https://github.com/seanventures/periscan/settings` and tells the maintainer to upload that PNG under Social preview.
- [x] Do not claim OG closed until GraphQL `usesCustomOpenGraphImage: true`.

---

### Caps (execute = record, do not violate)

| ID | Action |
| --- | --- |
| P1-TAG | Do not retag `v0.12.0`. |
| P1-NODE | Keep Node 24 floor. |
| P2-INTAKE | Title-only `[SECURITY]`. |
| P3-STARS | No star-farm. |
| P3-PACK | Catalog stays second control. |
| Cloud 3 | No Prowler without Connected AWS credentials. |
| Pathless Gitleaks | Findings stay Open; remediations may be Fixed. |

---

### Task 7: Verify

- [x] Focused vitest: findings-workbench, scopes-workbench, scope-safety-editor, first-run-primary-action.
- [x] Live lab: walker Home still cadence + Fixed badge.
- [x] Public: SETUP 200, no `asv` topic, Keep proving fold.
- [x] Plane PERISCAN-583 comment if `OPS_TOKEN` available; else **not posted**.
