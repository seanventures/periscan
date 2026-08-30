# Supported Customer Runner (enterprise packaging decision)

**Status:** decision recorded 2026-07-29  
**Ticket:** P10-2 / #425  
**Real-first:** one supported production package; no dual-SKU theater

## Decision (option B)

**Go `apps/runner` is the Supported Customer Runner (production LTS).**

| Role | Path | Customer posture |
| ---- | ---- | ---------------- |
| **Supported Customer Runner** | `apps/runner` (Go) | Production LTS: register, mTLS, signed poll, reachability/DNS/TLS/HTTP modules, deploy guides, `pnpm test:runner` |
| **AgentLocal companion** | `apps/runner-agent` (TypeScript) | Staged capability for measured `periscan.*` / safe recon modules on the **same** control-plane contract — not a second enterprise SKU or separate “enterprise package” |

This is **not** two equal enterprise runners. Operators deploy **one** customer-facing binary/image lineage:

- Image / tag family: `periscan-runner` (see `apps/runner/Dockerfile`, `runner:docker:build`, GHCR publish workflow)
- Deploy guide: `apps/runner/deploy/README.md` (compose, k8s, systemd)
- Smoke path in verify surface: `pnpm test:runner` (and deploy validation `pnpm test:runner:deploy`)

The TypeScript runner-agent remains in-repo for AgentLocal module execution. It is **not** marketed as a parallel “Supported Customer Runner,” not given a second commercial package key, and not required for baseline private-runner Enterprise capability strings.

## Why not collapse to agent-only (option A) yet

- Go runner is the documented outbound HTTPS / mTLS / signed-task LTS path in `RUNNER_ARCHITECTURE.md` and `docs/RUNNER_SPEC.md`.
- Customer deploy artifacts (compose, k8s, systemd, non-root image) already center on Go.
- AgentLocal modules need the Node runtime/toolchain; forcing every enterprise air-gapped site onto that surface would expand, not shrink, packaging risk.

Capabilities that only exist on runner-agent stay on the shared control plane (`POST …/tasks/measured`, `…/tasks/discover`) and are staged as **module capabilities**, not a second runner product.

## Packaging honesty

- **One** primary image: `periscan-runner` (Go).
- **One** primary deploy guide: `apps/runner/deploy/`.
- **One** primary smoke: `pnpm test:runner`.
- Billing/package catalog may mention private runner support on Enterprise-class SKUs; it must not imply two distinct runner products or payment-ready runner SKUs while `paymentProcessorStatus` remains `NotConfigured`.
- Do not invent a unified multi-arch “hybrid mega-image” that silently ships both runtimes without this decision doc.

## Operator guidance

1. Deploy Go runner with `apps/runner/deploy` for customer private networks.
2. Enable AgentLocal / measured module dispatch only when the site has approved the runner-agent runtime and the modules’ safety ceiling.
3. Keep kill switch, scope enforcement, and signed tasks identical at the API boundary for both implementations.

## Related

- `RUNNER_ARCHITECTURE.md`
- `docs/RUNNER_SPEC.md`
- `apps/runner/README.md`
- `apps/runner-agent/` (companion, not dual enterprise package)
