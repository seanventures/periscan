# Feature Agent: Web Product Surfaces (API-Done → Product-Done)

**Agent:** Codex (web product-surface engineering subagent)
**Branch:** ai/codex/web-product-surfaces (off main)
**Date:** 2026-06-06
**Scope (owned):** `apps/web/**`, `apps/web/src/lib/periscan-api-client.ts`, UI-surface sections of `docs/TRACEABILITY_MATRIX.md` + `docs/IMPLEMENTATION_STATUS.md`.
**Do NOT touch:** `apps/api/src/runtime-services.ts`, `packages/**`, Go runner, Prisma (parallel worker owns these).

## Problem

Chief-architect review found PRD-defining capabilities that were API-Done but had no web product surface, yet were marked simply "Done." Built real-data UI surfaces with honest loading/empty/error/unauthenticated states.

## Surfaces delivered (all consume real `/api/v1` data via `browserPeriscanApiClient`)

1. **Unified findings** — `/findings` route + `findings-workbench.tsx`; client `listFindings`/`getFinding` → `GET /api/v1/findings`, `/findings/:id`. Prioritized cross-motion queue, filters, path proof, missing-signal impact, cross-links.
2. **Signal / activity stream** — `/signal-activity` route + `signal-activity-stream.tsx`; client `getSignalTriggers`/`listSignalTriggerActivity`/`approveSignalTrigger` → `GET /api/v1/signal-triggers`, `/signal-triggers/activity`, `POST /signal-triggers/:id/approve`. Approve creates draft mission view.
3. **Missions / runs** — `/missions` route + `missions-workbench.tsx`; client `listMissions`/`listMissionRuns`/`getJob` → `GET /api/v1/missions`, `/missions/:id/runs`, `/jobs/:id`. Run status/outcomes/errors/evidence + queue-job lookup.
4. **Fix verification** — `snapshot-workbench.tsx` Verify-fix action; client `verifyRemediation` → `POST /api/v1/remediations/:id/verify`. Shows previous-vs-current evidence diff.
5. **Attack-path depth** — shared `attack-path-depth.tsx` rendered in Snapshot + Validation Ops cards (confidence, ordered steps, edge rationale, choke points; renders only real fields).
6. **Docs** — added Web Product Surfaces (API-Done vs Product-Done) section to `IMPLEMENTATION_STATUS.md` and 5 `*-WebSurface` rows to `TRACEABILITY_MATRIX.md`.

Navigation: added Findings / Missions / Signal activity to `app-navigation.tsx`.

## Contract assumption (fix verification)

Built against the existing `POST /api/v1/remediations/:id/verify` contract, which returns `RemediationVerificationResult` = `{ attackPath, mission, remediation, run, verificationEvent }` (see `apps/api/src/runtime-services.ts`). `attackPath` treated as nullable; previous-vs-current evidence diff derived from the pre-action remediation `evidenceIds` vs `verificationEvent.evidenceIds`. No backend code changed.

## Tests added

`findings-workbench.test.tsx`, `signal-activity-stream.test.tsx`, `missions-workbench.test.tsx`, `attack-path-depth.test.tsx`, plus a fix-verification case in `snapshot-workbench.test.tsx`. API mocked at the fetch boundary (real client wiring through Zod parse).

## Verification

`pnpm --filter @periscan/web typecheck` ✅ · `pnpm --filter @periscan/web lint` ✅ · `pnpm --filter @periscan/web test` ✅ (21 files / 83 tests).

## Note

A baseline repair commit was required first: `apps/web` on `main` had a regressed `periscan-api-client.ts` and drifted components/tests; restored from `ai/codex/product-truthfulness-fixes` to get a green baseline before layering new surfaces.
