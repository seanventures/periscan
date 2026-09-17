# Periscan worker production image.
# Built from the monorepo root context: docker build -f apps/worker/Dockerfile .
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY . .
RUN pnpm install --frozen-lockfile --prod=false \
  && pnpm --filter @periscan/db db:generate

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app /app
USER node
# Worker is outbound to Redis only; it exposes no inbound port.
CMD ["pnpm", "--filter", "@periscan/worker", "exec", "tsx", "src/index.ts"]
