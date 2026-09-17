# Periscan API changelog

Semver for the public HTTP product API (`GET /openapi.json` → `info.version`).

| Version | Date | Notes |
|---------|------|--------|
| **0.4.0** | 2026-08-15 | Community edition product routes: `GET /community/validation-suite` (`getCommunityValidationSuite`), `POST /community/validation-runs` (`startCommunityValidation`), `GET /community/validation-runs?missionId=` (`getCommunityValidationCompanion`), `POST /community/validation-runs/:missionId/remediations` (`createCommunityMissionRemediations`). `GET /findings` accepts optional `missionId` (evidence intersection). `POST /scopes/:id/verify` accepts `operatorAttestation` for non-DNS Community scopes. Nuclei remains a second mission; deny skip is reconstructable from the sibling run. Not a LICENSE flip. |
| **0.3.3** | 2026-07-30 | Webhook event catalog `GET …/webhooks/event-catalog` (`getWebhookEventCatalog`): discoverable `eventTypes` + signature/header contract for receivers (admin / `webhook:admin`). Admin Webhooks panel surfaces catalog headers. Closes P20-5 / overnight O13 cheap wiring residual. |
| **0.3.2** | 2026-07-30 | Wave B DRV marker proof route `POST …/control-sources/:id/detection-marker-proof` (`runDetectionMarkerProof`): allowlisted `periscan-*` emit→observe only; response always `drvClaimClass: benign_marker_only`, `fullAttackLibrary: false` (not full ATT&CK BAS). Wave E OAS honesty: preferred `POST …/remediations/:id/auto-revalidate` (`autoRevalidate`) and deprecated alias `…/auto-mitigate` (`autoMitigate`, `deprecated: true`) both document `actionApplied: false` (plan + re-measure only; never config push). Wave C continuous EASM is **schedule fire behavior** on existing `runSchedule` / due-sweep for `missionType: ContinuousValidation` — queues hard-allowlisted safe external/recon modules on verified scopes and enriches schedule `diff.summary` + `config.continuousEasm`; **no new public route**. Payload registry covers request (and response where typed) for the above operationIds. |
| **0.3.1** | 2026-07-30 | Webhook lifecycle complete: `POST …/webhooks/:webhookId/rotate-secret` (one-time secret) and `POST …/webhook-deliveries/:deliveryId/redrive` (202, Failed/dead-letter only). Admin UI rotate + dead-letter redrive. OAS coverage ignores hidden SCIM `app.all` honesty stubs. |
| **0.3.0** | 2026-07-29 | Preferred remediation revalidation route `POST …/remediations/:id/auto-revalidate` (legacy `auto-mitigate` deprecated, no config push). Findings list remains offset-paginated (`page.hasMore` / `limit` / `offset`). `GET …/findings/disposition-feedback` and `POST …/control-sources/detection-eng-tasks` ship for blue ops feedback loops. |
| 0.2.0 | prior | Documented product OpenAPI baseline used by UI API reference. |

### 0.3.x honesty residual (not claimed as shipped)

Do **not** treat the following as public product surface until routes land and this changelog is updated:

- Rate-limit store keys still use raw API key material in some deployments — hashing is **not** guaranteed for 0.3.x.
- `listAttackPaths` / `listRemediations` / `listEvidence` return bare `{ items }` only (no `page` / `offset` / `nextCursor`). They honor optional `?limit=` via shared `parseLimit` (default **50**, max **200** for paths/remediations; evidence max **100**). Clients cannot discover whether more rows exist without a separate total query; this is intentional limit-capping, not full pagination.
- Webhook rotate-secret, redrive, and **event-catalog** ship as of 0.3.1 / 0.3.3.
- `POST …/findings/bulk` (`bulkTransitionFindings`) and `GET …/lab/capabilities` (`getLabCapabilities`) are **not mounted**. Shared Zod may still define bulk input for a future route; UI disposition is single-finding `transitionFinding` only.
- Continuous EASM (0.3.2) is **not** autonomous living-map discovery or full ASV seed expansion — seeds remain user-declared **verified** scopes; modules are hard-allowlisted. Do not invent a dedicated continuous-EASM HTTP resource; use schedule create/run with `ContinuousValidation`.

## Compatibility rules

1. Bump **minor** when adding routes, query params, or response fields clients can ignore.
2. Bump **major** (or document sunset headers) when removing routes, required fields, or changing auth semantics.
3. Keep `info.version` in `apps/api/src/app.ts` in sync with this file.
4. Retired routes may return `410` with a stable `code` (example: asset valuation direct update).

## Webhook signing note

Outbound webhook secrets (`whsec_…`) are returned **once** on create and on `POST …/webhooks/:webhookId/rotate-secret`. Receivers should verify the published signature headers (`GET …/webhooks/event-catalog` lists header names + `sha256=<hex>` format); secret material is never listed back after the one-time return. Failed or dead-lettered deliveries can be re-enqueued via `POST …/webhook-deliveries/:deliveryId/redrive` (202).
