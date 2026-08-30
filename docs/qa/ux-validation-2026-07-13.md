# Periscan UX & Product Review — 2026-07-13

Periscan's engineering core is genuinely honest and genuinely well-built: a real tamper-evident evidence hash-chain, measured-vs-heuristic labeling that never dresses one up as the other, a real policy engine with enforced safety floors/ceilings, and a working compliance-catalog + attestation renderer underneath. That honesty earns it the panel's single highest score — Trust (3.7). But across all ten personas the verdict converges: **it is a superb governance *viewer* wrapped around a passive-validation core, not yet a governance *system of record*.** The gap is almost never missing backend capability — it is unwired UI. The flagship differentiator (a verifiable evidence chain) cannot be verified from the product; the fully-built compliance/attestation engine has no UI entry point; SSO, PDF board reports, bulk triage, credentialed connectors, and AI-policy authoring all exist server-side but are read-only or absent in the shipped surfaces. Worst of all, a systemic pattern of empty `catch` blocks means destructive and governance actions (redact, kill-switch, revoke, disconnect) fail *silently* — the single most corrosive flaw in a product whose entire pitch is "prove it." **Not adoption-ready for any F1000 buyer today** (no self-serve SSO, no compliance artifact, no $-risk, silent safety-action failures); it is a strong *pilot/wedge* for security-forward teams who value the honest measured-validation model and can tolerate a UI-completion gap.

## Rubric scoreboard

| Persona | TaskSuccess | Clarity | Trust | Delight | Accessibility |
|---|---|---|---|---|---|
| Red Team Operator | 2 | 3 | 3 | 4 | 3 |
| Blue Team / Detection Eng | 2 | 3 | 3 | 3 | 4 |
| SOC Analyst (Tier-2) | 3 | 3 | 4 | 3 | 3 |
| Security Researcher | 4 | 3 | 3 | 3 | 4 |
| PANW Director of PM | 3 | 3 | 4 | 3 | 3 |
| CISO — Financial Services | 2 | 3 | 4 | 3 | 3 |
| CISO — Healthcare | 3 | 3 | 4 | 3 | 3 |
| CISO — Retail / E-commerce | 2 | 3 | 4 | 3 | 3 |
| CISO — Manufacturing / OT | 2 | 3 | 4 | 4 | 3 |
| CISO — Tech / SaaS | 3 | 3 | 4 | 3 | 3 |
| **Mean** | **2.6** | **3.0** | **3.7** | **3.2** | **3.2** |

- **Worst dimension: TaskSuccess (2.6)** — every persona could *read* the truth but few could *complete their actual job* (verify the chain, generate the attestation, triage in bulk, connect a live source).
- **Best dimension: Trust (3.7)** — the honest labeling and real evidence engineering are category-leading; the risk is that unverifiable claims and silent failures slowly erode exactly this asset.

## Ranked findings

*No P0 (adoption-halting, no-workaround) findings were confirmed — every core defect has a partial workaround or is a UI-completion gap over working backend. Findings below are consolidated across personas; "raised by N" aggregates the personas who independently hit the same defect.*

### P1 — Fix before any F1000 bake-off

**1. Destructive & governance actions fail silently and have no confirmation**
- *Location:* cross-cutting — `evidence-ledger.tsx` (download L224, redact L237), `runners-console.tsx` (kill L158, revoke L169), `integrations-marketplace.tsx` (disconnect L244), `ai-apps-workbench.tsx` (validate L266), `schedules-workbench-v2.tsx` (toggle L230), `threat-feed-workbench.tsx` (dismiss)
- *Effort:* S–M · *Category:* trust-honesty / controls-governance
- *Raised by 9:* redteam, blueteam, soc, researcher, panw-pm, ciso-finserv, ciso-health, ciso-retail, ciso-tech
- *Verified:* Every listed handler catches errors into an empty/`setBusy(null)`-only block; the API client throws `PeriscanApiClientError` on any non-2xx, so 402/403/404/5xx/network drops are all discarded. **Worse than the panel framed:** the reassuring comments ("refetch surfaces state") are false — `onChanged()`/refetch sits *inside* the `try` after the `await`, so on failure it never runs. A failed kill-switch, revoke, or redact shows no error *and* does not self-correct; the stale pre-action state persists. The correct pattern already ships in sibling handlers in the same files (`sync()`, `runNow()`, register forms use `setError`/`role=alert`), so this is a consistency omission, not a missing capability. No confirmation dialog exists anywhere except the Frontier Gateway kill-switch (which proves the pattern exists and was applied to only one of the destructive actions).
- *Fix:* Replace every empty `catch` on an `api.*` write with a surfaced inline `role=alert`/toast carrying the server message; add confirm dialogs (typed-name for irreversible Revoke/Redact) to all destructive/governance actions; a lint rule banning empty catch on `api.*` would enforce it.

**2. Continuous-validation schedules have no time-of-day/timezone/blackout windows, no edit/delete, and a policy-gate asymmetry**
- *Location:* `/schedules` — `schedules-workbench-v2.tsx` L21 (FREQUENCIES = Daily/Weekly/Monthly); `runtime-services.ts` L5880 (`calculateNextRunAt`); `services/schedules.ts`
- *Effort:* L · *Category:* missing-feature / controls-governance
- *Raised by 6:* redteam, panw-pm, ciso-finserv, ciso-health, ciso-retail, ciso-mfg
- *Verified:* Only Daily/Weekly/Monthly at UTC boundaries; `calculateNextRunAt` just adds an interval to the creation moment, and `resumeSchedule` re-anchors to the resume moment — so every schedule fires at a drifting arbitrary wall-clock time with no deterministic run window. No blackout/maintenance/timezone fields exist anywhere. Routes expose only create/get/run/pause/resume — **no PATCH/PUT/DELETE**, so schedules can't be edited and paused ones accumulate forever. The "zero governance" framing is **refuted**: `createSchedule` enforces `requireRole(SCOPE_EDITOR_ROLES)` + a verified-scope requirement, and runs are pinned to `ActiveNonInvasive`. **But a real governance asymmetry survives:** the scheduled non-snapshot path (`runSchedule`) creates the mission `Queued` and enqueues directly, bypassing the `policy_decision_required` gate that the manual `startMission` flow enforces — so recurring active validation runs less-governed than a one-shot. A seasonal/OT buyer genuinely cannot declare a change-freeze.
- *Fix:* Add time-of-day + timezone + recurring blackout windows to the schedule model; add edit/delete lifecycle; apply the same policy-gate the manual missions flow enforces on schedule creation and on each scheduled run.

**3. The tamper-evident evidence hash-chain is unverifiable from the product**
- *Location:* `/evidence` — `evidence-ledger.tsx` (renders `sha256` only, L275-277); no verify route in `app.ts`; client exposes only list/get/redact/download
- *Effort:* M · *Category:* trust-honesty
- *Raised by 4:* redteam, researcher, panw-pm, ciso-finserv
- *Verified:* The backend is real and unit-tested — `packages/evidence/src/storage.ts` implements `computeEvidenceChainHash`/`verifyChainLinks`/`verifyEvidenceChain` with tamper/reorder/deletion detection and `brokenAtSeq`. But `verifyEvidenceChain` has **zero callers outside the library and its tests** — no HTTP route, no client method, and the list DTO deliberately strips `chainSeq`/`prevChainHash`/`chainHash`, so the UI can only show a per-artifact hash taken on faith. **Nearly-free adjacent win missed:** the download endpoint *already computes and returns* `integrityVerified`/`computedSha256`, the client already types them, and `evidence-ledger.tsx download()` **silently discards all of it** — a server-flagged tampered artifact downloads with no warning. This directly hollows out the flagship differentiator at the evaluation moment.
- *Fix:* Expose a read-only verify endpoint wrapping `verifyChainLinks`; add a per-artifact "Verify integrity" (surface the already-returned field) and a ledger-wide "Verify chain" action showing `chainSeq`, prev→current linkage, pass/fail, first tampered seq, and signing identity.

**4. The compliance / attestation engine has no UI entry point**
- *Location:* `/reports` — `reports-workbench.tsx` L29/L89 (createSnapshot, audience-only) vs `packages/reports/src/compliance-catalog.ts` + `index.ts`; no `/compliance` route
- *Effort:* L · *Category:* missing-feature
- *Raised by 4:* ciso-finserv, ciso-health, ciso-retail, ciso-mfg
- *Verified:* The reports UI only calls `createSnapshot({audience, maxTopItems})` — the web client has **no `createReport` method at all**, so no UI can pass a `packType`. The backend fully supports all 8 attestation packs (DORA/NIS2/PCI/ISO27001/SEC/GDPR/EU-AI-Act/ISO42001) via `POST /reports`, but they are entirely unreachable. **Worse than claimed, twice over:** (a) `COMPLIANCE_CATALOG`/`computeComplianceCoverage` are **dead code** — referenced only by their own test; the renderer's `renderComplianceSupport` emits a generic boilerplate blurb with **no per-control coverage mapping**, so even a raw-API attestation pack would not contain the control-ID→measured-evidence→pass/gap trace a regulator requires. (b) There is **no browsable `/compliance` surface** and **no HIPAA / SOC 2 / NIST framework** (HIPAA grep = 0 hits) — blocking the entire US-healthcare vertical. A naive catalog add without a Prisma enum migration will 22P02-crash (per this repo's own enum-drift history).
- *Fix:* Add a framework/packType selector to `/reports` wired to `createReport`; **render the control→evidence mapping table** in the report; ship a `/compliance` workbench (framework picker → per-control Met/Partial/Unmet + linked evidence + last-validated date, filter, export); add HIPAA (with migration), SOC 2, NIST.

**5. No bulk triage / operations, and AcceptedRisk has no owner, expiry, or approver**
- *Location:* `/findings` — `findings-workbench-v2.tsx` L413-529 (single-finding DispositionControl); `domain.ts` FindingDispositionOverrideSchema
- *Effort:* M–L · *Category:* missing-feature / controls-governance
- *Raised by 4:* soc, panw-pm, ciso-finserv, ciso-retail
- *Verified:* Disposition is strictly one finding at a time — a row must be expanded (single-expand `useState<string|null>`) to reveal the control, which calls `transitionFinding(findingId)`; no checkboxes, no select-all, no batch endpoint, no CSV export (report export is HTML/PDF only and report-scoped). Both workbenches also fetch the entire dataset client-side and render every row with no pagination/virtualization despite server-side filter support. **Governance gap:** `AcceptedRisk` carries only `{disposition, note, updatedBy, updatedAt}` — no owner, no expiry/next-review, no distinct approver, and `transitionFinding` requires only a single `SCOPE_EDITOR` role, so an editor can self-accept risk with no four-eyes control — an audit/SOX gap. (The "thousands at F1000" premise is partly softened by the deliberate validated-not-raw findings model, but scan-file importers can still produce high-volume sets.)
- *Fix:* Row selection + sticky bulk-action bar (Acknowledge/FP/Suppress/Escalate + shared note) looping the existing single endpoint; CSV export on findings & remediation; add owner + expiry (auto-reopen) + approver to AcceptedRisk, surfaced as an expiring-acceptances list and emitted to audit + attestation.

**6. No self-serve SSO/SAML setup UI (and no forgot-password page, no SCIM)**
- *Location:* `/admin` — `admin-console.tsx` SsoPanel L542-611 (view/disable only); `auth-form.tsx` (no reset link)
- *Effort:* L · *Category:* missing-feature
- *Raised by 4:* panw-pm, ciso-finserv, ciso-tech, ciso-retail
- *Verified:* SsoPanel can only view + disable; the client has `getSsoConfig`/`disableSso` but **no configure/update method**, and the panel's own copy calls a config form "a documented follow-up," punting to a raw API `PUT`. The backend is fully built (1086-line `sso.ts`, OIDC via JWKS + SAML via `@node-saml`, enforcement, domain allowlist, working `/auth/sso/*` routes) — so this is pure frontend wiring. **Adjacent, affects all users:** the password-reset backend is fully implemented and tested but has **no UI at all** — no forgot-password link, no `/reset-password` page, and the reset URL the server emails would 404 — so any non-SSO user who forgets a password is locked out with zero in-product recovery. SCIM inbound provisioning does not exist. JIT auto-provisioning is net-new (SSO login currently requires pre-provisioned members).
- *Fix:* Ship an SSO config form (IdP metadata URL/XML upload, ACS/entity IDs, attribute mapping, enforce toggle, test-login); wire a "Forgot password?" link + `/reset-password` page to the existing endpoints; let signup join an existing tenant via invite/domain.

**7. Restricted-evidence download is ungoverned and Redact is a silent no-op ("phantom control")**
- *Location:* `/evidence` — `evidence-ledger.tsx` download L211-229 / redact L231-239; `services/snapshots.ts` L959-1024
- *Effort:* M · *Category:* controls-governance / trust-honesty
- *Raised by 3:* redteam, researcher, ciso-health
- *Verified:* Download and redact both fire instantly with no confirm, no reason capture, and no sensitivity gate; `downloadEvidence` writes **no audit event**, contradicting the ledger's "download and re-redaction are governed server-side" header copy. The `AuditEvent` model exists but has **zero `.create` call sites** for these actions. **The "irreversible" premise is refuted and hides a worse bug:** `snapshots.ts` redact does `void redactEvidenceArtifact(stored.content)` — computes a redacted copy, discards it (un-awaited, never persisted), and returns the *unchanged* artifact. So Redact **never redacts** — PHI/sensitive content stays stored and downloadable, `redactionStatus` never flips, the button reappears, and (because there's no `finally`) `busy` can stick. A control that pretends to act on an evidence-integrity surface is a P1 trust failure.
- *Fix:* Make Redact actually persist + advance the chain; require a confirm + audit-logged reason for Restricted downloads; surface the already-returned `integrityVerified` and block/warn on tampered artifacts; write real audit events.

**8. Attack-path detail is a read-only dead-end — no "validate this path" handoff**
- *Location:* `/attack-paths/[id]` — `attack-path-detail.tsx` (zero write actions); `attack-paths-workbench.tsx`
- *Effort:* M · *Category:* missing-feature
- *Raised by 1:* redteam
- *Verified:* The detail component (301 lines) has zero buttons/mutations — only a back link and a generic `/evidence` link; the `ev·` evidence chips are plain spans, not clickable to a ledger entry. Engagements are scoped by domain/host + module plan and are never linked to a path, so the core proof-loop object has no forward action. **Cheap win the panel got backwards:** the backend already ships `POST /attack-paths/:id/verify` (`requestAttackPathVerification`) — a fully-built safe-validate endpoint that is exposed in **neither the client nor any UI**. `validationState` is derived (no dismiss/re-run mutation exists), so those literal actions need backend, but the verify handoff is nearly free.
- *Fix:* Wire the existing verify endpoint into the client + a per-row/detail "Validate this path (safe)" action; make evidence chips deep-link to the specific ledger entry; add path export.

**9. Coverage rows discard the evidence/signal/timestamp drill-through the API already returns**
- *Location:* `/controls` — `controls-workbench.tsx` L294-333 vs `domain.ts` DetectionRuleCoverageItemSchema L1516-1534
- *Effort:* S · *Category:* missing-feature
- *Raised by 1:* blueteam
- *Verified:* The API populates every coverage item with `evidenceIds`/`signalIds`/`lastObservedAt`/`controlSourceId`/`title`, but the row renders none of them — the "Stale" tone is wired while the `lastObservedAt` that justifies it is thrown away. **The one link is broken too:** `techniqueId` is a bare `href="/attack-techniques"` with no `?technique=` param, so even that lands on an unfiltered catalog. A detection engineer can see "Missed" but cannot prove or action it.
- *Fix:* Make each row expandable — link `evidenceIds`→`/evidence` and `signalIds`→`/signal-activity`, show `lastObservedAt` + `controlSourceId` (per-source filter), surface the item title.

**10. Coverage is point-in-time only — no detection regression / trend**
- *Location:* `/controls` — `control-ai.ts` getControlRuleCoverage (recomputed fresh, never persisted)
- *Effort:* L · *Category:* missing-feature · *Raised by 1:* blueteam
- *Verified:* Coverage is recomputed with `generatedAt = now` on every call and never persisted; the schema is a flat snapshot with no previous/delta/history. Schedule diffs exist but diff attack *paths*, not technique detection coverage — nothing captures a technique flipping Covered→Missed, the detection engineer's key need. Requires a snapshot store built from scratch.
- *Fix:* Persist coverage snapshots; add a per-technique trend/diff surfacing newly-regressed techniques prominently.

**11. No asset sensitivity / OT classification and no per-segment safety ceiling**
- *Location:* `/missions` (scope model), `packages/policy`, `domain.ts` ScopeTypeSchema
- *Effort:* L · *Category:* controls-governance / missing-feature
- *Raised by 2:* ciso-health, ciso-mfg
- *Verified:* The Scope model carries only type/value/verification — no PHI/OT/medical tag, no "passive-only/exclude" flag, no criticality, no free-form metadata (Assets have both `tags` and `businessCriticality`; Scopes have neither). The policy gate enforces only tenant-wide `maxSafetyLevel` — no per-asset denylist. **Hazard the panel understated:** `DEFAULT_TENANT_POLICY.maxSafetyLevel = 'BASLite'` permits active probing by default, and the default engagement plan for an InternalNetwork scope auto-runs `recon.host_discovery` + `recon.service_inventory` (active enumeration) with zero OT awareness — exactly what trips a PLC — while `zeroDisruptionGuaranteeCheck` is a dead stub never wired into enforcement.
- *Fix:* Add asset-class/sensitivity + OT/segment/Purdue tags and per-scope criticality that the policy gate enforces (hard-block Active+ on OT-tagged scopes), and make external-validation profiles selectable per scope.

**12. Alert-to-action dead-end — a finding can be triaged but not dispatched to a fix**
- *Location:* `/findings` — `findings-workbench-v2.tsx` L381-388, L475-479
- *Effort:* M · *Category:* missing-feature · *Raised by 1:* soc
- *Verified:* The only write in the finding detail is a 5-label passive disposition (its own copy says it "never marks a finding Fixed"); remediation linkage is a bare count + generic index link — no create-task, assign-owner, or ticketing route. **Product-wide gap:** the `createRemediation` endpoint is never invoked anywhere in the web app; remediations are system-generated. Findings do carry `relatedPathIds` and a Jira/ServiceNow handoff already exists on the remediation surface, so the fix is mostly wiring existing endpoints into the finding view.
- *Fix:* Add a primary "Route to remediation / create task" action (owner + SLA) on the finding, with a ticketing deep-link back.

**13. AI model policy profiles are read-only — the "firewall rule set" cannot be authored in-app**
- *Location:* `/model-gateway` — `frontier-gateway-console.tsx` PoliciesTab L385-446; ProvidersTab register-only
- *Effort:* M · *Category:* controls-governance / missing-feature
- *Raised by 2:* panw-pm, ciso-tech
- *Verified:* PoliciesTab is pure read-only display; ProvidersTab is register+test only — no policy CRUD, no provider edit/disable/delete/key-rotation. **This is a capability *regression* with dead-code confusion:** the backend exposes full CRUD (incl. key rotation, delete-guards), the client already exports every method, and a **complete authoring UI exists in-tree** (`model-gateway-workbench.tsx`) but is orphaned — imported only by its own test, rendered by no route. The redesign replaced the write UI with a read-only console. This is the AI-governance wedge against Picus/Pentera — its authoring surface is crippled.
- *Fix:* Port the existing forms — full policy-profile CRUD (allowed modes, max safety level, approval thresholds, redaction, per-capability toggles) with audit-logged diff, plus provider edit/disable/delete.

**14. SIEM/EDR "Connect" collects zero credentials and is mock-only in production**
- *Location:* `/integrations` — `integrations-marketplace.tsx` connect() L89-103
- *Effort:* M · *Category:* trust-honesty / missing-feature
- *Raised by 2:* blueteam, ciso-tech
- *Verified:* `connect()` posts only `{connectorKey, mockMode}` — no credential/scope form — despite the backend fully supporting `authType`+`config` with AES-256-GCM secret encryption and real secret-field manifests. **Two adjacent issues worse than "fire-and-forget":** (a) omitting credentials still writes `status:'Connected'` with empty config → a credential-less connector shows a green "Connected" badge (false positive); (b) every market-leader connector defaults `authMethods[0].kind==='mock'`, and the backend rejects `mockMode:true` with a 400 when `!devMode` — so in production the one-click UI **cannot connect any real source** and every "Connect (demo)" throws. Sync also truncates telemetry to "N signals · M assets" while the API returns a full per-signal category/type array. (Scan-file importers offer an alternate real-data path.)
- *Fix:* Add a manifest-driven credential/scope step (OAuth redirect where supported, else API key/base-URL/read-scopes) with a post-connect test-connection; break Sync into telemetry types (alerts/detections/logs/assets) linked to the signals that landed; surface connect errors (copy Sync's existing pattern).

**15. No monetary ($) risk quantification anywhere**
- *Location:* `/findings`, `/executive` — no ALE/FAIR/currency across the codebase
- *Effort:* L · *Category:* missing-feature · *Raised by 1:* ciso-finserv
- *Verified:* Every risk surface is a 0-100 score, a band, or a readiness %. The lone near-miss (`financialImpact: 0-100`) is an explicitly unitless impact-scoring dimension, not dollars. No ALE, no FAIR, no crown-jewel valuation, no $-denominated exposure trend. A financial-services board/risk-committee buyer has nothing to quote. The existing 3-dimension impact scaffolding (financial/regulatory/operational) is a deliberate hook to hang monetization on.
- *Fix:* Add asset/business-service valuation input, a defensible (assumption-labeled) ALE/FAIR per validated path, and a $ exposure trend on the executive overview and reports.

**16. No in-app help — runner architecture, safety model, NIS2 evidence mapping, API schemas**
- *Location:* cross-cutting — no help/docs surface beyond `/api-reference`; `api-reference-console.tsx`
- *Effort:* M · *Category:* docs
- *Raised by 3:* ciso-mfg, panw-pm, ciso-tech
- *Verified:* No glossary, help center, or accessible tooltip/popover primitive exists; `/api-reference` is a flat index showing only boolean schema *flags* (can't expand a schema or show a curl sample), and its "OpenAPI spec ↗" link is a **dead link** (404s — the web proxies only `/api/v1/*`, the spec lives at the API root). A safety-model panel *does* exist at `/trust-safety` and a NIS2 catalog exists in report code, but a CAB-clearing buyer has no network-architecture diagram, no data-flow doc, and no NIS2 walkthrough. **Missing raw data:** runner network profiles expose outbound *ports* but no egress *hosts/FQDNs*, so a plant firewall allowlist cannot be built from the product at all. ~200 `title=` attributes are keyboard/SR-invisible for lack of any accessible tooltip.
- *Fix:* Add per-endpoint schema expand + copyable samples + a working same-origin spec link; an in-app runner deployment/architecture + safety-model reference; a NIS2 evidence-mapping walkthrough; contextual info-popovers (visible + `aria-described`, not `title=`); a scoring-term glossary; make dead status labels ("needs API key", "Billing not connected") actionable links.

### P2 — Fix in the productionization pass

**17. Reports export is HTML-only despite a working PDF renderer; share links have no copy, visible expiry, or revoke**
- *Location:* `reports-workbench.tsx` L306 (`format:'html'` hardcoded), L356-360 (raw share URL) · *Effort:* M · *Raised by 5:* researcher, panw-pm, ciso-finserv, ciso-retail, ciso-tech
- *Verified:* "No PDF" and "fake expiry" are **refuted** — a real `%PDF-1.4` renderer is wired to 3 routes and the client already accepts `format:'pdf'`; share links are signed JWTs with an enforced 7-day expiry and a `report.shared` audit event on mint. Surviving gaps: the export button hardcodes HTML (PDF unreachable from UI), the share URL renders as bare truncated text with no copy button and **discards the `expiresAt` the API already returns**, `maxTopItems` is hardcoded to 5, and **revoke is architecturally impossible** (stateless token, no denylist) — a leaked evidence link lives its full 7 days. **Access blind spot:** the public share route serves the pack with **no view/access audit event** — zero egress visibility into who opened it. Also: `requestDownload` reads the body as `text()` and re-blobs, which will corrupt a future binary PDF.
- *Fix:* Expose a format toggle (HTML/PDF) + tunable top-N + board presets; render share links with copy button + visible expiry + a revoke action (needs a stateful token store); log share *access*, not just creation; fix the download to handle binary.

**18. MFA enrollment shows a raw secret / otpauth URI with no QR code**
- *Location:* `account-security.tsx` L192-205 · *Effort:* S · *Raised by 4:* panw-pm, ciso-mfg, ciso-tech, ciso-retail
- *Verified:* Enrollment renders only the base32 secret + raw `otpauth://` URI as mono text; no QR component and no QR dependency exist anywhere, while the copy literally says "Scan or paste" — promising a scan target that doesn't exist. Backend returns everything needed. (Also noted: no in-place authenticated password change, no active-session/device revocation.)
- *Fix:* Render an inline SVG QR (self-contained, CSP-safe) from the existing URI, keep the secret as manual fallback; add password change + session revocation.

**19. Nothing on the triage surfaces auto-refreshes — the "command center" goes stale, and "real time" copy is false**
- *Location:* `/dashboard`, `/findings`, `/signal-activity`, `/threat-feed`; `use-api-resource.ts` · *Effort:* S · *Raised by 1:* soc
- *Verified:* The shared hook fetches once on mount with only manual refetch — no polling/visibility gating; the dashboard has no manual refresh button at all. **Trust gap:** threat-feed's header markets "watched in real time / you get an alert the moment a fresh threat correlates" yet never polls — a new Critical won't surface until manual reload. No "updated Xs ago" freshness indicator exists.
- *Fix:* Add a visibility-gated `refetchInterval` (30-60s) to dashboard/threat-feed/findings with a visible "Live · updated 12s ago" pill.

**20. The guided "proof loop" is a passive posture snapshot mislabeled "Prove," with a policy preview/execution mismatch**
- *Location:* `/missions` — `validation-snapshot-flow.tsx` run() L111-125, checkPolicy L127-160 · *Effort:* S · *Raised by 1:* redteam
- *Verified:* "Never executes anything" is **refuted** — `createSnapshot` runs `executeInlineValidation` across 10 measured modules (TLS/DNS/HTTP/CORS/security.txt) as real `ActiveNonInvasive` runs with measured evidence, and per-path Measured-vs-Heuristic badges are honest. What survives: `checkPolicy` hardcodes `PassiveReadOnly`, and the "Prove"/"proof loop" copy overclaims — non-invasive posture validation is not exploitability proof. **Real preview/execution mismatch:** the operator previews a `PassiveReadOnly` decision but the gated run executes an `ActiveNonInvasive` mission, and the run gates only on `gateOk` (scope Verified), never on the previewed outcome — so the previewed decision is never bound to the run.
- *Fix:* Align the policy preview's safety level to the actual `ActiveNonInvasive` run; soften "Prove" to "measured non-invasive validation" (or route a "Prove exploitability" CTA to a real Execute run); bind the previewed decision to the run.

**21. Executive overview has no period selector, no export, an unexplained readiness ring, and inert deltas**
- *Location:* `/executive` — `executive-overview.tsx` · *Effort:* M · *Raised by 1:* ciso-finserv
- *Verified:* No period selector/window label, no export/print, readiness ring has no legend, and on the default Summary tab a failed fetch is indistinguishable from empty (no error branch — only secondary tabs handle errors). **Headline feature non-functional:** "Change since last period" deltas are hardcoded `delta:0 / previousValue:null / trendDirection:"NotAvailable"` — the delta a CISO would quote is never computed (degrades to honest "no prior period," so not deceptive, just absent).
- *Fix:* Add a labeled period/date-range selector, export/print, a readiness-weighting legend, a page-level degraded-data banner, and actually compute period deltas from the persisted metric series.

**22. No data-residency selection, BAA, or subprocessor disclosure; `dataRegion` is decorative**
- *Location:* global (`/admin`, `/signup`, `/trust-safety`) · *Effort:* M · *Raised by 1:* ciso-health
- *Verified:* A `dataRegion` field exists and is shown read-only, but it's set server-wide from an env var, **not tenant-selectable at signup, and never consumed by storage code** — a cosmetic label implying a residency guarantee that doesn't exist (a trust defect). No BAA reference, no subprocessor list, no evidence-at-rest encryption disclosure (encryption-at-rest exists only for connector creds/TOTP). (Tempered: self-hostable, so "opaque location" overstates the shipping posture.)
- *Fix:* Add tenant-level residency selection at provisioning that actually routes storage; a Trust & Safety panel disclosing storage region, encryption-at-rest, subprocessors, and a BAA/attestation reference.

**23. Control validation is DryRun-only; the LiveRunner inject-and-observe path is unreachable and the client type lies**
- *Location:* `/controls` — `controls-workbench.tsx` L356-357 vs `periscan-api-client.ts` L1010 · *Effort:* L · *Raised by 1:* blueteam
- *Verified:* `/controls` hardcodes `executionMode:"DryRun"` with no toggle. **The proposed "just wire LiveRunner" fix would 400 for every user** — `control-ai.ts` unconditionally rejects `LiveRunner` (disabled by design, gated to approved internal-runner missions), yet the client type advertises `executionMode?: "DryRun" | "LiveRunner"` — a dead, misleading typed surface. DryRun is stronger than claimed (it calls `connector.observeControl()` for genuine SIEM/EDR-measured Detected/Blocked/Missed). Real inject modules exist but aren't in the runner's measured set.
- *Fix:* Add a mode selector gated by a paired-runner + verified-scope readiness check (like `/missions`); show which mode each result came from; remove or gate the dead client type.

**24. Audit log view is hard-capped (100/200) with no date-range or pagination UI**
- *Location:* `/audit` — `audit-workbench.tsx` L68 · *Effort:* M · *Raised by 1:* ciso-finserv
- *Verified:* UI requests `limit:200` but the server silently caps at 100; no date picker, no pagination. **Trust trap:** the Area/Actor/search filters operate only over the loaded window, so a filter that looks global silently searches ~100 recent events. Server-side date-range filtering **already exists** end-to-end (just unwired), and a separate admin export dumps up to 5000 events with a truncation flag — so compliance review has a path, but old windows and >5000-event tenants aren't reachable via any UI.
- *Fix:* Wire the existing date-range filters into the UI and add true offset/cursor pagination to both the view and the export.

**25. Billing is a dead end — no price, no upgrade/contact-sales CTA, permanently "not connected"**
- *Location:* `/billing` — `billing-workbench.tsx` L101-105, L188-236 · *Effort:* M · *Raised by 1:* ciso-retail
- *Verified:* Plan cards have zero CTA; pricing prose never states a price; all billing routes are GET-only. **`paymentProcessorStatus` is hardcoded `z.literal("NotConfigured")`** — it can *never* represent a connected state. A knowingly deferred pre-monetization gap; blocks self-serve procurement, not the core job.
- *Fix:* Add a per-plan CTA (Upgrade / Talk to sales), surface real or "usage-based, contact us" pricing, make the badge start a connect flow.

**26. Priority score drives triage as an opaque integer on `/findings`**
- *Location:* `/findings` — `findings-workbench-v2.tsx` L317-324 · *Effort:* S · *Raised by 1:* researcher
- *Verified:* "No reproducible derivation" is **refuted** — `assessAttackPathRisk` is a deterministic sum of ~16 named, rationale-carrying factors, and the full breakdown *is* rendered on `/attack-paths/[id]` (one click from the finding). What's true: the `/findings` "Why this priority (N)" block drops the `factors[]` array and shows four hand-authored qualitative strings that read like the inputs but **do not sum to the integer** — an analyst could "audit" the wrong four.
- *Fix:* Propagate the existing `risk.factors[]` into the finding and reuse the attack-path factor component inline (or link explicitly), and expose the trivial signal-finding formula.

**27. Threat-alert acknowledge/dismiss has no error handling, no undo, no in-flight disable**
- *Location:* `/threat-feed` — `threat-feed-workbench.tsx` L102-108, L195-216 · *Effort:* S · *Raised by 1:* soc
- *Verified:* `actOnAlert` awaits with no try/catch and is invoked via `void()` → a failed action is an unhandled rejection with zero feedback; action buttons vanish once status leaves "New" with no re-open, though the backend enum supports it. No in-flight disable → double-click races two status updates.
- *Fix:* Wrap in try/catch with inline error, add an undo/re-open affordance, disable buttons in-flight.

**28. Additional single-persona P2s (verified, lower reach)**
- **No unified "Needs you" triage inbox** (soc) — the "Awaiting you" tile counts only remediation verifications, not new findings/alerts/pending approvals; no summed badge. *S.*
- **Findings header is a 5-line jargon essay above the queue** (soc) — collapse to one line + tooltip. *S.*
- **Findings queue has fixed sort and no "New / un-dispositioned" view** (soc) — disposition isn't even a filterable axis in UI or schema. *S.*
- **Threat feed catalog hard-capped at 25 with no filter/pagination** (soc) — backend supports `kind/severity/kev/q` + limit 200, unwired; alerts list is *not* capped (refutes part). *M.*
- **"Workbenches" are read-only dashboards** (panw-pm) — overstated (Operators has a real approve→queue write; no user-facing "Workbench" label), but `external-validation-profiles` is non-interactive and MSSP has no client drill-in. *M.*
- **Expected-behavior tuning is free-text comma strings against an enum** (blueteam) — typos persist but are display-only (refutes "permanent Missed"); worse, help text claims tuning "changes the yardstick" when stored values feed no grading path. Replace with a multi-select. *S.*
- **Tuning silently redefines "Covered" with no diff, provenance, or audit** (blueteam) — `updateControlSource` writes zero audit events (worse than "buried in /audit"); RBAC-gated and re-derives from signals, so not permanent. *M.*
- **AI-app "safe validation" result is too thin to action** (blueteam) — the DTO strips the ATT&CK techniques, test-suite, and evidence artifact the backend already computes. *M.*
- **Can't direct the attack — no module/technique/chain authoring** (redteam) — overstated: operator-authored `plan[]`, a module catalog, and a PlanOnly per-step policy-verdict preview all exist in the backend/client; only the UI picker is missing. *M.*
- **Approval ID at the Execute boundary is unvalidated against any authorization record** (redteam) — UUID *format* is checked, but it's never cross-referenced to the stored authorization refs, and it's **discarded after gating** (not persisted on the engagement or audit event) — the audit trail has no durable link to the claimed approval. Practical exploitability low (defense-in-depth). *M.*
- **Attack-paths workbench has a hardcoded basis filter, no export, no per-row action** (redteam) — "inert" overstated (working search/filter/sort + rich detail links); the real gap is missing export + the dark verify endpoint. *M.*
- **Air-gapped runner is unsupported** (ciso-mfg) — headline enum misattributed (`AirGappedFuture` is a *model*-hosting enum, not runners); runners are genuinely outbound-only with no offline mode. PRD markets air-gap while internal docs admit "fixture only." *XL.*
- **Effective safety level / blast-radius is never shown or selectable on `/missions`** (ciso-mfg) — the flow discards the `safetyLevel` the DTO returns; a `SafetyLevelBadge` exists and is wired into 4 other consoles but not this flagship one. *S.*
- **Scope taxonomy has no OT/Purdue/segment model and no free-form tags/metadata** (ciso-mfg) — broader than OT: scopes can carry no business context at all. *L.*
- **Runner Kill/Revoke can't confirm the kill engaged on the host** (ciso-mfg) — enforcement is fail-closed but *lazy* (runner learns on next 15s poll) and the ack is never surfaced, contradicting "stops it instantly." *M.*
- **Validation results are ephemeral; some list rows / radar blips dead-end** (ciso-tech) — "no persistence" overstated (missions/snapshots/reports persist and deep-link), but the results panel is React state, swarm blips aren't clickable, workflow rows/operator flash aren't linked, and there's no `/missions/[id]` route. *M.*
- **Large-tenant caps** (ciso-retail) — "216 connectors unreachable" **refuted** (category filter shows 100% of every category; caps only bite the "All" view); real gaps are no table virtualization on paths/findings and the audit window issue (see #24). *M.*

### P3 — Polish / low-reach

- **`/controls` "Validation scenarios" panel renders a coverage-fetch error as an empty state** (blueteam, researcher) — real inconsistency, but the sibling panel above shows a loud ErrorState for the same fetch, so the user isn't misled. Add an error branch. *S.*
- **ATT&CK catalog is a static 10-technique reference with no coverage overlay or search, and overpromising "tenant-scoped / evidence-mapped" copy** (blueteam) — the coverage overlay the reviewer wants already lives in the Controls workbench they came from; fix is the mis-directed link + honest copy. *S.*
- **Engagement scope picker lists unverified scopes and dies blank at zero scopes** (redteam) — "unverified is a trap" refuted (options are status-annotated; safe plan doesn't block); only the missing empty-state CTA survives. *S.*

## Cross-cutting themes

- **Silent-failure epidemic (the #1 systemic defect).** Empty `catch` blocks on write/destructive paths appear in at least 7 components and were independently flagged by 9 of 10 personas. The pattern is uniform: `onChanged()`/refetch sits inside the `try`, so on failure nothing surfaces *and* nothing self-corrects — and the reassuring code comments ("refetch surfaces state") are provably false. On a "prove it" security product, a failed kill-switch or redact that looks identical to success is the most trust-corrosive class of bug present.
- **Backend built, UI unwired (the shape of nearly every P1).** SSO, PDF export, compliance/attestation packs, evidence-chain verification, AI-policy CRUD, credentialed connectors, per-artifact integrity — all exist and are tested server-side but are read-only, hardcoded, or absent in the shipped surface. Several are *regressions* where a working UI (`model-gateway-workbench.tsx`) or a returned field (`integrityVerified`, `expiresAt`) was dropped or discarded during the redesign.
- **Read-only "workbenches."** The core objects (attack paths, coverage rows, model policies, external profiles) are investigate-only — the user must navigate away to act, and sometimes the destination has no actions either. Value is trapped one click from where it's needed.
- **Governance theater on secondary surfaces.** Approval IDs unvalidated and undiscarded to audit; audit events modeled but never written for evidence download/redact; "governed server-side" copy that isn't; a Redact control that is a pure no-op; a `dataRegion` label that guarantees nothing. The kernel governance engine is real, but the affordances around it overclaim.
- **No verifiability of the flagship claim.** The tamper-evident chain — the product's central differentiator — cannot be checked from the product by the exact skeptical buyer it's sold to.
- **Enterprise/compliance table stakes missing at the UI layer.** No self-serve SSO, no forgot-password, no bulk triage, no $-risk, no compliance artifact generation, no board PDF from the UI, no schedule windows/timezones — each individually a procurement gate for an F1000 buyer.
- **Honest but shallow.** Where the product is honest it is *category-leading* honest (measured-vs-heuristic, "never marks Fixed"), but several honest surfaces are too thin to action (AI-app validation, priority-score derivation on `/findings`, coverage rows).
- **Scale/freshness assumptions unmet.** Full client-side fetch + `filtered.map` with no pagination/virtualization, no auto-refresh, and "real time" copy over a poll-less feed — fine at demo scale, friction at F1000 scale.

## What's genuinely strong (keep)

- **The measured-vs-heuristic honesty model.** Explicit badges that never dress a heuristic as measured, disposition copy that states "it never marks a finding Fixed — only a real verification event can." This is the most defensible ground the product has; lead with it.
- **A real, tested tamper-evident evidence hash-chain.** `computeEvidenceChainHash`/`verifyChainLinks` with reorder/deletion/tamper detection and advisory-lock-serialized extension. The engineering exists — it just needs a verify button.
- **A real policy/safety engine.** Enforced safety floors (destructive/exfil/persistence/credential-theft hard-blocked), tenant ceilings, verified-scope and role gates on schedules/engagements, offensive-module governed authorization, a genuine kill-switch. Non-invasive-by-default is a defensible safety posture.
- **A real compliance control catalog + attestation renderer + PDF pipeline.** DORA/NIS2/PCI/ISO/SEC/GDPR/EU-AI-Act mappings and a working `%PDF-1.4` renderer exist — the whole "generate the auditor's artifact" story is one wiring pass from real.
- **Honest, safety-forward offensive design.** PlanOnly dry-run with per-step policy verdicts, outbound-only runners, `ActiveNonInvasive` defaults, and an OffensiveValidationPanel that already requires an authorization reference and surfaces errors — proving the correct patterns are in-house.
- **Correct patterns already present in-tree.** Sibling handlers that surface errors, a two-step confirm on the gateway kill-switch, a `SafetyLevelBadge`, ErrorState+retry panels — the fixes for the biggest defects are consistency work, not invention.

## Refuted / dropped (do not rediscover)

- **Dashboard "Findings queue" shows arbitrary findings** — `/findings` returns pre-sorted by `priorityScore` desc; `slice(0,6)` already yields the top 6. No bug.
- **Redact irreversibly mutates a chain-committed artifact** — the opposite is true: redact is a `void`-discarded no-op that persists nothing; the real defect (a phantom control) is captured in P1 #7.
- **Attack-path "Basis" filter hardcoded is a correctness bug** — `evidenceBasis` is a closed 2-value enum; the hardcoded list is exhaustive and deriving-from-data would *regress* (hide valid options). Cosmetic only.
- *(Partial refutations folded into their findings above: schedules do have role+verified-scope gates; SSO/PDF/expiry all exist server-side; "264 connectors unreachable" is false via category filter; "can't direct the attack" ignores the existing `plan[]`+PlanOnly; several "irreversible" claims are actually silent no-ops.)*

## Recommended sequencing

**Wave 0 — Stop lying to the operator (days, S).** These undercut the core trust thesis and are near-free:
1. Kill every empty `catch` on `api.*` writes → inline `role=alert` + move refetch out of the `try`; add a lint rule (P1 #1).
2. Add confirm dialogs (typed-name for Revoke/Redact) reusing the gateway pattern (P1 #1).
3. Fix Redact to actually persist + advance the chain, or remove it until it does (P1 #7).
4. Surface the already-returned `integrityVerified` on download; stop discarding it (P1 #3).

**Wave 1 — Wire the flagship + the enterprise gates (weeks, M/L).**
5. Evidence "Verify chain / Verify integrity" endpoint + button (P1 #3, M).
6. Compliance/attestation: `createReport` client + framework/packType picker + **render the control→evidence table** + `/compliance` workbench; add HIPAA/SOC2 with migration (P1 #4, L).
7. SSO config form + forgot-password page/link (both backends exist) (P1 #6, L).
8. Reports: PDF toggle + copy/expiry/revoke on share links + share-*access* logging (P2 #17, M).
9. Bulk triage bar + AcceptedRisk owner/expiry/approver + four-eyes (P1 #5, M–L).

**Wave 2 — Make the workbenches act + close the daily-driver gaps (weeks, M/L).**
10. Attack-path "Validate (safe)" (wire the existing verify endpoint) + evidence deep-links (P1 #8, M).
11. Coverage-row drill-through (evidenceIds/signalIds/lastObservedAt) — data's already in the payload (P1 #9, S).
12. Finding → "Route to remediation / ticket" (P1 #12, M).
13. AI-policy CRUD (port the orphaned workbench) + provider lifecycle (P1 #13, M).
14. Credentialed connector flow + telemetry-typed Sync; kill the false "Connected" badge and prod mock-throw (P1 #14, M).
15. Auto-refresh + freshness pill on triage surfaces; fix the "real time" copy (P2 #19, S).

**Wave 3 — Regulated-vertical & scale readiness (L+).**
16. Schedule windows/timezone/blackout + edit/delete + close the scheduled-run policy-gate asymmetry (P1 #2, L).
17. Coverage trend/regression persistence (P1 #10, L).
18. Asset/OT scope classification + per-segment safety ceiling + safety-level display on `/missions` (P1 #11 + P2, L).
19. $-risk quantification on exec/reports (P1 #15, L).
20. In-app help/architecture/NIS2 docs + working API-reference (P1 #16, M); MFA QR (P2 #18, S); pagination/virtualization on findings/paths/audit (P2 #24/#28, M).

Rationale: Wave 0 protects the one asset scoring highest (Trust) for near-zero cost; Waves 1-2 convert "governance viewer" into "governance system of record" by wiring capability that already exists; Wave 3 unlocks the specific F1000/OT verticals. Nothing here is a from-scratch subsystem except air-gap runners and $-risk — the build cycle is overwhelmingly *exposure and consistency*, not new engines.