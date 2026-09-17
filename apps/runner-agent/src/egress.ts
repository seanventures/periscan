import { isIP } from "node:net";

// Per-connection egress authorization for the agent. Whether a tool runs locally
// (AgentLocal) or reaches the network through a restricted ServiceViaProxy
// logical channel, every outbound connection the agent makes on the SaaS's behalf
// MUST be inside the authorized scope of the signed task/engagement. The agent is
// default-deny: only targets explicitly allowed by the envelope's scopeConstraints
// are permitted, and the kill switch denies everything.

export interface EgressTarget {
  host: string;
  port: number;
}

export interface EgressPolicy {
  approvedHostnames: string[];
  approvedCidrs: string[];
  approvedDnsSuffixes: string[];
  approvedPorts: number[];
  forbidInternetEgress: boolean;
}

export interface EgressDecision {
  allowed: boolean;
  reason?: string;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function asNumberArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is number => typeof entry === "number")
    : [];
}

// Build an egress policy from a signed task envelope's scopeConstraints. Missing
// constraints yield an empty (deny-all) policy with internet egress forbidden.
export function egressPolicyFromScopeConstraints(
  constraints: Record<string, unknown> | null | undefined
): EgressPolicy {
  const source = constraints ?? {};
  return {
    approvedCidrs: asStringArray(source.approvedCidrs),
    approvedDnsSuffixes: asStringArray(source.approvedDnsSuffixes),
    approvedHostnames: asStringArray(source.approvedHostnames),
    approvedPorts: asNumberArray(source.approvedPorts),
    forbidInternetEgress: source.forbidInternetEgress !== false
  };
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) {
    return null;
  }
  let value = 0;
  for (const part of parts) {
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) {
      return null;
    }
    value = (value << 8) | octet;
  }
  return value >>> 0;
}

function ipv4InCidr(ip: string, cidr: string): boolean {
  const [network, prefixRaw] = cidr.split("/");
  const prefix = Number(prefixRaw);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    return false;
  }
  const ipInt = ipv4ToInt(ip);
  const netInt = ipv4ToInt(network ?? "");
  if (ipInt === null || netInt === null) {
    return false;
  }
  if (prefix === 0) {
    return true;
  }
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  return (ipInt & mask) === (netInt & mask);
}

/** Expand IPv6 textual form to 8 hextets (handles `::` compression). */
function expandIpv6Hextets(ip: string): number[] | null {
  const bare = ip.split("%")[0]?.toLowerCase() ?? "";
  if (!bare.includes(":")) {
    return null;
  }
  const sides = bare.split("::");
  if (sides.length > 2) {
    return null;
  }
  const parseSide = (side: string | undefined): number[] | null => {
    if (!side || side.length === 0) {
      return [];
    }
    const parts = side.split(":");
    const out: number[] = [];
    for (const part of parts) {
      if (!/^[0-9a-f]{1,4}$/u.test(part)) {
        return null;
      }
      out.push(Number.parseInt(part, 16));
    }
    return out;
  };
  if (sides.length === 1) {
    const hextets = parseSide(sides[0]);
    return hextets && hextets.length === 8 ? hextets : null;
  }
  const left = parseSide(sides[0]);
  const right = parseSide(sides[1]);
  if (!left || !right) {
    return null;
  }
  const fill = 8 - left.length - right.length;
  if (fill < 0) {
    return null;
  }
  return [...left, ...Array.from({ length: fill }, () => 0), ...right];
}

function ipv6ToBigInt(ip: string): bigint | null {
  const hextets = expandIpv6Hextets(ip);
  if (!hextets) {
    return null;
  }
  let value = 0n;
  for (const h of hextets) {
    value = (value << 16n) | BigInt(h);
  }
  return value;
}

/** IPv6 CIDR allow path [P03-15]. IPv4 CIDRs never match IPv6 (and vice versa). */
function ipv6InCidr(ip: string, cidr: string): boolean {
  const slash = cidr.lastIndexOf("/");
  if (slash < 0) {
    return false;
  }
  const network = cidr.slice(0, slash);
  const prefix = Number(cidr.slice(slash + 1));
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 128) {
    return false;
  }
  if (!network.includes(":")) {
    return false;
  }
  const ipInt = ipv6ToBigInt(ip);
  const netInt = ipv6ToBigInt(network);
  if (ipInt === null || netInt === null) {
    return false;
  }
  if (prefix === 0) {
    return true;
  }
  const shift = BigInt(128 - prefix);
  const mask = ((1n << BigInt(prefix)) - 1n) << shift;
  return (ipInt & mask) === (netInt & mask);
}

function ipInApprovedCidr(ip: string, cidr: string): boolean {
  const family = isIP(ip);
  if (family === 4 && !cidr.includes(":")) {
    return ipv4InCidr(ip, cidr);
  }
  if (family === 6 && cidr.includes(":")) {
    return ipv6InCidr(ip, cidr);
  }
  return false;
}

function normalizeSuffix(suffix: string): string {
  return suffix.replace(/^\./u, "").toLowerCase();
}

// Default-deny egress evaluation. A target is permitted only when the kill switch
// is off, the port is allowed (when a port allowlist is set), and the host is
// explicitly in scope (exact hostname, DNS suffix, or — for IP targets — an
// approved CIDR).
export function evaluateEgress(
  target: EgressTarget,
  policy: EgressPolicy,
  options: { killSwitch?: boolean } = {}
): EgressDecision {
  if (options.killSwitch) {
    return { allowed: false, reason: "kill switch active" };
  }

  if (
    policy.approvedPorts.length > 0 &&
    !policy.approvedPorts.includes(target.port)
  ) {
    return {
      allowed: false,
      reason: `port ${target.port} is not in authorized scope`
    };
  }

  const host = target.host.toLowerCase();

  if (policy.approvedHostnames.some((entry) => entry.toLowerCase() === host)) {
    return { allowed: true };
  }

  if (
    policy.approvedDnsSuffixes.some((suffix) => {
      const normalized = normalizeSuffix(suffix);
      return host === normalized || host.endsWith(`.${normalized}`);
    })
  ) {
    return { allowed: true };
  }

  if (
    (isIP(host) === 4 || isIP(host) === 6) &&
    policy.approvedCidrs.some((cidr) => ipInApprovedCidr(host, cidr))
  ) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: policy.forbidInternetEgress
      ? "target is not in authorized scope (internet egress forbidden)"
      : "target is not in authorized scope"
  };
}
