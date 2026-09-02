# Local Community / lab helpers. Goldeneye production compose is compose.yaml
# at the repo root — do not `docker compose up` there from a GitHub clone.
COMPOSE := docker compose -f infra/docker-compose/docker-compose.yml
PGPORT ?= 5434

.PHONY: deps migrate first-run lab-proof

deps:
	PERISCAN_POSTGRES_PUBLISHED_PORT=$(PGPORT) $(COMPOSE) up -d --wait

migrate: deps
	DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:$(PGPORT)/periscan \
		pnpm --filter @periscan/db db:generate
	DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:$(PGPORT)/periscan \
		pnpm --filter @periscan/db db:migrate:deploy

# Host toolchain path: deps + migrate. Then `pnpm lab:dev` (includes worker).
first-run: migrate
	@echo "Deps are up. In this shell:"
	@echo "  export DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:$(PGPORT)/periscan"
	@echo "  export PERISCAN_POSTGRES_PUBLISHED_PORT=$(PGPORT)"
	@echo "  pnpm lab:dev"
	@echo "Other terminal: pnpm lab:up && pnpm lab:smoke && PERISCAN_LAB_STRICT=1 pnpm lab:demo-up"
	@echo "Do not use root compose.yaml. Do not treat pnpm seed:demo as measured proof."

lab-proof:
	pnpm lab:up && pnpm lab:smoke
	@echo "Start pnpm lab:dev in another terminal, then: PERISCAN_LAB_STRICT=1 pnpm lab:demo-up"
