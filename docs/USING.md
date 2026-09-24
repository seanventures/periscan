# How to use Periscan (Community)

> **BAS/AEV program:** [BAS_AEV_PROGRAM.md](BAS_AEV_PROGRAM.md) — qualified open-source simulation, emulation and evidence-backed validation (PERISCAN-583).

Authorize a target you own (or are contracted to test). Run the Community
pack under policy. Keep evidence. Mark **Fixed** only after a re-measurement.

This is the operator path. Install, compose, ports, doctor:
[`SETUP.md`](./SETUP.md). Questions: [`FAQ.md`](./FAQ.md). Offering:
[`COMMUNITY.md`](../COMMUNITY.md). Safety floor:
[`SECURITY_BOUNDARIES.md`](../SECURITY_BOUNDARIES.md).

BAS/AEV development follows qualified adapters; this guide describes current workflows. Fixture
demo login is **not** measured proof.

---

## Prerequisites

| Need                 | Notes                                                                                                                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node **24**          | [`.nvmrc`](../.nvmrc)                                                                                                                                                                        |
| pnpm **9.15.0**      | Corepack                                                                                                                                                                                     |
| Docker               | Engine + Compose plugin. Use [`infra/docker-compose/docker-compose.yml`](../infra/docker-compose/docker-compose.yml) for local deps; do not run a bare `docker compose up` at the repo root. |
| A repository you own | `git clone <your-repo>`, then paste the **absolute path**. Hosted `github.com/org/repo` is refused.                                                                                          |
| Gitleaks runtime     | A host binary is optional. Docker runs the pinned image when the binary is absent. A failed runtime returns Inconclusive, not invented findings.                                             |

`bash scripts/periscan.sh start` runs `pnpm lab:dev` (API + **worker** + web).
Plain `pnpm dev` has no worker and cannot finish Community runs.

---

## One-paste installer (`install.sh`, PERISCAN-576)

Curl target is the repo-root [`install.sh`](../install.sh). `scripts/install.sh`
is a thin wrapper to the same file.

```text
curl -fsSL --proto '=https' --tlsv1.2 https://raw.githubusercontent.com/seanventures/periscan/main/install.sh | bash
bash install.sh --dry-run
bash install.sh doctor    # health + repair
bash install.sh health    # check only
bash install.sh repair    # alias doctor
```

Reuses `scripts/periscan.sh` / `scripts/community-first-hour.sh` /
`infra/lab/scripts/env.sh`. Local deps stay
`infra/docker-compose/docker-compose.yml`. Busy ports remap (557). Do not kill
neighbor apps. Do not wipe a neighbor Redis.

## Install contract (`scripts/periscan.sh`)

Owned by Plane **PERISCAN-560**. Do not rename subcommands. The script is the
stranger CLI after `git clone https://github.com/seanventures/periscan`.

```text
bash scripts/periscan.sh install   # Node/pnpm/Docker checks, compose deps, migrate
bash scripts/periscan.sh start     # pnpm lab:dev (API+worker+web); print URLs/ports
bash scripts/periscan.sh status    # API health if up; print chosen ports
bash scripts/periscan.sh update    # git pull (if git), pnpm install, migrate; print "restart with start"
bash scripts/periscan.sh down      # stop tracked lab:dev children; compose stop deps
bash scripts/periscan.sh help
```

| Rule      | Meaning                                                                                                                                                                                                   |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `install` | Toolchain + `infra/docker-compose/docker-compose.yml` (project `periscan-deps`, or a checkout-specific name if another clone owns it) + Prisma migrate. Not `seed:demo`. Not `lab:up`. Not `pnpm verify`. |
| `start`   | Host toolchain control plane. Prints web + API URLs. Auto-shifts off `:3000` / `:3001` when busy.                                                                                                         |
| `status`  | `GET /api/v1/health` against the chosen API port. Down is honest, not a fake pass.                                                                                                                        |
| `update`  | Pull + install + migrate. Does **not** restart processes. You run `start` again.                                                                                                                          |
| `down`    | Stop lab:dev children if tracked; `compose stop` deps. **Does not** `docker compose down -v` (volumes stay).                                                                                              |
| Postgres  | Honors `PERISCAN_POSTGRES_PUBLISHED_PORT` (lab default **5434**). If that bind is taken, pick the next free port. A neighbor `:5434` is never this clone. Export `DATABASE_URL` to match.                 |

---

## 1. Install and start

```bash
git clone https://github.com/seanventures/periscan.git
cd periscan
bash scripts/periscan.sh install
bash scripts/periscan.sh start
```

Read the printed URLs. Defaults when free:

| Service  | Default                      | Override                                                               |
| -------- | ---------------------------- | ---------------------------------------------------------------------- |
| Web      | `http://127.0.0.1:3000`      | `PERISCAN_WEB_PORT` (`lab:dev` → `3010+` if busy)                      |
| API      | `http://127.0.0.1:3001`      | `PERISCAN_API_PORT` (next free if busy; printed as `PERISCAN_API_URL`) |
| Postgres | `127.0.0.1:5434` (published) | `PERISCAN_POSTGRES_PUBLISHED_PORT` **and** `DATABASE_URL`              |
| Redis    | `127.0.0.1:6379`             | `PERISCAN_REDIS_PUBLISHED_PORT` **and** `REDIS_URL`                    |

Confirm the plane you actually started:

```bash
API="${PERISCAN_API_URL:-http://127.0.0.1:3001}"
curl -fsS "$API/api/v1/health"
# {"service":"api","status":"ok",...}
curl -fsS "$API/api/v1/health/ready"
bash scripts/periscan.sh status
```

`GET /health` 307s to `/api/v1/health`. OpenAPI: `GET /openapi.json`.

---

## 2. Sign up (unique account)

Open the printed web URL. Toggle to **Sign up**. Use an email that does not
already exist. Password ≥ **12** characters. You become Owner of a new tenant.

```bash
API="${PERISCAN_API_URL:-http://127.0.0.1:3001}"
curl -fsS -c /tmp/periscan.cookies -H 'content-type: application/json' \
  -X POST "$API/api/v1/auth/signup" \
  -d '{"email":"you@example.com","name":"You","password":"choose-a-long-password","tenantName":"Lab"}'
```

Signup is CSRF-exempt and sets `periscan_session` + `periscan_csrf`. Later
POST/PATCH/DELETE must echo the CSRF cookie:

```bash
CSRF=$(grep periscan_csrf /tmp/periscan.cookies | awk '{print $NF}')
auth=(-b /tmp/periscan.cookies -H "x-csrf-token: $CSRF" -H 'content-type: application/json')
curl -fsS "${auth[@]}" "$API/api/v1/me"
```

**Do not** log in as `demo@periscan.local` / `periscan-demo-password`. That
tenant is a labeled fixture after `pnpm seed:demo`. It is not measured proof.
Sample report at `/demo` is labeled sample.

---

## 3. Authorize a local repository path

The control plane verifies a path **it can read**, not github.com.

1. `git clone <your-repo>` on this machine (or use an existing clone), then
   paste the **absolute path**.
2. In the UI: **Authorize scope** → Type **Repository** → paste the path
   (example: `/opt/customer/repo`).
3. Add. Copy the verification token the UI shows.
4. Write it at the repository root:

```bash
# TOKEN is the value shown after Add (verificationToken).
printf 'periscan-verification=%s\n' "$TOKEN" > /opt/customer/repo/.periscan-authorization
```

5. **Verify authorization**. Status must become **Verified**
   (`repository_token_file`). Unverified scopes are inventory, not runnable.

Hosted `https://github.com/org/repo` (or `github.com/org/repo`) **stays
refused**. Add is disabled. Verify / Attest return `400`
`hosted_github_url_not_verifiable`. Paste the clone path instead. Attest is
runner-only for a path the control plane cannot see — it is not a skip for
GitHub URLs.

`devModeManual` is lab-only (`PERISCAN_DEV_MODE`). Do not use it for this path.

API:

```bash
curl -fsS "${auth[@]}" -X POST "$API/api/v1/scopes" \
  -d '{"scopeType":"Repository","value":"/opt/customer/repo","assetClass":"BusinessApplication"}'
# write .periscan-authorization from verificationToken, then:
curl -fsS "${auth[@]}" -X POST "$API/api/v1/scopes/$SCOPE_ID/verify" -d '{}'
```

---

## 4. Run Community validation

First hour on a verified repo is **Gitleaks-class secrets**. That is the
designed proof, not the whole catalog.

UI: **Validate** → **Run Community validation**. Pin Gitleaks when you want
one job (`?moduleIds=gitleaks.repo_secrets`). Copy that says “N engines start
now” is the set that **will queue**, not catalog length. Deferred Prowler
without AWS does not count.

**HTTP 200 is not jobs queued.** Read `jobsQueued` and `mission.status`. Zero
jobs plus a deny rationale is an honest refuse, not a pass. Denied tasks
**never queue**.

```bash
curl -fsS "${auth[@]}" "$API/api/v1/community/validation-suite?scopeId=$SCOPE_ID"
curl -fsS "${auth[@]}" -X POST "$API/api/v1/scopes/$SCOPE_ID/policy-decisions/preview" \
  -d '{
    "executionEnvironment":"ControlPlane",
    "missionType":"ValidationSnapshot",
    "safetyLevel":"PassiveReadOnly",
    "requestedAction":{
      "destructive":false,
      "realDataExfiltration":false,
      "persistence":false,
      "credentialTheft":false,
      "uncontrolledExploitChaining":false,
      "requiresInternalRunner":false,
      "requiresTimeWindow":false
    },
    "target":{"value":"/opt/customer/repo"}
  }'
curl -fsS "${auth[@]}" -X POST "$API/api/v1/community/validation-runs" \
  -d "{\"scopeId\":\"$SCOPE_ID\",\"policyDecisionId\":\"$POLICY_DECISION_ID\",\"moduleIds\":[\"gitleaks.repo_secrets\"]}"
# assert jobsQueued >= 1
```

Do **not** put Nuclei in primary `moduleIds`. Nuclei is a **second mission**
(External PoA) so a PoA kill-switch cannot block the rest.

Current unqualified adapters do not start here; new BAS adapters enter after qualification.

---

## 5. Watch the mission complete

Stay on the mission until **Completed**. Queueing is not a measured result.
An in-flight run is **Watch**, not Measured.

Findings for a Community mission are those whose evidence IDs **intersect that
run**. No evidence → empty list, not the tenant-wide queue, not a clean bill
of health.

Primary UX does **not** show raw secrets. Evidence is redacted
(`redactionStatus=Redacted`). Tool JSON stays backstage.

```bash
curl -fsS "${auth[@]}" "$API/api/v1/missions/$MISSION_ID"
curl -fsS "${auth[@]}" "$API/api/v1/findings?missionId=$MISSION_ID"
curl -fsS "${auth[@]}" "$API/api/v1/evidence"
```

Optional SARIF: `GET /api/v1/findings.sarif?missionId=`. Empty evidence is
dropped. `Fixed` is a SARIF pass only with a measured verification event.

---

## 6. Create remediations — they open **Open**, not Fixed

Open remediations from **that** mission’s findings. Created rows are
`status=Open`, `verificationRequired=true`. Closing a ticket is
`ClosedWithoutEvidence`. There is no “mark Fixed” checkbox.

```bash
curl -fsS "${auth[@]}" -X POST \
  "$API/api/v1/community/validation-runs/$MISSION_ID/remediations"
curl -fsS "${auth[@]}" "$API/api/v1/remediations"
```

---

## 7. Remove the leak. Verify. Fixed only after a verification event

1. Remove the secret from the authorized clone (the file on disk the engine
   reads). Commit if that is how you work; Periscan re-reads the path.
2. Re-run Community on the **same verified scope**, or call verify (it
   re-measures — it does not stamp Fixed from intent).
3. **Fixed** only when the verification event proves the exposure is gone.

UI: remediations → **Verify**. API:

```bash
curl -fsS "${auth[@]}" -X POST "$API/api/v1/remediations/$REMEDIATION_ID/verify" -d '{}'
```

If the leak is still present, status stays Open (or demotes). Do not invent
Fixed from a merge, a Jira close, or a severity change.

Webhook for automation: `remediation.verified`. Prefer webhooks
(`mission.started` / `mission.completed` / `mission.failed`) over busy-poll.
Wait 408 + `Retry-After` means still running (server cap 60s).

---

## 8. TUI

Same API as the web app. Needs a TTY. API must already be up (step 1).

```bash
pnpm tui -- --api http://127.0.0.1:3001
```

Equivalent: `export PERISCAN_API_URL=http://127.0.0.1:3001` then `pnpm tui`.
If `start` remapped the API, pass **that** origin.

| Key | Action                                           |
| --- | ------------------------------------------------ |
| `2` | Auth (sign up / login)                           |
| `3` | Scopes — add + verify                            |
| `4` | Policy preview + Community run                   |
| `g` | Pin `gitleaks.repo_secrets` (first-hour secrets) |
| `p` | Preview policy                                   |
| `r` | Run Community                                    |
| `5` | Missions                                         |
| `6` | Findings (evidence ∩ mission)                    |
| `7` | Open remediations                                |
| `?` | Help                                             |
| `q` | Quit                                             |

Full map: [`TUI.md`](./TUI.md). `pnpm tui -- health` is liveness, not proof.

---

## 9. CloudAccount (AWS)

Paste a **12-digit** AWS account id (`123456789012`). Type infers
**CloudAccount**.

Verify:

- **Connected AWS** account match, or
- **Owner / Admin attest** (`operatorAttestation: true`)

Attest proves you are allowed to name the account. It does **not** start
Prowler. Prowler uses stored Connected AWS integration credentials at
execution time. Secrets are not written onto `validationRun.target`.

Without AWS connected: suite `cloudAwsAvailable=false`, Prowler is deferred,
Run stays disabled or queues **0** cloud jobs. That is honest. Connect AWS
when you want Prowler, then start again.

```bash
curl -fsS "${auth[@]}" -X POST "$API/api/v1/scopes" \
  -d '{"scopeType":"CloudAccount","value":"123456789012","assetClass":"Cloud"}'
# Owner/Admin:
curl -fsS "${auth[@]}" -X POST "$API/api/v1/scopes/$SCOPE_ID/verify" \
  -d '{"operatorAttestation":true}'
```

Domain / subdomain still require DNS TXT (`_periscan.<scope>`). CIDR /
internal net: audited Owner/Admin attest. Silent auto-verify of CIDRs is
refused.

---

## 10. Update

```bash
bash scripts/periscan.sh update
bash scripts/periscan.sh start
```

`update` prints that you must restart with `start`. It does not bounce a
running `lab:dev` for you. `down` first if the old process still holds the
port.

---

## API loop (suite → start → findings → remediations → verify)

Cookie session + CSRF as in step 2, or a tenant API key (`Authorization:
Bearer psk_…`, no CSRF). Example automation:
[`examples/proof-loop.sh`](../examples/proof-loop.sh).

| Job                                               | Method | Path                                                        |
| ------------------------------------------------- | ------ | ----------------------------------------------------------- |
| Suite (what can start on this verified scope)     | `GET`  | `/api/v1/community/validation-suite?scopeId=`               |
| Start (queues work after policy allow)            | `POST` | `/api/v1/community/validation-runs`                         |
| Findings (evidence ∩ this mission)                | `GET`  | `/api/v1/findings?missionId=`                               |
| Open remediations from that mission               | `POST` | `/api/v1/community/validation-runs/:missionId/remediations` |
| Re-measure; **Fixed** only if the event proves it | `POST` | `/api/v1/remediations/:id/verify`                           |

Read `jobsQueued` on start. Reconstruct pack + Nuclei sibling:
`GET /api/v1/community/validation-runs?missionId=`.

---

## Honest stops

| If you see this           | It means                                               | Do not                                            |
| ------------------------- | ------------------------------------------------------ | ------------------------------------------------- |
| Hosted GitHub URL refused | Control plane cannot read github.com as a repo path    | Treat PENDING as “almost verified”                |
| `jobsQueued=0`            | Nothing queued (deny, empty suite, missing AWS/runner) | Call HTTP 200 a run                               |
| Empty findings            | No evidence intersected this mission                   | Call it a clean bill of health                    |
| Remediations **Open**     | Work item exists; exposure not re-proved gone          | Tick Fixed                                        |
| Prowler deferred          | No Connected AWS                                       | Count it as “engines start now”                   |
| `tool_unavailable`        | Binary not installed                                   | Invent a finding                                  |
| `pnpm seed:demo` tenant   | Labeled fixture                                        | Cite it as measured lab proof                     |
| Atomic / Caldera adapters | In development; current content/plan imports           | Claim live execution before adapter qualification |

---

## Related

| Want                                                           | Where                                          |
| -------------------------------------------------------------- | ---------------------------------------------- |
| FAQ                                                            | [`FAQ.md`](./FAQ.md)                           |
| Community offering + pack                                      | [`COMMUNITY.md`](../COMMUNITY.md)              |
| TUI keys                                                       | [`TUI.md`](./TUI.md)                           |
| Engine adapter PR                                              | [`ADAPTER_FIRST_PR.md`](./ADAPTER_FIRST_PR.md) |
| `.periscan.yaml` (intent only; control plane does not load it) | [`PERISCAN_YAML.md`](./PERISCAN_YAML.md)       |
| Vuln report (no public PoC)                                    | [`SECURITY.md`](../SECURITY.md)                |
| Settled axioms                                                 | [`SETTLED.md`](./SETTLED.md)                   |
