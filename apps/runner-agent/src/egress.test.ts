import { describe, expect, it } from "vitest";

import {
  egressPolicyFromScopeConstraints,
  evaluateEgress,
  type EgressPolicy
} from "./egress.js";

const policy: EgressPolicy = {
  approvedCidrs: ["10.0.0.0/24"],
  approvedDnsSuffixes: ["corp.internal"],
  approvedHostnames: ["app-01.corp.internal"],
  approvedPorts: [443, 8443],
  forbidInternetEgress: true
};

describe("runner-agent egress authorization", () => {
  it("allows an in-scope hostname on an approved port", () => {
    expect(
      evaluateEgress({ host: "app-01.corp.internal", port: 443 }, policy)
    ).toEqual({ allowed: true });
  });

  it("allows a host matching an approved DNS suffix", () => {
    expect(
      evaluateEgress({ host: "db.corp.internal", port: 8443 }, policy)
    ).toEqual({ allowed: true });
  });

  it("allows an IP target inside an approved CIDR", () => {
    expect(evaluateEgress({ host: "10.0.0.50", port: 443 }, policy)).toEqual({
      allowed: true
    });
  });

  it("denies an IP outside the approved CIDR", () => {
    expect(
      evaluateEgress({ host: "10.0.1.50", port: 443 }, policy)
    ).toMatchObject({ allowed: false });
  });

  it("allows an IPv6 target inside an approved IPv6 CIDR [P03-15]", () => {
    const dualStack: EgressPolicy = {
      ...policy,
      approvedCidrs: ["10.0.0.0/24", "2001:db8:1::/48"]
    };
    expect(
      evaluateEgress({ host: "2001:db8:1::10", port: 443 }, dualStack)
    ).toEqual({ allowed: true });
    expect(
      evaluateEgress({ host: "2001:db8:2::10", port: 443 }, dualStack)
    ).toMatchObject({ allowed: false });
  });

  it("does not match IPv6 addresses against IPv4 CIDRs", () => {
    expect(
      evaluateEgress({ host: "2001:db8::1", port: 443 }, policy)
    ).toMatchObject({ allowed: false });
  });

  it("denies an out-of-scope hostname", () => {
    expect(
      evaluateEgress({ host: "attacker.example.com", port: 443 }, policy)
    ).toMatchObject({ allowed: false });
  });

  it("denies an unapproved port even for an in-scope host", () => {
    expect(
      evaluateEgress({ host: "app-01.corp.internal", port: 22 }, policy)
    ).toMatchObject({
      allowed: false,
      reason: "port 22 is not in authorized scope"
    });
  });

  it("denies everything when the kill switch is active", () => {
    expect(
      evaluateEgress({ host: "app-01.corp.internal", port: 443 }, policy, {
        killSwitch: true
      })
    ).toMatchObject({ allowed: false, reason: "kill switch active" });
  });

  it("is default-deny with empty scope constraints", () => {
    const empty = egressPolicyFromScopeConstraints({});
    expect(empty.forbidInternetEgress).toBe(true);
    expect(
      evaluateEgress({ host: "app-01.corp.internal", port: 443 }, empty)
    ).toMatchObject({ allowed: false });
  });

  it("maps scopeConstraints from a task envelope", () => {
    const mapped = egressPolicyFromScopeConstraints({
      approvedCidrs: ["192.168.0.0/16"],
      approvedHostnames: ["host.internal"],
      approvedPorts: [443],
      forbidInternetEgress: true
    });
    expect(evaluateEgress({ host: "192.168.1.1", port: 443 }, mapped)).toEqual({
      allowed: true
    });
    expect(
      evaluateEgress({ host: "host.internal", port: 80 }, mapped)
    ).toMatchObject({ allowed: false });
  });
});
