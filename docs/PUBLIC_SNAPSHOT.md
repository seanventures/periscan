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

GitHub has **no API** for the social preview image. After each snapshot,
if the card is missing or stale, upload
[`docs/images/github-social-preview.png`](../docs/images/github-social-preview.png)
(1280×640) at
[Settings → Social preview](https://github.com/seanventures/periscan/settings).

Other About fields are set on `seanventures/periscan` (do not flip
`seanheiney/periscan` public):

| Field | Value |
| --- | --- |
| Description | Prove authorized exposures with evidence. Apache-2.0 Community validation slice. Fixed only after a retest. |
| Topics | `security` `ctem` `asv` `appsec` `validation` `evidence` `secrets-scanning` `gitleaks` `apache-2-0` `open-core` |
| Wiki / Projects / Discussions | off (empty tabs look unfinished) |
| Issues | on |
| Private vulnerability reporting | off |
| Secret scanning + push protection | on (free on public) |
