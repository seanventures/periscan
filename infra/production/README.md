# Periscan Production Deployment Reference

This directory documents the reference production topology for the Periscan control plane. It is a contract for operators; the SaaS runtime expects managed Postgres, Redis, and S3-compatible evidence storage rather than the local Compose stack in `infra/docker-compose/`.

## Topology

```text
            +-------------------+
  clients ->|  Periscan API     |--> Postgres (managed, HA, PITR)
  UI / SDK  |  (Fastify)        |--> Redis (managed, persistence)
            +-------------------+--> S3-compatible evidence store (encrypted)
                     |
                     v  (BullMQ over Redis)
            +-------------------+
            |  Periscan Worker  |--> Postgres / evidence store
            +-------------------+

  customer network:
            +-------------------+
            |  Internal Runner  |-- outbound HTTPS + mTLS --> Periscan API
            +-------------------+
```

The API and worker run as separate processes so they can scale independently. The API is stateless (sessions are JWT cookies, or API keys), so it can run behind a load balancer with multiple replicas.

### Honesty: what this repo ships vs enterprise topology

| Layer | In-repo / reference | Not claimed here |
| ----- | ------------------- | ---------------- |
| Compose (`docker-compose.prod.yml`) | **Single-replica** API + worker for a reference box | Multi-AZ cluster, autoscaling, multi-region active/active |
| Managed Postgres / Redis | **Assumed** HA + PITR from the cloud provider you choose | Periscan-operated fleet HA SLOs or commercially proven multi-tenant scale numbers |
| Runners | Customer-hosted outbound agents with mTLS | Global runner mesh with automatic failover between customer sites |
| Terraform | Provider scaffold / versions pin | Full enterprise landing-zone IaC for every CSP |

Use this README as an **operator contract**, not as proof that a multi-region enterprise topology is already productized. Fleet scale and HA remain honesty-documented until design-partner load evidence lands (P10-5 / P10-6).

## Required configuration

See [.env.production.example](.env.production.example). The API refuses to start in production if `PERISCAN_JWT_SECRET` is left at the development default. Cookies are issued with `Secure` automatically when `PERISCAN_DEPLOYMENT_ENVIRONMENT=production`.

**Runner mTLS (required in production):** set `PERISCAN_RUNNER_REQUIRE_MTLS=true` (compose defaults to `true`). When `NODE_ENV=production`, the API also requires runner mTLS unless the flag is explicitly `false`. Place the API behind a TLS terminator that verifies the runner client certificate and forwards the verified SHA-256 fingerprint via `x-periscan-runner-client-cert-sha256` or `x-forwarded-client-cert-sha256`.

## Deploy steps

1. Provision managed Postgres, Redis, and an encrypted S3-compatible bucket.
2. Copy `.env.production.example` to `.env.production` and fill in values.
3. Run migrations: `pnpm --filter @periscan/db db:migrate:deploy`.
4. Start services: `docker compose -f infra/production/docker-compose.prod.yml --env-file infra/production/.env.production up -d --build`.
5. Confirm readiness: `curl -fsS https://<api-host>/api/v1/health/ready` returns `200` with all checks `ok`.
6. As a tenant admin, confirm `GET /api/v1/system/deployment-status` reports no missing required configuration.

## Health and observability endpoints

| Endpoint                               | Purpose                                                     | Auth          |
| -------------------------------------- | ----------------------------------------------------------- | ------------- |
| `GET /api/v1/health`                   | Liveness                                                    | Public        |
| `GET /api/v1/health/ready`             | Readiness (DB, queue, evidence store); `503` when not ready | Public        |
| `GET /api/v1/metrics`                  | JSON process metrics                                        | Public        |
| `GET /api/v1/metrics/prometheus`       | Prometheus text metrics                                     | Public        |
| `GET /api/v1/jobs`                     | Queue job status incl. failed jobs                          | Tenant member |
| `GET /api/v1/system/deployment-status` | Production config readiness                                 | Tenant admin  |

## Scaling and reliability

- Run multiple API replicas behind a load balancer; the API is stateless.
- Scale workers horizontally; `PERISCAN_WORKER_CONCURRENCY` controls per-process concurrency.
- Validation jobs retry with exponential backoff (`PERISCAN_QUEUE_MAX_ATTEMPTS`, `PERISCAN_QUEUE_BACKOFF_MS`); failed jobs remain visible via `GET /api/v1/jobs?status=Failed`.
- Configure database backups, restore drills, object-store retention, log aggregation, alert routing, and an incident contact. These are surfaced (configured vs missing) through `GET /api/v1/system/deployment-status`.
