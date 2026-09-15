import { describe, expect, it } from "vitest";

import {
  agentInNetworkInstallHint,
  IN_NETWORK_AGENT_IMAGE,
  installCommand,
  RUNNER_CONTROL_PLANE,
  SUPPORTED_CUSTOMER_RUNNER_IMAGE
} from "./runner-install";

const TOKEN = "reg-token-example-abc";

describe("installCommand (Supported Customer Runner primary)", () => {
  it("emits Docker register against the Go LTS image and registration token env", () => {
    const cmd = installCommand("Docker", TOKEN);

    expect(cmd).toContain(SUPPORTED_CUSTOMER_RUNNER_IMAGE);
    expect(cmd).toContain(`PERISCAN_REGISTRATION_TOKEN=${TOKEN}`);
    expect(cmd).toContain(
      `PERISCAN_CONTROL_PLANE_URL=${RUNNER_CONTROL_PLANE}`
    );
    expect(cmd).toMatch(/\bregister\b/);
    expect(cmd).not.toContain(IN_NETWORK_AGENT_IMAGE);
    expect(cmd).not.toContain("ghcr.io/periscan/runner-agent");
    expect(cmd).not.toContain("PERISCAN_RUNNER_TOKEN=");
  });

  it("honors an explicit control-plane URL override", () => {
    const cmd = installCommand("Docker", TOKEN, {
      controlPlaneUrl: "https://api.periscan.cloud"
    });
    expect(cmd).toContain(
      "PERISCAN_CONTROL_PLANE_URL=https://api.periscan.cloud"
    );
  });

  it("labels systemd and Kubernetes snippets as Supported Customer Runner", () => {
    const systemd = installCommand("SystemdService", TOKEN);
    const k8s = installCommand("Kubernetes", TOKEN);

    expect(systemd).toContain("Supported Customer Runner");
    expect(systemd).toContain(`PERISCAN_REGISTRATION_TOKEN=${TOKEN}`);
    expect(k8s).toContain("Supported Customer Runner");
    expect(k8s).toContain(SUPPORTED_CUSTOMER_RUNNER_IMAGE);
    expect(k8s).toContain(`--from-literal=token=${TOKEN}`);
  });

  it("defaults package to supportedCustomer (not agent)", () => {
    const implicit = installCommand("Docker", TOKEN);
    const explicit = installCommand("Docker", TOKEN, {
      package: "supportedCustomer"
    });
    expect(implicit).toBe(explicit);
    expect(explicit).toContain(SUPPORTED_CUSTOMER_RUNNER_IMAGE);
  });
});

describe("agentInNetworkInstallHint (optional lab path)", () => {
  it("labels Agent (in-network) and never presents it as the LTS package", () => {
    const hint = agentInNetworkInstallHint("Docker");

    expect(hint).toContain("Agent (in-network)");
    expect(hint).toContain(IN_NETWORK_AGENT_IMAGE);
    expect(hint).toContain(SUPPORTED_CUSTOMER_RUNNER_IMAGE);
    expect(hint).toMatch(/optional lab|AgentLocal/i);
    expect(hint).toMatch(/Not the Supported Customer Runner/i);
    // Agent path must not claim the one-time registration token alone is enough
    expect(hint).not.toContain("PERISCAN_REGISTRATION_TOKEN=");
    expect(hint).not.toContain("PERISCAN_RUNNER_TOKEN=");
  });

  it("is returned when installCommand package is agentInNetwork", () => {
    const viaInstall = installCommand("Docker", TOKEN, {
      package: "agentInNetwork"
    });
    const direct = agentInNetworkInstallHint("Docker");
    expect(viaInstall).toBe(direct);
    expect(viaInstall).toContain(IN_NETWORK_AGENT_IMAGE);
    expect(viaInstall).not.toContain(TOKEN);
  });

  it("covers systemd and Kubernetes agent hints with the agent image name", () => {
    expect(agentInNetworkInstallHint("SystemdService")).toContain(
      IN_NETWORK_AGENT_IMAGE
    );
    expect(agentInNetworkInstallHint("Kubernetes")).toContain(
      IN_NETWORK_AGENT_IMAGE
    );
  });
});

describe("GHCR image name alignment", () => {
  it("uses seanheiney GHCR paths claimed by deploy/publish workflows", () => {
    expect(SUPPORTED_CUSTOMER_RUNNER_IMAGE).toBe(
      "ghcr.io/seanheiney/periscan-runner:latest"
    );
    expect(IN_NETWORK_AGENT_IMAGE).toBe(
      "ghcr.io/seanheiney/periscan-runner-agent:latest"
    );
  });
});
