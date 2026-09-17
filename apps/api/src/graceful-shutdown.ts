// Graceful shutdown for the API process. On SIGTERM/SIGINT we close the Fastify
// instance, which stops accepting new connections, waits for in-flight requests
// to finish, and runs onClose hooks (e.g. the continuous-validation scheduler
// timer) before the process exits. Without this, a deploy/rollout would drop
// in-flight requests on a hard kill. The worker and runner-agent already do this;
// this brings the API to parity.

export interface ClosableServer {
  close(): Promise<void>;
  log: {
    info(message: string): void;
    error(payload: unknown): void;
  };
}

export interface ShutdownProcess {
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  exit(code?: number): void;
}

export interface GracefulShutdownOptions {
  signals?: string[];
  process?: ShutdownProcess;
}

export function registerGracefulShutdown(
  server: ClosableServer,
  options: GracefulShutdownOptions = {}
): void {
  const signals = options.signals ?? ["SIGTERM", "SIGINT"];
  const proc = options.process ?? process;
  let shuttingDown = false;

  async function shutdown(signal: string): Promise<void> {
    // A second signal during drain must not start a second close().
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    server.log.info(`Received ${signal}; draining API before exit.`);
    try {
      await server.close();
      proc.exit(0);
    } catch (error) {
      server.log.error(error);
      proc.exit(1);
    }
  }

  for (const signal of signals) {
    proc.on(signal, () => {
      void shutdown(signal);
    });
  }
}
