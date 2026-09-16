# Periscan web (Next.js) production image.
# Built from the monorepo root context:
#   docker build -f apps/web/Dockerfile -t periscan-web .
#
# next.config.ts does not set output:'standalone', and workspace packages are
# published as TypeScript source (transpilePackages), so the runtime keeps the
# installed workspace + the .next build and serves with `next start`.
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

# Produce the Next.js production build (.next).
FROM deps AS build
ENV NODE_ENV=production
# The control-plane API base URL is resolved at runtime by the Next.js API proxy;
# production deployments must set PERISCAN_API_URL before serving customer traffic.
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @periscan/web build

FROM base AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PERISCAN_WEB_PORT=3000
COPY --from=build /app /app
USER node
EXPOSE 3000
# `next start` serves the prebuilt .next on PERISCAN_WEB_PORT.
CMD ["pnpm", "--filter", "@periscan/web", "start"]
