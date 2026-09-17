# Phase 3 — LocalStack / kind (optional)

**Status:** scaffold only (2026-08-03)  
**Parent design:** [`docs/LAB_DESIGN_CONTINUOUS_LOOP.md`](../../docs/LAB_DESIGN_CONTINUOUS_LOOP.md) §Phase 3  
**Score rule:** enabling compose does **not** lift analyst rows. Score only after a module actually targets LocalStack/kind with measured evidence.

## Why optional

Rows that mention cloud misconfig / K8s posture (roughly matrix 9–10 class) need disposable targets. Phases 1–2 already prove multi-hop, canary, FullyMeasured, and dual runners on the physical lab. Cloud simulation is additive.

## Scaffold

| Path | Role |
|------|------|
| `docker-compose.cloud.yml` | LocalStack (S3/IAM/STS) under profile `cloud` |
| `kind/kind-config.yaml` | kind cluster shape |
| `kind/smoke-namespace.yaml` | empty namespace + deny-ingress policy |

## Bring-up (when you need it)

```bash
# LocalStack (requires lab_core network from main lab compose)
pnpm lab:up
cd infra/lab
docker compose -f docker-compose.yml -f docker-compose.cloud.yml --profile cloud up -d localstack
curl -fsS http://127.0.0.1:4566/_localstack/health

# kind (host tool — not compose)
kind create cluster --name periscan-lab --config kind/kind-config.yaml
kubectl apply -f kind/smoke-namespace.yaml
kubectl get ns periscan-lab
```

## Module targeting rules

1. Point modules at `http://127.0.0.1:4566` (or in-network LocalStack DNS) only under `PERISCAN_LAB_MODE=1`.
2. Never mark a connector **Production** certified from LocalStack alone.
3. Never claim customer cloud inventory from lab fixtures.
4. Tear down kind when done: `kind delete cluster --name periscan-lab`.

## Done criteria (future)

- [ ] One cloud-oriented module runs against LocalStack and writes lab-run JSON  
- [ ] One K8s-oriented module (or runner-in-cluster smoke) against kind  
- [ ] README + package scripts (`lab:cloud-up`) if used more than twice  
- [ ] Optional CI job Linux-only, manual dispatch  

## Non-goals

- Full AWS parity  
- Managed Kubernetes product surface  
- Marketplace / billing paths  
