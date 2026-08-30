# Agent B5 — P10-3 dual-runner honesty

**Date:** 2026-07-29  
**Worktree:** B5  
**Mission:** UI + docs honesty for Supported Customer Runner vs Agent (in-network)

## Summary

Closed the dual-runner install contradiction: product pairing UI previously
advertised `ghcr.io/periscan/runner-agent:latest` as the primary Docker install
while `docs/SUPPORTED_CUSTOMER_RUNNER.md` / `RUNNER_ARCHITECTURE.md` declare Go
`apps/runner` (`ghcr.io/seanheiney/periscan-runner`) as the production LTS
package.

## Changes

### UI / pure install snippets

| File | Change |
| ---- | ------ |
| `apps/web/src/lib/runner-install.ts` | **New** pure helpers: image constants, `installCommand()`, `agentInNetworkInstallHint()` |
| `apps/web/src/lib/runner-install.test.ts` | **New** unit tests (8) — primary Go LTS, no wrong GHCR path, agent labeled optional |
| `apps/web/src/components/runner-pairing.tsx` | Primary install = Supported Customer Runner (Go); optional collapsible Agent (in-network) lab path |
| `apps/web/src/components/runners-workbench.tsx` | Shares `SUPPORTED_CUSTOMER_RUNNER_IMAGE` constant |
| `apps/web/src/lib/product-help.ts` | Runners guide step notes Go LTS primary / agent optional |

### Image names (aligned with deploy/publish)

| Role | Image |
| ---- | ----- |
| **Supported Customer Runner (Go LTS)** | `ghcr.io/seanheiney/periscan-runner:latest` (`runner-publish.yml`, `apps/runner/deploy`) |
| **Agent (in-network) — optional lab** | `ghcr.io/seanheiney/periscan-runner-agent:latest` (`images-build.yml`, `apps/runner-agent/deploy`) |

Removed incorrect `ghcr.io/periscan/runner-agent:latest` and invented
`PERISCAN_RUNNER_TOKEN` enrollment from the primary Docker snippet. Primary
Docker now matches Go runner CLI:

```text
docker run --rm \
  -e PERISCAN_CONTROL_PLANE_URL=… \
  -e PERISCAN_REGISTRATION_TOKEN=… \
  ghcr.io/seanheiney/periscan-runner:latest register
```

Agent path is **not** presented as LTS; it does **not** claim the one-time
registration token alone is enough (agent needs issued id/auth/mTLS after
enrollment).

### Docs honesty

| File | Change |
| ---- | ------ |
| `docs/DEPLOY.md` | Topology + build + deploy sections distinguish Go LTS primary vs Agent (in-network) optional |
| `docs/DEPLOY_PIPELINE.md` | Mentions both `images-build.yml` (agent) and `runner-publish.yml` (Go LTS) |
| `apps/runner-agent/deploy/README.md` | No longer prefers agent over Go; labels Agent (in-network) optional |

## Tests run

- `pnpm --filter @periscan/web test -- src/lib/runner-install.test.ts` — **8 passed**
- `pnpm --filter @periscan/web test -- src/lib/product-help.test.ts` — **5 passed**
- `pnpm --filter @periscan/web test -- src/components/runners-workbench.test.tsx` — **11 passed**
- `pnpm exec vitest run tests/modules/ci-workflow.test.ts` — **3 passed**

No live runner execution (mission constraint).

## Non-goals / residual

- Did not collapse or remove `apps/runner-agent` (still valid AgentLocal companion).
- Did not change control-plane runner APIs or Go/TS agent binaries.
- systemd/k8s install script URLs under the control plane (`/install/runner.sh`,
  `/install/runner.yaml`) remain aspirational host install entry points; they
  are labeled as Supported Customer Runner and reference `apps/runner/deploy`.
- Pre-existing web typecheck failures in unrelated tests
  (`executive-overview`, `findings-workbench`, `snapshot-workbench`) not touched.

## Closes

Panel residual **P10-3** (dual runner install path contradicts LTS story).
