# Periscan internal runner AGENT image — the in-network execution agent.
# Deployed inside the customer network; it dials OUT to the control plane, runs
# signed tasks against in-network targets, and opens no inbound ports or
# arbitrary remote-access tunnel. Scoped proxy handlers remain bound to signed
# task policy and are not a reverse-SSH-style transport.
#
# Build from the monorepo root:
#   docker build -f apps/runner-agent/Dockerfile -t periscan-runner-agent .
#
# This base carries node + the agent. AgentLocal in-network tool binaries
# (nmap/masscan/recon, then AD/.NET/ruby/Metasploit) are layered in Phases 3-4;
# until then the agent runs the passive built-in network modules.

# Fetch pinned ProjectDiscovery recon binaries (subfinder/httpx/dnsx, MIT).
FROM debian:bookworm-slim AS recon-tools
ARG SUBFINDER_VERSION=2.6.6
ARG HTTPX_VERSION=1.6.9
ARG DNSX_VERSION=1.2.1
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates unzip \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /tools
RUN curl -fsSL -o subfinder.zip "https://github.com/projectdiscovery/subfinder/releases/download/v${SUBFINDER_VERSION}/subfinder_${SUBFINDER_VERSION}_linux_amd64.zip" \
  && unzip -o subfinder.zip subfinder && rm subfinder.zip
RUN curl -fsSL -o httpx.zip "https://github.com/projectdiscovery/httpx/releases/download/v${HTTPX_VERSION}/httpx_${HTTPX_VERSION}_linux_amd64.zip" \
  && unzip -o httpx.zip httpx && rm httpx.zip
RUN curl -fsSL -o dnsx.zip "https://github.com/projectdiscovery/dnsx/releases/download/v${DNSX_VERSION}/dnsx_${DNSX_VERSION}_linux_amd64.zip" \
  && unzip -o dnsx.zip dnsx && rm dnsx.zip
ARG KERBRUTE_VERSION=1.0.3
RUN curl -fsSL -o kerbrute "https://github.com/ropnop/kerbrute/releases/download/v${KERBRUTE_VERSION}/kerbrute_linux_amd64" \
  && chmod +x kerbrute

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
# In-network (AgentLocal) recon tooling. nmap (NPSL) is pinned via apt; further
# AgentLocal tools (masscan/subfinder/httpx, then AD/.NET/ruby/Metasploit) layer
# in later Phase 3/4 increments. PERISCAN_NMAP_RUNTIME=binary so the registry
# resolver uses the bundled binary.
RUN apt-get update \
  && apt-get install -y --no-install-recommends nmap ca-certificates \
     python3 python3-venv python3-pip pipx \
  && rm -rf /var/lib/apt/lists/*
COPY --from=recon-tools /tools/subfinder /tools/httpx /tools/dnsx /tools/kerbrute /usr/local/bin/
# Offensive AD/identity tooling is not in the default runner-agent allowlist.
# NetExec is present only for explicitly approved local opt-in deployments
# (PERISCAN_RUNNER_ALLOWLISTED_MODULES + elevated safety levels). Metasploit
# (exploit.metasploit_check) is heavy (ruby framework) and is provided via its
# official container (metasploitframework/metasploit-framework) resolved at
# runtime, or installed by the operator — NOT baked here (build = operator/CI).
ENV PIPX_HOME=/opt/pipx PIPX_BIN_DIR=/usr/local/bin
RUN pipx install netexec || true
ENV PERISCAN_NMAP_RUNTIME=binary \
  PERISCAN_SUBFINDER_RUNTIME=binary \
  PERISCAN_HTTPX_RUNTIME=binary \
  PERISCAN_DNSX_RUNTIME=binary \
  PERISCAN_NETEXEC_RUNTIME=binary \
  PERISCAN_KERBRUTE_RUNTIME=binary
# Defaults; real values are injected at deploy time (control-plane URL, runner
# identity/keypair from enrollment, task signing public key, allowlist).
ENV PERISCAN_RUNNER_KILL_SWITCH="false"
COPY --from=deps /app /app
USER node
# Outbound-only: the agent dials the control plane; it exposes no inbound port.
CMD ["pnpm", "--filter", "@periscan/runner-agent", "exec", "tsx", "src/index.ts"]
