## First-hour / Fixed-via-verify

Community first hour is **Gitleaks-class secrets** on an authorized **local clone path** (`jobsQueued=1`) — not the full pack, not a hosted `github.com/org/repo` URL.

**Fixed** only after a measured retest (`verifiedAt` / verification evidence). Opening a remediation or closing a ticket is **not** Fixed.

## What

<!-- One paragraph. Link the GitHub issue. Describe the qualified BAS/AEV or validation behavior. -->

## Why

<!-- User-visible proof, honesty, or adapter certification — not unqualified integrations. -->

## Tests

- [ ] Schema / service / route / module / policy / evidence tests updated for the behavior I touched
- [ ] Named test would fail on the bug (not a transport-only assertion)
- [ ] `pnpm licenses:check` (run `pnpm licenses:write` first if tools, modules, or deps changed)
- [ ] Adapter PRs: `pnpm modules:certify` (or `modules:certify:check`) and `pnpm test:modules` as needed
- [ ] Commits are `Signed-off-by` (DCO-1.1)

Merge still expects `pnpm verify`. A green subset is not GA. Hosted Actions are not a launch gate.

## Safety

- [ ] Verified authorized scope only; no destructive / exfil / credential-theft / persistence logic
- [ ] Denied tasks still never queue
- [ ] **Fixed** still requires a verification event (no ticket-close / UI mark-done shortcuts)
- [ ] BAS adapter/scenario changes include pinned content, typed inputs, policy gates, cleanup, cancellation and lab evidence
- [ ] Did **not** put AGPL / SSPL / BSL / Commons Clause / PolyForm on the default image or Community start
- [ ] GPL/LGPL stays Engine Lab + license accept (not Community start)
- [ ] Runner transport remains outbound HTTPS signed-task polling
- [ ] No raw scanner dump as primary UX; upstream engines attributed by name + SPDX
- [ ] Product-visible data is real, honest-empty, or clearly labeled sample/demo (no fixture theater)
- [ ] First-hour still defaults to Gitleaks-class secrets (`jobsQueued=1`) on a local path when relevant

## SETTLED TELLs (STOP if any are in this diff)

See `docs/SETTLED.md`. Close the PR or strip the change if you did any of:

- Rewrite root `LICENSE` / “we are open source now”
- Unqualified adapter execution or missing customer authorization
- `status = Fixed` without a verification event
- Claim language from severity/risk only
- Unreviewed license or unqualified scenario on the Community start button
- `ReadyForCredentials` on StandardizedCatalog
- Invented customer refs / Production certified without live keys
- `95+` / MQ / Wave progress as a ship gate

## License / provenance (adapters and deps)

- [ ] Third-party `toolIds` keep upstream SPDX (examples: Gitleaks MIT, Trivy Apache-2.0, nmap NPSL)
- [ ] Notices regenerated when inventory changed (`licenses/THIRD_PARTY_NOTICES.md`)
- [ ] Root LICENSE is Apache-2.0; DCO/sign-off contributes under that license. Engines keep their own SPDX (`GOVERNANCE.md`)
