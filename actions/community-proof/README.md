# Periscan Community proof (GitHub Action)

Thin composite Action: start a Community **Validation Snapshot** against a
verified scope, poll mission findings, and comment a proof card on a pull
request.

This is **not** a LICENSE flip. Root [`LICENSE`](../../LICENSE) stays
proprietary. Community edition is the open-core **validation slice**
(`packages/shared/src/community-edition.ts`), not a public OSS relicensing.

The Action does **not** run scanners on the GitHub-hosted runner. It calls
your Periscan API. Default pack is the **repository Community lane** the API
selects for a verified `Repository` scope (ControlPlane permissive SPDX:
Gitleaks, Trivy, OSV, Grype, …). Runner-lane engines (nmap, Syft, …) start
only if that tenant already enrolled a Periscan runner. Nuclei stays a
second mission and may skip.

## Do not say

Refuse language (never in this Action, comments, or copy that wraps it):

| Do not say         | Say instead                                    |
| ------------------ | ---------------------------------------------- |
| full BAS           | AEV / CTEM proof layer on authorized scope     |
| automated pentest  | measured exposure validation with evidence     |
| certified          | last authorized Community measurement          |
| we are open source | Community edition / open-core validation slice |

Also never: live Atomic / Caldera / SharpHound / sqlmap / Metasploit, “Fixed”
without a verification event, or “exploitable” inferred from severity.

Contract: `CLAIM_LANGUAGE_CATALOG` in `packages/shared/src/claim-deny-list.ts`.

## Inputs

| Name                    | Required | Description                                                               |
| ----------------------- | -------- | ------------------------------------------------------------------------- |
| `api_url`               | yes      | Periscan origin (`https://periscan.example.com`) or origin plus `/api/v1` |
| `api_token`             | yes      | Tenant API key (`Authorization: Bearer`). Needs `mission:run` or `write`  |
| `scope_id`              | yes      | Verified scope UUID (repository Community lane is the intended default)   |
| `github_token`          | no       | Defaults to `github.token`. Needs `pull-requests: write` to comment       |
| `pull_request_number`   | no       | Defaults to `github.event.pull_request.number`                            |
| `poll_timeout_seconds`  | no       | Default `480`                                                             |
| `poll_interval_seconds` | no       | Default `10`                                                              |
| `upload_sarif`          | no       | Default `false`. Optional GitHub Code Scanning upload after a queued run. |

## What it does

1. `GET /api/v1/scopes/:scope_id` and `GET /api/v1/community/validation-suite?scopeId=`
2. `POST /api/v1/scopes/:scope_id/policy-decisions/preview` (safe requested action; ControlPlane unless the start set needs InternalRunner)
3. `POST /api/v1/community/validation-runs` with `{ policyDecisionId, scopeId }` — **no** offensive module IDs, **no** copyleft opt-in
4. If HTTP **200** and `jobsQueued` is **0**: comment the deny honestly and **exit 0**. Denied never queued. Do **not** upload SARIF.
5. Else poll `GET /api/v1/missions/:id` then `GET /api/v1/findings?missionId=`
6. Comment markdown: engine list, finding count, evidence IDs, policy decision, “denied never queued”
7. If `upload_sarif` is true and the start queued work: `GET /api/v1/findings.sarif?missionId=` → `periscan.sarif` → `github/codeql-action/upload-sarif@v3` with `category: periscan-community`

HTTP 200 on start is not “jobs queued”. Read `jobsQueued` and `mission.status`.

The SARIF log is a Community measurement of evidence-backed findings. It is **not a certification** and **not a pentest** report. Empty results after a queued run are an honest empty log, not a deny disguised as pass. `Fixed` is a SARIF pass only after a measured verification event.

## Permissions

```yaml
permissions:
  contents: read
  pull-requests: write
  issues: write
```

When `upload_sarif` is true, also grant `security-events: write` (and `actions: read` on private repositories):

```yaml
permissions:
  contents: read
  pull-requests: write
  issues: write
  security-events: write
  actions: read
```

## Example

```yaml
- uses: seanheiney/periscan/actions/community-proof@main
  with:
    api_url: ${{ vars.PERISCAN_API_URL }}
    api_token: ${{ secrets.PERISCAN_API_TOKEN }}
    scope_id: ${{ vars.PERISCAN_SCOPE_ID }}
    # upload_sarif: true   # needs security-events: write
```

A `workflow_dispatch`-only wiring example lives at
[`.github/workflows/community-proof-example.yml`](../../.github/workflows/community-proof-example.yml).
It is **not** the release gate. Do not add this Action to `.github/workflows/ci.yml`.

## Safety floor

- Verified, customer-authorized scope only
- No destructive tests, exfil, credential theft, or persistence
- Denied tasks **never** queue
- No Atomic / Caldera / SharpHound / sqlmap / Metasploit
- GPL/LGPL stays Engine Lab + license accept (not this Action’s default start)
