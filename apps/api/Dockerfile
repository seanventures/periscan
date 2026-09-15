# Periscan API production image.
# Built from the monorepo root context: docker build -f apps/api/Dockerfile .
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# Install dependencies with a cached layer keyed on lockfile + workspace manifests.
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY . .
RUN pnpm install --frozen-lockfile --prod=false \
  && pnpm --filter @periscan/db db:generate

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app /app
USER node
EXPOSE 3001
# Workspace packages are published as TypeScript source, so the runtime uses tsx.
CMD ["pnpm", "--filter", "@periscan/api", "exec", "tsx", "src/server.ts"]
