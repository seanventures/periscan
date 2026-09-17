import { loadRunnerAgentConfig } from "./config.js";
import { logger } from "./logger.js";
import { pollOnce } from "./poll.js";

// Bounded nonce memory so a fully-valid signed task can only execute once.
function createNonceTracker(limit = 10_000) {
  const seen = new Set<string>();
  return {
    hasSeenNonce: (nonce: string) => seen.has(nonce),
    recordNonce: (nonce: string) => {
      if (seen.size >= limit) {
        seen.clear();
      }
      seen.add(nonce);
    }
  };
}

function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(1, seconds) * 1000);
  });
}

async function main(): Promise<void> {
  const config = loadRunnerAgentConfig();

  if (config.killSwitch) {
    logger.error("runner-agent kill switch is enabled; exiting");
    process.exitCode = 2;
    return;
  }

  const nonces = createNonceTracker();
  logger.info(
    {
      controlPlaneUrl: config.controlPlaneUrl,
      op: "runner-agent.start",
      runnerId: config.runnerId
    },
    "runner-agent start"
  );

  // Outbound-only long-poll loop. Each cycle dials out, executes any signed
  // tasks, and submits results; never opens an inbound port.
  for (;;) {
    let nextPollAfterSeconds = config.pollIntervalSeconds;
    try {
      const outcome = await pollOnce(config, {
        hasSeenNonce: nonces.hasSeenNonce,
        recordNonce: nonces.recordNonce
      });
      nextPollAfterSeconds = outcome.nextPollAfterSeconds;
      if (outcome.skippedForKillSwitch) {
        logger.warn("control plane reports kill switch active; idling");
      }
    } catch (error) {
      logger.error({ err: error }, "runner-agent poll cycle failed");
    }
    await sleep(nextPollAfterSeconds);
  }
}

void main();
