# Periscan operator TUI

Ink terminal for the Periscan control plane. **Apache-2.0.** API-first: every
action is an HTTP call to the same public `/api/v1` surface the web app uses.
This package does not rewrite `LICENSE`.

## Run

From the repo root (after `pnpm install`):

```bash
pnpm tui
```

That is `pnpm --filter @periscan/tui start` (`tsx src/index.tsx`).

```bash
# point at a control plane
export PERISCAN_API_URL=http://127.0.0.1:3001
pnpm tui

# same thing as a flag (overrides the env var)
pnpm tui -- --api http://127.0.0.1:3001

# noninteractive liveness (no Ink; JSON on stdout; exit 0/1)
pnpm tui -- health
pnpm tui -- health --api http://127.0.0.1:3001

# noninteractive Community start (denied never queues)
pnpm tui -- run --scope <scopeId> --json
```

Default origin is `http://127.0.0.1:3001` (local API). Trailing slashes are stripped.

Package scripts:

```bash
pnpm --filter @periscan/tui start
pnpm --filter @periscan/tui test
pnpm --filter @periscan/tui typecheck
```

## Login

Interactive: press **2** (`auth`) and sign in with email/password. That is
`POST /api/v1/auth/login`.

The client keeps an in-process cookie jar:

| Cookie / header | Name |
| --- | --- |
| Session (HttpOnly on the API) | `periscan_session` |
| CSRF double-submit cookie | `periscan_csrf` |
| CSRF header on POST/PUT/PATCH/DELETE | `x-csrf-token` |

Login, logout, and other auth bootstrap paths are CSRF-exempt (no cookie yet).
After login, mutating calls send both cookies and echo `periscan_csrf` as
`x-csrf-token`. GET/HEAD do not send the CSRF header.

Cookies stay in process memory. Close the process to drop the session.
There is no API-key mode in this TUI.

Headless scripts can seed the cookie jar from lab-session exports:

```bash
export PERISCAN_API_TOKEN='periscan_session=…'
export PERISCAN_CSRF_TOKEN='…'   # echoed as x-csrf-token on POST/PUT/PATCH/DELETE
pnpm tui -- run --scope <scopeId> --json
```

## Keys

| Key | Screen |
| --- | --- |
| `1` | home |
| `2` | auth (login) |
| `3` | scopes |
| `4` | run (Community validation) |
| `5` | missions |
| `6` | findings |
| `7` | fix (remediations) |
| `8` | engines |
| `9` | health |
| `e` | evidence |
| `?` | help |
| `q` | quit |

Optional `~/.periscan/tui-session.json` remembers `apiUrl` only (mode `0600`).
It never stores passwords, JWTs, or cookies. Session cookies live in memory
for the process.

## Safety

- **Denied never queues.** A `policy_denied` response is terminal. The client
  does not retry the mutation and does not enqueue work.
- Add BAS start paths as qualified adapters become available through the API.
  Render per-scenario readiness and policy results; the TUI cannot grant eligibility.
- Only validate verified, customer-authorized scope. No destructive actions.

Screens are owned by other packages/agents; this captain package owns the CLI
entry, HTTP client (cookies + CSRF), and this README.
