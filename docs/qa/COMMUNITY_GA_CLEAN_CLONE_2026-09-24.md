# Community clean-clone technical proof — 2026-09-24

This is an operator-run local qualification of the published Community 1.0.0 tree at `b3294943d6e109f41cc90125bd9476b62f18e6a2`. It establishes that the designed proof loop completed on one disposable, locally owned repository. It does not measure an uncoached first hour, customer product-market fit, BAS breadth, production capacity, or this Periscan repository's own security posture.

## Environment and method

- Fresh `git clone https://github.com/seanventures/periscan.git` at the SHA above; no demo tenant or `pnpm seed:demo`.
- macOS arm64, Node 24.21.0, pnpm 9.15.0, Docker 29.2.1, Compose 5.1.4, local PostgreSQL 16, Redis 7, MinIO, and host Gitleaks 8.30.1.
- `bash scripts/periscan.sh install` completed its dependency install and all 171 migrations; `bash scripts/periscan.sh start` launched API, worker, and web. An explicit disposable Compose project kept this test separate from an existing Periscan checkout. The API and web remapped to free local ports.
- A new tenant authorized a temporary local Git repository by writing its scope token to `.periscan-authorization`. The repository contained one randomly generated **synthetic** Gitleaks-detectable marker. No real credential or customer target was used.
- The operator used the published API flow in `docs/USING.md`: signup, repository scope creation and file verification, policy preview, pinned `gitleaks.repo_secrets` Community start, mission and finding reads, mission remediation creation, removal of the synthetic marker, and `POST /remediations/:id/verify`.

## Observed receipt

| Gate                    | Observation                                                                                                                                                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope                   | `Verified` via repository token file; scope `db0ad493-033b-4726-bea5-f848e9e19a19`                                                                                                                                               |
| Policy                  | `Allowed`, approval `NotRequired`, decision `9f54250b-d5f7-424b-a582-688cd68a28a5`                                                                                                                                               |
| Queue                   | Community start returned `jobsQueued=1` for Gitleaks; mission `2beabcd8-5352-4c5e-beaf-373a49822389` completed                                                                                                                   |
| Finding and remediation | The mission-scoped findings response contained one measured finding. Creating remediations returned `createdCount=1` and remediation `8a5af776-1ce7-4c08-915b-0468ea2b1fd0`.                                                     |
| Retest                  | After removing the marker, a separate FixVerification mission completed with `no_secret_exposure_observed`. Verification event `6e9cf843-651c-4929-a465-9de707786082` recorded `measuredRevalidation=true` and `newState=Fixed`. |
| Audit                   | The disposable tenant persisted two `policy_decision` events, one `mission_created`, one `mission_started`, one `remediation_created`, and one `verification_run` event.                                                         |
| Evidence handling       | The tenant stored three `RawModuleOutput` artifacts with `Redacted` status, plus two normalized artifacts (one `Redacted`, one `NotRequired`). No raw marker is reproduced here.                                                 |

The final automated API sequence took about 1.3 seconds on this warm local machine. Install took about 35 seconds and app startup about 10 seconds in this run; those are workstation observations, not supported setup-time promises. Human time to understand and use the UI was not measured.

## Refusal and isolation checks

A second new tenant left the same local path **Pending** and did not write that tenant's authorization token. Policy preview returned `RequiresVerifiedScope`; Community start returned HTTP 400 `scope_not_verified`; its mission list remained empty. That tenant's request for the first tenant's mission returned HTTP 404. These are one-path local checks, not a complete tenant-isolation assessment.

## Clone isolation defect found and repaired in this candidate

The published installer pinned Compose to `periscan-deps`. Code inspection showed that a second checkout would select the first checkout's Compose project and could reuse its data volumes. The install scripts now keep an existing checkout's project name stable while selecting and persisting a checkout-specific project when another checkout owns `periscan-deps`. On this host, the second checkout selected `periscan-deps-1524208623` and published its own Postgres on port 5436; the original checkout's Postgres remained running throughout install and `down`. An explicit `COMPOSE_PROJECT_NAME` still takes precedence. This is a local two-checkout safety check, not a multi-host upgrade certification.

## Docker scanner coverage defect found and repaired in this candidate

The Docker Gitleaks fallback in the published tree read only root-level files and discarded filenames. An opt-in test against the pinned Gitleaks Docker image reproduced a false clean result for a synthetic marker in `src/config.txt`. The candidate now streams a bounded working-tree archive into an isolated container, scans nested files, and maps findings back to their repository paths. The same Docker test now observes one redacted finding, retains the nested file path, and returns clean only after the marker is removed. Oversized or failed scans return an inconclusive module result.

A second local API and worker run forced `PERISCAN_GITLEAKS_RUNTIME=docker` against a new synthetic marker in `src/config.txt`. Scope `2994a0ea-7f7c-4109-8d25-9d3378bf2871` became `Verified`, policy decision `0198b402-270f-4759-81e5-fddf1fabdfed` allowed the start, and `jobsQueued=1`. Mission `c77f22ce-6e15-41be-bbc9-f839ae59a6a0` completed with one measured finding; remediation creation succeeded. After removing the marker, a separate FixVerification run completed with `no_secret_exposure_observed`, and event `a5de0c72-b429-4c3e-ae72-b7c9dd22026e` recorded `measuredRevalidation=true` and `newState=Fixed`. This is an operator-run macOS Docker proof, not an uncoached or Linux qualification.

## Later fresh-install and S3 qualification

A second remote clone at public commit `e9b99b7` had no saved `.periscan/community.env`. `bash install.sh` selected the new `docker-compose.community-deps.yml` stack, pulled its pinned SeaweedFS image, created the `periscan-evidence` bucket, applied the database migrations, and reached healthy API and web on isolated ports. The stored project was `periscan-ga-fresh`; after the restart correction at `d357713`, a new-shell dry run retained that project and API/web ports `3061/3060`. A foreground start then returned API health and the web login page. After `down` stopped that clone's dependencies, the corrected `start` resumed Postgres, Redis, and SeaweedFS, confirmed the evidence bucket, and returned ready API and web. An earlier clone with saved legacy state continued to select its MinIO compose file and volume. No existing evidence objects were migrated.

On that fresh stack, an operator authorized a disposable local repository and ran one synthetic Gitleaks validation. Scope `7a4a5650-6387-493c-b7cf-d40e9e1b9b22` became `Verified`; policy was `Allowed`; `jobsQueued=1`; mission `8ba6a814-b400-4bc4-9219-6bd8df1a6455` completed with one mission-scoped finding. One remediation was created. After removing the synthetic marker, a separate verification event set remediation `f3b0dd46-0ea1-4c37-9c75-38bd360936d2` to `Fixed` with `measuredRevalidation=true` and three evidence IDs. The finding response omitted the marker. Evidence rows had S3-backed storage URIs; `HeadObject` against the new SeaweedFS instance confirmed a stored evidence object. No real credential or customer data was used.

The full local `pnpm verify` passed on Node 24.21.0 against a separate disposable SeaweedFS/Postgres/Redis stack before the two small installer state amendments. It included the Docker nested-scan regression, build, migrations, 80 browser tests, 37 security tests, and 263 acceptance tests with two skips; the dependency audit found no advisories. Focused installer and storage-selection tests passed after the amendments. Hosted checks on the final public head remain a separate gate.

## Release gate on this public candidate

The full local `pnpm verify` passed at `f913c97` under Node 24.21.0 against the disposable PostgreSQL/Redis project. It included lint, typecheck, unit tests, the required Docker nested-scan regression, clean build, runner and local lab checks, toolchain and license checks, migration checks, 80 browser tests, 37 security tests, and 263 passing acceptance tests with two skips. The dependency audit found zero high-severity advisories. The internal analyst scorecard is excluded from the public tree, so that one gate explicitly reported **skipped, no analyst score qualified**. Hosted CI and a second platform run are separate evidence.

## Remaining release evidence

- Have an uncoached participant use the current public tree and record time, task success, errors, and comprehension from clone through retest.
- Repeat clone, Docker runtime, and release qualification on supported Linux.
- Run hosted CI and a second platform qualification. This local receipt does not qualify production SLOs, broad BAS/AEV adapters, external customer value, or analyst standing.
- This Periscan repository itself has not had an authorized Community scan with evidence. Its static badge remains **not measured**.
