# Public-tree exclude list

Paths that stay in this **private product tree** and must **not** appear in a
public GitHub export or public clone.

This file is **not** a LICENSE flip. Root [`LICENSE`](../LICENSE) stays
Apache-2.0 for published source ([`SETTLED.md`](./SETTLED.md)). **Do not delete**
these files from this private repository. Exclude them from a public tree; keep
them here.

**This private repo stays private forever.** Public snapshots are a **new
repository** that never contained these paths (not a visibility flip of
`seanheiney/periscan`). Canonical public snapshot: `seanventures/periscan`
(Apache-2.0).

Local Community / lab compose is
`infra/docker-compose/docker-compose.yml`. Root `compose.yaml` is not that.

---

## Must not go public

| Path                                              | Why it stays private                                                                    |
| ------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `compose.yaml`                                    | Goldeneye production stack (tailnet registry, Traefik, production hostnames)            |
| `app.env.tmpl`                                    | Goldeneye deploy env template (production URLs, secret variable names, platform wiring) |
| `docs/ops/PLANE.md`                               | Tailnet Plane SoR internals (instance admin, vault pointers, ops wiring)                |
| `docs/qa/HANDOFF.md`                              | Internal live-tenant handoff and analyst backlog                                        |
| `skills/using-plane/`                             | Plane + ops-API skill (tailnet, secret fetch, project ids)                              |
| `docs/DESIGN_PARTNER/WARTIME_SALES_MOTION.md`     | Wartime sales motion                                                                    |
| `docs/DESIGN_PARTNER/WARTIME_SELLER_SCORECARD.md` | Wartime seller scorecard                                                                |
| `docs/qa/lab-runs/`                               | Lab-run JSON and logs                                                                   |

---

## History scrub before public

Deleting or omitting a path from HEAD is not enough. Git history still
contains it.

Committed scan config: [`.gitleaks.toml`](../.gitleaks.toml). It allowlists
labeled module fixtures under `packages/modules/fixtures/` and
`docs/qa/lab-runs/` files whose path contains `fixture`. Unlabeled lab-runs
still scan. It does **not** allowlist `docs/qa/HANDOFF.md`, `compose.yaml`,
or `app.env.tmpl` — AWS keys, private keys, Plane tokens, and goldeneye
operator SSH/IPs there must still flag.

Before any public push:

1. Strip the paths above from **all** history (`git filter-repo` or equivalent).
2. Run `gitleaks detect --log-opts='--all'` (same as
   `gitleaks detect --source . --log-opts='--all'`). Requires a local
   `gitleaks` binary; it is **optional** and not a pnpm dependency.
3. Optional working-tree scan (same binary): `pnpm secrets:scan`
   (`gitleaks detect --source . --no-git`).
4. Re-check this list against the export. If a listed path is present, the
   export is not public-ready.

WS0 preflight: [`OPEN_SOURCE_PROJECT_PLAN.md`](./OPEN_SOURCE_PROJECT_PLAN.md)
§4. A public flip remains a founder + counsel decision, not a coding session.

---

## What this file does not do

- Rewrite `LICENSE` or claim the product is open source
- Authorize a visibility flip
- Delete the listed files from the private tree
- Replace Plane as the system of record
