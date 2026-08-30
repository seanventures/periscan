# Periscan — Layer-1 live evidence (2026-07-13)

Captured by driving the LIVE app at https://app.periscan.com in a real browser
(post the first-run UX fix, commit b30d07db). This is ground truth for the UX
panel. Source lives in `apps/web/` (Next.js app-dir); route→component map below.

## Product & ICP
Periscan = self-service AEV/ASV/CTEM SaaS. Tagline: "Find the path. Validate the
risk. Prove it's fixed." It validates exposure, controls, attack paths, and AI
apps, then produces evidence-backed proof (measured vs heuristic, honestly
labeled). ICP: security teams at mid-market → Fortune 1000 (red/blue/SOC/CISO),
desktop-first, low patience, high skepticism, compliance-driven buyers.

## Route → component map (37 authed surfaces + auth/demo)
- /login, /signup → auth-form (clean; signup: name/org/email/password)
- /demo → public-demo-report (populated sample; the ONLY populated pre-signup view)
- /dashboard → dashboard-command-center (now branches to GetStarted onboarding when empty)
- /executive → executive-overview        /missions → validation-snapshot-flow (guided 5-step)
- /reports → reports-workbench           /attack-paths → attack-paths-workbench (+/[id])
- /findings → findings-workbench-v2       /controls → controls-workbench
- /ai-apps → ai-apps-workbench            /evidence → evidence-ledger
- /remediation → remediation-workbench (+/[id])   /schedules → schedules-workbench-v2
- /swarm → autonomous-operations          /workflows → agent-workflow-studio
- /operators → operators-workbench        /model-gateway → frontier-gateway-console
- /mcp → mcp-console                       /integrations → integrations-marketplace (264 connectors)
- /runners → runners-console               /registries → tool-governance-marketplace
- /signal-activity → signal-activity-stream
- /threat-center → threat-center-workbench-v2   /threat-feed → threat-feed-workbench
- /attack-techniques → attack-techniques-catalog
- /mssp → mssp-portfolio-workbench         /admin → admin-console
- /billing → billing-workbench             /audit → audit-workbench
- /trust-safety → trust-safety-dashboard-v2   /policies → trust-safety-dashboard
- /account-security → account-security     /api-reference → api-reference-console
- /external-validation → external-validation-profiles   /engagements → engagement-workbench
- /validation-ops → validation-ops-dashboard

## What was DRIVEN live (observations)
1. **Anonymous root** (before fix, now fixed): `/` → `/dashboard`; middleware.ts now
   redirects unauth → /login. VERIFIED: signed-out /dashboard → /login. No more
   authed-shell-with-"Authentication required"-errors for anonymous visitors.
2. **Login**: clean centered card, "Find the path…" subhead, "New to Periscan? Create
   an account" link. NO public marketing/landing page — login IS the front door.
3. **Signup**: name/org/email/password → immediately authenticated, lands on dashboard.
   No email-verification gate before entry; no welcome email observed in-flow.
4. **First-run dashboard (NEW)**: empty tenant now sees GetStarted — "Let's prove your
   first path", personalized copy, a living canvas radar sweeping the 6 CTEM stages,
   a 3-step checklist (connect source → verify scope → run snapshot) with REAL progress,
   primary CTA "Start — connect a source", secondary "Explore a live sample" → /demo,
   "0 of 3 complete" bar. Retires itself once a validation runs.
5. **Integrations**: strong. "Connected (0)" empty state + marketplace of 264 connectors
   (GitHub/GitLab/Atlassian… many "BETA"), search + category filter, "read-only by
   default" framing.
6. **Validation Snapshot (/missions)**: strong guided wizard — SCOPE→VERIFY→READINESS→
   RUN→RESULTS. Step 1 "add a domain you're authorized to validate" + input; step 2
   shows verified-scope/integrations/governed-tools readiness (0 connected, 31 tools
   enabled); policy gate step shows "DENIED" until readiness met.
7. **/demo**: strong. "See the proof loop before connecting systems", sample KPIs
   (3 validated paths, 1 control verdict, 1 AI validation, 3 fix proof), a "Demo story"
   narrative, "Open API-backed workspace" + "View sample report" CTAs, "Sample only" tag.
   BUT only discoverable from the login page + onboarding — not from a public URL/landing.
8. **Nav (NEW)**: 7 groups / ~28 items, now collapsible; Autonomous/Intel/Govern collapsed
   by default; "New validation" primary CTA at rail top. Command palette (⌘K) + tenant
   switcher + "systems nominal" health pill + account menu.

## Known structural facts (from code, for reviewers to build on — verify before asserting)
- Auth: session cookie (httpOnly, path:/, SameSite=lax, Secure in prod). MFA/TOTP +
  recovery codes exist in the API (account-security). Password reset + email verification
  + invites + account lockout exist server-side.
- The web calls the API only via a same-origin server-side proxy (app/api/v1/[...path]);
  connect-src 'self'. API is never exposed publicly.
- Backend is genuinely API-driven (no hardcoded data in authed flows). Evidence hash-chain,
  Postgres RLS (writes-enforcing), runner result-signing are live.
- Deferred/absent per project memory: SSO SAML/OIDC config UI (API exists), billing has no
  payment provider wired (usage metered, not priced), no in-app docs/help center beyond
  /api-reference, no public landing/marketing page.

## Data-state caveat for reviewers
The live tenant used is EMPTY (no scan run), so most authed data surfaces render empty
states — assess empty-state quality there. For the WITH-DATA experience, /demo and the
component code (which renders real API shapes) are the reference. Do NOT claim a data
surface is "broken/blank" solely because the review tenant has no data — read the
component to see what it renders when populated.
