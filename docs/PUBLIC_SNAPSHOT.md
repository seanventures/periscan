# Public snapshot

`seanheiney/periscan` (this tree on goldeneye / DataSSD1) **stays private**.

The public GitHub repository is a **new repo** that never contained goldeneye
compose, deploy env templates, Plane/tailnet ops, wartime sales docs, or lab-run
logs. It is **not** a visibility flip of the private product remote.

- Canonical public remote: `https://github.com/seanventures/periscan`
- Earlier staging snapshot: `https://github.com/seanheiney/periscan-community`
- Product [`LICENSE`](../LICENSE) is **Apache-2.0**. Canonical public GitHub: `seanventures/periscan`.
- Community edition is the validation **slice**, not an OSI license change
- See [`PUBLIC_TREE.md`](./PUBLIC_TREE.md) for paths that stay private
- GitHub **Actions** and **private vulnerability reporting** are not used.
  Snapshot workflows may be disabled; security reports go through
  [`SECURITY.md`](../SECURITY.md) (`[SECURITY]` issue, no public PoC).

## GitHub About (public repo settings)

GitHub has **no API** for the social preview image. **Maintainer:** after each
snapshot, if the card is missing or stale, run
[`scripts/github-social-preview-wizard.sh`](../scripts/github-social-preview-wizard.sh)
and upload
[`docs/images/github-social-preview.png`](./images/github-social-preview.png)
(1280×640) at
[Settings → Social preview](https://github.com/seanventures/periscan/settings).
Do not claim OG closed until GraphQL `usesCustomOpenGraphImage` is `true`.

Other About fields are set on `seanventures/periscan` (do not flip
`seanheiney/periscan` public):

| Field | Value |
| --- | --- |
| Homepage | `https://github.com/seanventures/periscan#start` |
| Description | Prove authorized exposures with evidence. Apache-2.0 Community validation slice. Fixed only after a retest. |
| Topics | `security` `appsec` `validation` `evidence` `secrets-scanning` `gitleaks` `apache-2-0` `open-core` |
| Wiki / Projects / Discussions | off (empty tabs look unfinished) |
| Issues | on |
| Private vulnerability reporting | off |
| Secret scanning + push protection | on (free on public) |

## Dependabot lockfile (must include)

Every public orphan snapshot **must include** the current `pnpm-lock.yaml`
plus the workspace pins (`package.json`, `apps/tui/package.json`). GitHub
Dependabot on `seanventures/periscan` reads the lockfile on `main`. Omitting
it, or copying an old one, keeps **GHSA-82fw-gwwq-j7x9** mediums open
(`vitest` ×2 / `@vitest/mocker`) even when this private tree already
resolves **vitest@4.1.11** and **@vitest/mocker@4.1.11**.

Do not retag `v0.12.0`. The next snapshot is what closes public alerts
#1 / #9 / #10. Do not dismiss those as test-only while a patched lockfile
exists to ship. `docs/PUBLIC_TREE.md` must not exclude `pnpm-lock.yaml`.
