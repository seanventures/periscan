# Operator TUI

> **BAS/AEV program:** [BAS_AEV_PROGRAM.md](BAS_AEV_PROGRAM.md) — qualified open-source simulation, emulation and evidence-backed validation (PERISCAN-583).

Drive the Community **proof loop** from a terminal: authorize a scope, take a
policy decision, run the permissive OSS pack, read evidence-backed findings,
open remediations, and only mark **Fixed** after a re-measurement.

The TUI (`apps/tui`) is an Ink client of the Fastify API. It is **not** a
second product. Same routes as the web app. Apache-2.0 source
([`LICENSE`](../LICENSE)). Qualified BAS/AEV coverage evolves independently of the first-hour pack; not a GitHub
Actions requirement.

Offering: [`COMMUNITY.md`](../COMMUNITY.md). Contract:
`packages/shared/src/community-edition.ts`.

```text
auth → scope → verify → policy → Community run → findings → remediations
                     ↘ Denied: never queued + audit event
```

---

## Bring the API up

The TUI talks to a running control plane. Plain `pnpm dev` has **no worker**
and cannot finish Community runs.

```bash
bash scripts/community-first-hour.sh   # deps + migrate; not proof
pnpm lab:dev                           # api + worker + web; LAB_MODE=1
```

Docker overlay instead of `lab:dev`: `bash scripts/community-up.sh`.

Default API origin is `http://127.0.0.1:3001`. `pnpm lab:dev` auto-shifts
off `:3001` when that bind is taken and prints `PERISCAN_API_URL`. Confirm:

```bash
curl -fsS "${PERISCAN_API_URL:-http://127.0.0.1:3001}/api/v1/health"
# {"service":"api","status":"ok","timestamp":"..."}
```

`GET /health` 307s to `/api/v1/health`. Ready (deps): `GET /api/v1/health/ready`.
Contract: `GET /openapi.json`.

Lab hops / SIEM canary (`pnpm lab:demo-up`) is a **different** path. Do not
sequence it as the Community pack. Fixture tenant (`pnpm seed:demo`,
`demo@periscan.local`) is labeled sample, not measured proof.

---

## Start the TUI

Needs a TTY (Ink). From the repo root, with the API already up:

```bash
export PERISCAN_API_URL="${PERISCAN_API_URL:-http://127.0.0.1:3001}"
pnpm tui
```

Equivalent: `pnpm --filter @periscan/tui start` (`tsx apps/tui/src/index.tsx`).

`PERISCAN_API_URL` is the API origin **without** a trailing slash. The TUI
strips a trailing `/` if you pass one. It does not read `PERISCAN_API_BASE`.
Automation examples that use `PERISCAN_API_BASE` still mean this same origin.

The header prints `PERISCAN operator TUI · <apiUrl>`. If that URL is wrong,
you are talking to the wrong plane.

| Key | Action |
| --- | --- |
| `1`–`9` | Jump screens (see map below) |
| `?` | Help |
| `q` | Quit |

Screens 1–9 are the operator spine. Evidence IDs live on the mission run;
list artifacts with `GET /api/v1/evidence`.

| # | Screen | Proof step | API |
| --- | --- | --- | --- |
| 1 | `home` | Orientation | — |
| 2 | `auth` | Session or API key | `POST /api/v1/auth/login`, `GET /api/v1/me` |
| 3 | `scopes` | Declare + verify | `POST /api/v1/scopes`, `POST /api/v1/scopes/:id/verify` |
| 4 | `run` | Policy + Community start | `POST …/policy-decisions/preview`, `POST /api/v1/community/validation-runs` |
| 5 | `missions` | Wait for work | `GET /api/v1/missions`, `GET …/runs/:runId/wait` |
| 6 | `findings` | Evidence ∩ mission | `GET /api/v1/findings?missionId=` |
| 7 | `fix` | Open remediations | `POST /api/v1/community/validation-runs/:missionId/remediations` |
| 8 | `engines` | Pack + Engine Lab | `GET /api/v1/community/validation-suite?scopeId=` |
| 9 | `health` | Control plane | `GET /api/v1/health` |

Cookie mutations need CSRF double-submit (`periscan_csrf` cookie +
`x-csrf-token`). Bearer `psk_…` keys do not. Login/signup/logout are CSRF-exempt
so a session can be minted.

---

## End-to-end (auth → Fixed)

Do these in order. A later screen cannot invent a verified scope or a policy
allow.

### 1. Auth (`2`)

Sign in (or sign up) against the API in the header.

```bash
API="${PERISCAN_API_URL:-http://127.0.0.1:3001}"

# First tenant (password ≥ 12 chars)
curl -fsS -c /tmp/periscan.cookies -H 'content-type: application/json' \
  -X POST "$API/api/v1/auth/signup" \
  -d '{"email":"you@example.com","name":"You","password":"choose-a-long-password","tenantName":"Lab"}'

# Existing user
curl -fsS -c /tmp/periscan.cookies -H 'content-type: application/json' \
  -X POST "$API/api/v1/auth/login" \
  -d '{"email":"you@example.com","password":"choose-a-long-password"}'
```

Cookies: HttpOnly `periscan_session`, readable `periscan_csrf`. Echo the CSRF
value on later POST/PATCH/DELETE:

```bash
CSRF=$(grep periscan_csrf /tmp/periscan.cookies | awk '{print $NF}')
auth=(-b /tmp/periscan.cookies -H "x-csrf-token: $CSRF" -H 'content-type: application/json')
curl -fsS "${auth[@]}" "$API/api/v1/me"
```

Prefer a tenant API key for headless work (no CSRF):

```bash
curl -fsS "${auth[@]}" -X POST "$API/api/v1/tenants/current/api-keys" \
  -d '{"name":"tui","scopes":["write"]}'
# Authorization: Bearer psk_<secret>  — secret returned once
```

`write` maps to SecurityEngineer (`mission:run`, `remediation:write`). MFA
accounts send `totpCode` or `recoveryCode` on login.

Lab demo tenant after `pnpm lab:demo-up` lives in `infra/lab/.lab-demo.env`
(gitignored). That tenant is for the hop spine, not a substitute for a
verified Community scope.

### 2. Scope (`3`)

Add a target you **own or are contracted to test**. Community start types:

| `scopeType` | `value` example | How you prove it |
| --- | --- | --- |
| `Domain` / `Subdomain` | `example.com` / `app.example.com` | DNS TXT `_periscan.<scope>` then verify |
| `Repository` | `/opt/customer/repo` | `.periscan-authorization` token file (Owner/Admin attest if runner-only) |
| `CloudAccount` | `123456789012` | Connected AWS account match, or Owner/Admin attest |
| `IPRange` | `10.0.0.0/24` | Audited Owner/Admin attest (`operatorAttestation: true`) |

```bash
curl -fsS "${auth[@]}" -X POST "$API/api/v1/scopes" \
  -d '{"scopeType":"Domain","value":"example.com","assetClass":"BusinessApplication"}'
```

Created scopes include `verificationToken` (DNS TXT / repo file).
`GET /api/v1/scopes` lists `{ items }`. Unverified scopes are inventory, not
runnable.

### 3. Verify (`3`, still)

```bash
curl -fsS "${auth[@]}" -X POST "$API/api/v1/scopes/$SCOPE_ID/verify" -d '{}'
```

Domain/subdomain: publish the TXT record first; empty body is the live DNS
check. Repository / AWS / CIDR: complete the challenge, or Owner/Admin
`{"operatorAttestation":true}` where that kind allows it.

`devModeManual: true` is **lab-only** (`PERISCAN_DEV_MODE`). Production Domain
verify stays DNS TXT. Unverified → `scope_not_verified`; nothing queues.

### 4. Policy (`4`)

Preview **before** start. Denied never queues.

Use `communityPolicyPreviewRequest` from `@periscan/shared` so the preview
matches the **primary** Community start set (Nuclei is not in this preview;
it is a second mission). Safety is `PassiveReadOnly` or `ActiveNonInvasive`.
Runner-lane engines preview `InternalRunner`; worker/cloud stay `ControlPlane`.
A ControlPlane ticket cannot start runner modules
(`community_environment_mismatch`).

```bash
curl -fsS "${auth[@]}" -X POST "$API/api/v1/scopes/$SCOPE_ID/policy-decisions/preview" \
  -d '{
    "executionEnvironment":"ControlPlane",
    "missionType":"ValidationSnapshot",
    "safetyLevel":"ActiveNonInvasive",
    "requestedAction":{
      "destructive":false,
      "realDataExfiltration":false,
      "persistence":false,
      "credentialTheft":false,
      "uncontrolledExploitChaining":false,
      "requiresInternalRunner":false,
      "requiresTimeWindow":false
    },
    "target":{"value":"example.com"}
  }'
```

Read `outcome` and `approvalState`. **Allowed** (or **RequiresApproval** after
an admin `POST /api/v1/approvals/:policyDecisionId/approve`) can start.
**Denied** stops here. Keep `policyDecisionId` for the next call.

### 5. Community run (`4` → `8` then `4`)

Optional: Engine Lab (`8`) → install + enable the Community pack so CLIs exist.
Missing binaries are `tool_unavailable` / Inconclusive — not invented findings.
Stock first-party DNS/TLS/HTTP on a verified Domain still runs without CLIs.

```bash
curl -fsS "${auth[@]}" "$API/api/v1/community/validation-suite?scopeId=$SCOPE_ID"
curl -fsS "${auth[@]}" -X POST "$API/api/v1/community/validation-runs" \
  -d "{\"scopeId\":\"$SCOPE_ID\",\"policyDecisionId\":\"$POLICY_DECISION_ID\"}"
```

HTTP 200 is not “jobs queued.” Read `jobsQueued` and `mission.status`. Zero
jobs + a deny rationale is honest refuse, not a pass.

Do **not** put Nuclei in primary `moduleIds`. Second mission id is
`nucleiMissionId` (nullable) with `nucleiSkipReason` when skipped. Reconstruct:

```bash
curl -fsS "${auth[@]}" "$API/api/v1/community/validation-runs?missionId=$MISSION_ID"
```

Unqualified adapters (currently Atomic, Caldera, SharpHound, sqlmap, Metasploit) do not start
from this screen. Copyleft engines stay Engine Lab + license accept.

### 6. Missions (`5`)

```bash
curl -fsS "${auth[@]}" "$API/api/v1/missions?limit=10"
curl -fsS "${auth[@]}" "$API/api/v1/missions/$MISSION_ID/runs/$RUN_ID/wait?timeoutMs=5000"
```

Wait 408 + `Retry-After` means still running (server cap 60s). Prefer webhooks
`mission.started` / `mission.completed` / `mission.failed` over busy-poll.
Jobs: `GET /api/v1/jobs?missionId=` (failed: `?status=Failed`).

If local lab hops or Community jobs sit forever on stale BullMQ keys, drain
(next section) and restart the worker — do not mark the mission Fixed.

### 7. Findings (`6`) + evidence

```bash
curl -fsS "${auth[@]}" "$API/api/v1/findings?missionId=$MISSION_ID"
curl -fsS "${auth[@]}" "$API/api/v1/evidence"
```

Findings for a mission are those whose evidence IDs **intersect that run**.
No evidence → empty list, not the tenant-wide queue. Optional SARIF:
`GET /api/v1/findings.sarif?missionId=`.

### 8. Remediations (`7`) then re-run

Open remediations from **that** mission’s findings:

```bash
curl -fsS "${auth[@]}" -X POST \
  "$API/api/v1/community/validation-runs/$MISSION_ID/remediations"
curl -fsS "${auth[@]}" "$API/api/v1/remediations"
```

Apply the fix outside Periscan. Re-run Community validation on the same
verified scope. Then `POST /api/v1/remediations/:id/verify`.

**Fixed** requires a verification event. Closing a ticket is
`ClosedWithoutEvidence`. Webhook: `remediation.verified`.

---

## Drain a stuck local queue

Local-lab only. Wipes Redis keys `bull:validation-missions*` so stale jobs
with missing mission context stop blocking work. Does **not** touch other
prefixes. Does **not** mark findings Fixed.

```bash
pnpm lab:drain-queue
# PERISCAN_LAB_DRAIN_QUEUE=1 bash ./infra/lab/scripts/drain-validation-queue.sh
# or: bash ./infra/lab/scripts/drain-validation-queue.sh --force
```

Then re-start the worker (`pnpm lab:dev` already includes it) and start a
**new** Community run. Production operators do not drain this way.

---

## Honest language

| Say | Do not say |
| --- | --- |
| BAS/AEV direction with measured scenario coverage | Unsupported parity or execution claims |
| `jobsQueued` after policy allow | “HTTP 200 means it ran” |
| Empty findings = no intersecting evidence | Clean bill of health from a deny |
| Fixed after re-validation | Mark Fixed from the TUI without verify |
| Community edition / Apache-2.0 source | “We are open source now” / LICENSE flip |

`pnpm tui` is sufficient to operate the loop. A GitHub proof Action exists at
[`actions/community-proof/README.md`](../actions/community-proof/README.md); it
is optional automation, not a gate for this TUI.

---

## Related

| Want | Where |
| --- | --- |
| Community offering + engine pack | [`COMMUNITY.md`](../COMMUNITY.md) |
| First hour / overlay | `scripts/community-first-hour.sh`, `scripts/community-up.sh` |
| Lab hops (not this pack) | [`DEMO_LAB_SITE.md`](DEMO_LAB_SITE.md), `pnpm lab:demo-up` |
| API contract for any UI | [`API_UI_INTEGRATION.md`](API_UI_INTEGRATION.md), `GET /openapi.json` |
| Headless proof-loop sample | [`examples/proof-loop.sh`](../examples/proof-loop.sh) |
| `.periscan.yaml` (intent only) | [`PERISCAN_YAML.md`](PERISCAN_YAML.md) |
| Safety floor | [`SECURITY_BOUNDARIES.md`](../SECURITY_BOUNDARIES.md) |
