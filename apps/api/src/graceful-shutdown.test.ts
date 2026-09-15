import { EventEmitter } from "node:events";

import { describe, expect, it, vi } from "vitest";

import {
  registerGracefulShutdown,
  type ShutdownProcess
} from "./graceful-shutdown.js";

function fakeProcess(): ShutdownProcess & {
  emitter: EventEmitter;
  exit: ReturnType<typeof vi.fn>;
} {
  const emitter = new EventEmitter();
  const exit = vi.fn();
  return {
    emitter,
    exit,
    on(event, listener) {
      emitter.on(event, listener as (...args: unknown[]) => void);
      return this;
    }
  };
}

function fakeServer(close: () => Promise<void>) {
  return {
    close: vi.fn(close),
    log: { error: vi.fn(), info: vi.fn() }
  };
}

async function flush() {
  await new Promise((resolve) => setImmediate(resolve));
}

describe("registerGracefulShutdown", () => {
  it("closes the server and exits 0 on SIGTERM", async () => {
    const proc = fakeProcess();
    const server = fakeServer(async () => undefined);

    registerGracefulShutdown(server, { process: proc });
    proc.emitter.emit("SIGTERM");
    await flush();

    expect(server.close).toHaveBeenCalledOnce();
    expect(server.log.info).toHaveBeenCalledWith(
      expect.stringContaining("SIGTERM")
    );
    expect(proc.exit).toHaveBeenCalledWith(0);
  });

  it("exits 1 when close fails", async () => {
    const proc = fakeProcess();
    const server = fakeServer(async () => {
      throw new Error("close failed");
    });

    registerGracefulShutdown(server, { process: proc });
    proc.emitter.emit("SIGINT");
    await flush();

    expect(server.log.error).toHaveBeenCalled();
    expect(proc.exit).toHaveBeenCalledWith(1);
  });

  it("ignores a second signal while already draining", async () => {
    const proc = fakeProcess();
    let resolveClose: () => void = () => undefined;
    const server = fakeServer(
      () =>
        new Promise<void>((resolve) => {
          resolveClose = resolve;
        })
    );

    registerGracefulShutdown(server, { process: proc });
    proc.emitter.emit("SIGTERM");
    proc.emitter.emit("SIGTERM");
    await flush();

    expect(server.close).toHaveBeenCalledOnce();
    resolveClose();
    await flush();
    expect(proc.exit).toHaveBeenCalledOnce();
  });

  it("registers the default signals on the real process shape", () => {
    const proc = fakeProcess();
    const onSpy = vi.spyOn(proc, "on");
    registerGracefulShutdown(
      fakeServer(async () => undefined),
      {
        process: proc
      }
    );
    expect(onSpy).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith("SIGINT", expect.any(Function));
  });
});
