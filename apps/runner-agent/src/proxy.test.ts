import { Buffer } from "node:buffer";
import { Duplex, PassThrough } from "node:stream";

import { describe, expect, it, vi } from "vitest";

import type { EgressPolicy } from "./egress.js";
import { handleSocks5Connection, type ProxyConnect } from "./proxy.js";

const policy: EgressPolicy = {
  approvedCidrs: [],
  approvedDnsSuffixes: ["corp.internal"],
  approvedHostnames: ["app-01.corp.internal"],
  approvedPorts: [443],
  forbidInternetEgress: true
};

// A client channel: the test writes request bytes to `fromClient` (the handler
// reads them via the duplex's readable) and reads handler replies from
// `toClient` (the duplex's writable). No listener / inbound port — exactly how
// the agent services a logical channel over its outbound connection.
function makeClientChannel() {
  const fromClient = new PassThrough();
  const toClient = new PassThrough();
  const handlerSide = new Duplex({
    read() {
      // data is pushed from fromClient below
    },
    write(chunk, _encoding, callback) {
      toClient.write(chunk);
      callback();
    }
  });
  fromClient.on("data", (chunk: Buffer) => handlerSide.push(chunk));
  fromClient.on("end", () => handlerSide.push(null));
  return { fromClient, handlerSide, toClient };
}

function collect(stream: PassThrough) {
  const chunks: Buffer[] = [];
  stream.on("data", (chunk: Buffer) => chunks.push(chunk));
  return () => Buffer.concat(chunks);
}

function socks5ConnectDomain(host: string, port: number): Buffer {
  const hostBuf = Buffer.from(host, "utf8");
  return Buffer.concat([
    Buffer.from([0x05, 0x01, 0x00]), // greeting: VER, NMETHODS=1, NO-AUTH
    Buffer.from([0x05, 0x01, 0x00, 0x03, hostBuf.length]), // VER CMD=CONNECT RSV ATYP=domain LEN
    hostBuf,
    Buffer.from([(port >> 8) & 0xff, port & 0xff])
  ]);
}

function lastReplyRepByte(buffer: Buffer): number {
  // Each SOCKS reply is 10 bytes (IPv4 BND); REP is the 2nd byte of the last one.
  return buffer[buffer.length - 10 + 1]!;
}

describe("runner-agent SOCKS5 proxy handler", () => {
  it("authorizes and tunnels an in-scope CONNECT both directions", async () => {
    const { fromClient, handlerSide, toClient } = makeClientChannel();
    const upstream = new PassThrough();
    const upstreamReceived = collect(upstream);
    const clientReceived = collect(toClient);
    const connect: ProxyConnect = vi.fn(async () => upstream);

    const promise = handleSocks5Connection(handlerSide, policy, { connect });
    fromClient.write(socks5ConnectDomain("app-01.corp.internal", 443));

    const outcome = await promise;
    expect(outcome).toMatchObject({
      outcome: "piped",
      target: { host: "app-01.corp.internal", port: 443 }
    });
    expect(connect).toHaveBeenCalledWith({
      host: "app-01.corp.internal",
      port: 443
    });

    // client -> upstream
    fromClient.write(Buffer.from("ping"));
    // upstream -> client
    upstream.write(Buffer.from("pong"));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(upstreamReceived().toString()).toContain("ping");
    expect(clientReceived().toString()).toContain("pong");
  });

  it("denies an out-of-scope target and never opens an upstream", async () => {
    const { fromClient, handlerSide, toClient } = makeClientChannel();
    const replyBytes = collect(toClient);
    const connect: ProxyConnect = vi.fn();

    const promise = handleSocks5Connection(handlerSide, policy, { connect });
    fromClient.write(socks5ConnectDomain("attacker.example.com", 443));

    const outcome = await promise;
    expect(outcome.outcome).toBe("denied");
    expect(connect).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(lastReplyRepByte(replyBytes())).toBe(0x02); // not allowed by ruleset
  });

  it("denies an in-scope host on an unapproved port", async () => {
    const { fromClient, handlerSide } = makeClientChannel();
    const connect: ProxyConnect = vi.fn();

    const outcome = await (() => {
      const promise = handleSocks5Connection(handlerSide, policy, { connect });
      fromClient.write(socks5ConnectDomain("app-01.corp.internal", 22));
      return promise;
    })();

    expect(outcome.outcome).toBe("denied");
    expect(connect).not.toHaveBeenCalled();
  });

  it("refuses everything when the kill switch is active", async () => {
    const { fromClient, handlerSide } = makeClientChannel();
    const connect: ProxyConnect = vi.fn();

    const promise = handleSocks5Connection(handlerSide, policy, {
      connect,
      killSwitch: true
    });
    fromClient.write(socks5ConnectDomain("app-01.corp.internal", 443));

    const outcome = await promise;
    expect(outcome).toMatchObject({
      outcome: "denied",
      reason: "kill switch active"
    });
    expect(connect).not.toHaveBeenCalled();
  });

  it("returns refused when the authorized upstream connection fails", async () => {
    const { fromClient, handlerSide } = makeClientChannel();
    const connect: ProxyConnect = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });

    const promise = handleSocks5Connection(handlerSide, policy, { connect });
    fromClient.write(socks5ConnectDomain("app-01.corp.internal", 443));

    const outcome = await promise;
    expect(outcome.outcome).toBe("refused");
  });
});
