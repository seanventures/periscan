# Periscan SaaS scan-executor image — the worker + the SERVER-SIDE OSS toolkit
# (ServiceDirect / ServiceViaProxy tools). This is what actually runs gitleaks,
# nuclei, trivy, osv-scanner, prowler, promptfoo and pyrit against cloud-reachable
# or proxied targets. In-network (AgentLocal) tools live in the runner-agent image.
#
# Default final stage is `runtime`: permissive-license engines only (MIT/Apache).
# GPL-family tools marked RequiresLegalReview (testssl.sh, sqlmap, nikto, whatweb,
# ScoutSuite) are NOT redistributed in the default image.
#
# Engine Lab / controlled lab opt-in (does convey GPL tools — not for production
# SaaS redistribution):
#   docker build --target runtime-legal-review \
#     -f infra/docker/scan-executor.Dockerfile -t periscan-scan-executor:legal-review .
# Or with compose profile `legal-review-tools` (see docker-compose.scan-executor.yml).
#
# Build from the monorepo root (default — no GPL redistribution):
#   docker build -f infra/docker/scan-executor.Dockerfile -t periscan-scan-executor .
# Verify the bundled toolkit (inside the image):
#   docker run --rm periscan-scan-executor bash infra/docker/scan-executor-smoke.sh
#
# Tool versions are pinned to packages/modules/src/toolchain.ts `defaultVersion`.
# Keep these ARG defaults in sync with the registry (the smoke test cross-checks
# `pnpm tools:check`).

# ---- Stage 1: fetch pinned static tool binaries (amd64) -------------------------
FROM debian:bookworm-slim AS tools
ARG TARGETARCH=amd64
ARG GITLEAKS_VERSION=8.30.0
ARG NUCLEI_VERSION=3.8.0
ARG TRIVY_VERSION=0.70.0
ARG OSV_SCANNER_VERSION=2.3.0
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates tar unzip \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /tools
# gitleaks (MIT) — tarball ships the `gitleaks` binary.
RUN curl -fsSL "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz" \
  | tar -xz gitleaks && chmod +x gitleaks
# nuclei (MIT) — zip ships the `nuclei` binary.
RUN curl -fsSL -o nuclei.zip "https://github.com/projectdiscovery/nuclei/releases/download/v${NUCLEI_VERSION}/nuclei_${NUCLEI_VERSION}_linux_amd64.zip" \
  && unzip -o nuclei.zip nuclei && rm nuclei.zip && chmod +x nuclei
# trivy (Apache-2.0)
RUN curl -fsSL "https://github.com/aquasecurity/trivy/releases/download/v${TRIVY_VERSION}/trivy_${TRIVY_VERSION}_Linux-64bit.tar.gz" \
  | tar -xz trivy && chmod +x trivy
# osv-scanner (Apache-2.0) — single static binary asset.
RUN curl -fsSL -o osv-scanner "https://github.com/google/osv-scanner/releases/download/v${OSV_SCANNER_VERSION}/osv-scanner_linux_amd64" \
  && chmod +x osv-scanner

# ---- Stage 2: node deps (mirror apps/worker/Dockerfile) -------------------------
FROM node:22-bookworm-slim AS deps
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY . .
RUN pnpm install --frozen-lockfile --prod=false \
  && pnpm --filter @periscan/db db:generate

# ---- Stage 3: default runtime (worker + permissive server-side toolkit) --------
FROM node:22-bookworm-slim AS runtime
ARG PROWLER_VERSION=5.28.1
ARG PYRIT_VERSION=0.13.0
ARG PROMPTFOO_VERSION=0.121.6
ENV NODE_ENV=production
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:/opt/periscan-venv/bin:$PATH"
# Smoke tests and operators use this to confirm the default image posture.
ENV PERISCAN_INCLUDE_LEGAL_REVIEW_TOOLS=0
RUN corepack enable

# System runtimes the Python/git-backed tools need, plus permissive ServiceViaProxy
# web tooling (ffuf is MIT). ZAP ships via its official container
# (ghcr.io/zaproxy/zaproxy) resolved at runtime.
# GPL-family tools (testssl.sh, sqlmap, nikto, whatweb, ScoutSuite) stay out of
# this stage — see `runtime-legal-review` and docs/DEPLOY.md.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     ca-certificates git python3 python3-venv python3-pip pipx \
     ffuf \
  && rm -rf /var/lib/apt/lists/*

# Python tools: prowler (pipx, isolated) + pyrit (shared venv on PATH so
# resolveOpenSourceToolRuntime finds `pip`/`python` for the `pip` runtime).
ENV PIPX_HOME=/opt/pipx PIPX_BIN_DIR=/usr/local/bin
RUN pipx install "prowler==${PROWLER_VERSION}" \
  && python3 -m venv /opt/periscan-venv \
  && /opt/periscan-venv/bin/pip install --no-cache-dir "pyrit==${PYRIT_VERSION}"

# Node tool: promptfoo installed globally so npx resolves it offline.
RUN npm install -g "promptfoo@${PROMPTFOO_VERSION}"

# Pinned static binaries from stage 1.
COPY --from=tools /tools/gitleaks /tools/nuclei /tools/trivy /tools/osv-scanner /usr/local/bin/

WORKDIR /app
COPY --from=deps /app /app

# Wire the registry runtime resolver to the bundled binaries. gitleaks is
# binary-first and osv-scanner is binary-only (no env needed); nuclei/trivy/prowler
# default to docker-first, so force `binary` to use the in-image binaries.
ENV PERISCAN_NUCLEI_RUNTIME=binary \
  PERISCAN_TRIVY_RUNTIME=binary \
  PERISCAN_PROWLER_RUNTIME=binary \
  PERISCAN_PROWLER_BINARY=/usr/local/bin/prowler \
  PERISCAN_OSS_TOOL_HOME=/app/.periscan/oss

USER node
# Worker is outbound to Redis only; it exposes no inbound port.
CMD ["pnpm", "--filter", "@periscan/worker", "exec", "tsx", "src/index.ts"]

# ---- Optional stage: Engine Lab / legal-review GPL toolkit ---------------------
# Intentionally conveys GPL-2.0/GPL-3.0 tools for controlled lab or future Engine
# Lab accept→install paths. Do NOT use this stage for production SaaS images or
# GHCR `latest`/`v*` tags. See docs/DEPLOY.md and
# docs/EXPORT_CONTROL_AND_AUTHORIZED_USE.md.
FROM runtime AS runtime-legal-review
USER root
ENV PERISCAN_INCLUDE_LEGAL_REVIEW_TOOLS=1
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     testssl.sh sqlmap nikto whatweb \
  && rm -rf /var/lib/apt/lists/* \
  && pipx install scoutsuite
# ScoutSuite (cloud.scoutsuite_posture) resolves to its `scout` entrypoint.
ENV PERISCAN_SCOUTSUITE_RUNTIME=binary
USER node
