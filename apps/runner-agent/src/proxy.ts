import { Buffer } from "node:buffer";
import { connect as netConnect } from "node:net";
import type { Duplex } from "node:stream";

import { evaluateEgress, type EgressPolicy } from "./egress.js";

// Scoped SOCKS5 CONNECT handler for ServiceViaProxy tools. The agent NEVER opens
// an inbound port: this handler runs over a duplex CHANNEL that in production is
// multiplexed over the agent's OUTBOUND poll connection (the control plane opens
// a logical proxy channel; the agent services it here). Every CONNECT target is
// authorized against the signed envelope's egress policy before any upstream
// socket is opened, and the kill switch refuses everything.
//
// SEAM: the wire multiplexing of these channels over the outbound connection
// needs matching control-plane support; this module is that transport-agnostic
// handler + its enforcement, fully unit-tested over in-memory duplexes.

const SOCKS_VERSION = 0x05;
const METHOD_NO_AUTH = 0x00;
const METHOD_NONE_ACCEPTABLE = 0xff;
const CMD_CONNECT = 0x01;
const ATYP_IPV4 = 0x01;
const ATYP_DOMAIN = 0x03;
const ATYP_IPV6 = 0x04;
const REP_SUCCESS = 0x00;
const REP_GENERAL_FAILURE = 0x01;
const REP_NOT_ALLOWED = 0x02;
const REP_CONN_REFUSED = 0x05;
const REP_CMD_NOT_SUPPORTED = 0x07;

export type ProxyConnect = (target: {
  host: string;
  port: number;
}) => Promise<Duplex>;

export interface Socks5Options {
  killSwitch?: boolean;
  connect?: ProxyConnect;
}

export interface Socks5Outcome {
  outcome: "piped" | "denied" | "rejected" | "refused" | "error";
  target?: { host: string; port: number };
  reason?: string;
}

// Incremental byte reader over a duplex; detaches before piping so the SOCKS
// handshake bytes and the subsequent tunneled payload are not double-consumed.
class ByteReader {
  private buffer = Buffer.alloc(0);
  private wake: (() => void) | null = null;
  private ended = false;
  private errored: Error | null = null;
  private readonly onData = (chunk: Buffer) => {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    this.flush();
  };
  private readonly onEnd = () => {
    this.ended = true;
    this.flush();
  };
  private readonly onError = (error: Error) => {
    this.errored = error;
    this.flush();
  };

  constructor(private readonly stream: Duplex) {
    stream.on("data", this.onData);
    stream.on("end", this.onEnd);
    stream.on("error", this.onError);
  }

  private flush(): void {
    const wake = this.wake;
    this.wake = null;
    wake?.();
  }

  async readN(n: number): Promise<Buffer> {
    while (this.buffer.length < n) {
      if (this.errored) {
        throw this.errored;
      }
      if (this.ended) {
        throw new Error("stream ended before SOCKS5 handshake completed");
      }
      await new Promise<void>((resolve) => {
        this.wake = resolve;
      });
    }
    const out = this.buffer.subarray(0, n);
    this.buffer = this.buffer.subarray(n);
    return out;
  }

  detachAndTakeRemaining(): Buffer {
    this.stream.off("data", this.onData);
    this.stream.off("end", this.onEnd);
    this.stream.off("error", this.onError);
    const out = this.buffer;
    this.buffer = Buffer.alloc(0);
    return out;
  }
}

const defaultConnect: ProxyConnect = (target) =>
  new Promise((resolve, reject) => {
    const socket = netConnect({ host: target.host, port: target.port });
    socket.once("connect", () => resolve(socket));
    socket.once("error", reject);
  });

function reply(rep: number): Buffer {
  // VER, REP, RSV, ATYP=IPv4, BND.ADDR=0.0.0.0, BND.PORT=0
  return Buffer.from([SOCKS_VERSION, rep, 0x00, ATYP_IPV4, 0, 0, 0, 0, 0, 0]);
}

export async function handleSocks5Connection(
  client: Duplex,
  policy: EgressPolicy,
  options: Socks5Options = {}
): Promise<Socks5Outcome> {
  const reader = new ByteReader(client);
  const connect = options.connect ?? defaultConnect;

  // --- Greeting / method negotiation (no-auth only) ---
  const greeting = await reader.readN(2);
  if (greeting[0] !== SOCKS_VERSION) {
    client.end();
    return { outcome: "error", reason: "unsupported SOCKS version" };
  }
  const methods = await reader.readN(greeting[1]!);
  if (!methods.includes(METHOD_NO_AUTH)) {
    client.end(Buffer.from([SOCKS_VERSION, METHOD_NONE_ACCEPTABLE]));
    return { outcome: "rejected", reason: "no acceptable auth method" };
  }
  client.write(Buffer.from([SOCKS_VERSION, METHOD_NO_AUTH]));

  // --- CONNECT request ---
  const requestHead = await reader.readN(4);
  if (requestHead[0] !== SOCKS_VERSION) {
    client.end();
    return { outcome: "error", reason: "bad request version" };
  }
  if (requestHead[1] !== CMD_CONNECT) {
    client.end(reply(REP_CMD_NOT_SUPPORTED));
    return { outcome: "rejected", reason: "only CONNECT is supported" };
  }

  const atyp = requestHead[3];
  let host: string;
  if (atyp === ATYP_IPV4) {
    const addr = await reader.readN(4);
    host = `${addr[0]}.${addr[1]}.${addr[2]}.${addr[3]}`;
  } else if (atyp === ATYP_DOMAIN) {
    const length = (await reader.readN(1))[0]!;
    host = (await reader.readN(length)).toString("utf8");
  } else if (atyp === ATYP_IPV6) {
    const addr = await reader.readN(16);
    const groups: string[] = [];
    for (let index = 0; index < 16; index += 2) {
      groups.push(addr.readUInt16BE(index).toString(16));
    }
    host = groups.join(":");
  } else {
    client.end(reply(REP_GENERAL_FAILURE));
    return { outcome: "error", reason: "unsupported address type" };
  }
  const port = (await reader.readN(2)).readUInt16BE(0);
  const target = { host, port };

  // --- Egress authorization (default-deny, scope + kill switch) ---
  const decision = evaluateEgress(target, policy, {
    killSwitch: options.killSwitch
  });
  if (!decision.allowed) {
    client.end(reply(REP_NOT_ALLOWED));
    return { outcome: "denied", reason: decision.reason, target };
  }

  // --- Open the authorized upstream and tunnel ---
  let upstream: Duplex;
  try {
    upstream = await connect(target);
  } catch (error) {
    client.end(reply(REP_CONN_REFUSED));
    return {
      outcome: "refused",
      reason: error instanceof Error ? error.message : String(error),
      target
    };
  }

  client.write(reply(REP_SUCCESS));
  const leftover = reader.detachAndTakeRemaining();
  if (leftover.length > 0) {
    upstream.write(leftover);
  }
  client.pipe(upstream);
  upstream.pipe(client);

  return { outcome: "piped", target };
}
