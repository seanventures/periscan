import { createServer } from "node:http";

import {
  A2A_TCK_PINNED_VERSION,
  executeA2ATck
} from "../packages/modules/src/a2a-tck.ts";

async function main() {
  let port = 0;
  const server = createServer((request, response) => {
    if (
      request.method === "GET" &&
      request.url === "/.well-known/agent-card.json"
    ) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          capabilities: { pushNotifications: false, streaming: false },
          defaultInputModes: ["text/plain"],
          defaultOutputModes: ["application/json"],
          description:
            "Controlled local endpoint for Periscan A2A TCK runtime qualification.",
          name: "Periscan A2A qualification target",
          skills: [
            {
              description: "Return a bounded qualification response.",
              id: "qualification-echo",
              name: "Qualification echo",
              tags: ["test"]
            }
          ],
          supportedInterfaces: [
            {
              protocolBinding: "JSONRPC",
              protocolVersion: "1.0",
              url: `http://127.0.0.1:${port}/a2a`
            }
          ],
          version: "1.0.0"
        })
      );
      return;
    }
    if (request.method === "POST" && request.url === "/a2a") {
      let body = "";
      request.on("data", (chunk) => {
        body += String(chunk);
      });
      request.on("end", () => {
        let id: unknown = null;
        try {
          id = (JSON.parse(body) as { id?: unknown }).id ?? null;
        } catch {
          // The controlled target intentionally returns a protocol error.
        }
        response.writeHead(200, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            error: {
              code: -32601,
              message:
                "Controlled qualification target does not implement this method."
            },
            id,
            jsonrpc: "2.0"
          })
        );
      });
      return;
    }
    response.writeHead(404).end();
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("The controlled A2A qualification target did not bind.");
  }
  port = address.port;

  try {
    const proof = await executeA2ATck({
      level: "must",
      sutHost: `http://127.0.0.1:${port}`,
      transports: ["jsonrpc"]
    });
    if (proof.toolVersion !== A2A_TCK_PINNED_VERSION) {
      throw new Error(
        `Expected A2A TCK ${A2A_TCK_PINNED_VERSION}; received ${proof.toolVersion}.`
      );
    }
    if (proof.requirementResults.length === 0) {
      throw new Error("The official A2A TCK produced no requirement results.");
    }
    if (!/^[a-f0-9]{64}$/u.test(proof.reportHash)) {
      throw new Error("The official A2A TCK report was not SHA-256 sealed.");
    }
    console.log(
      JSON.stringify(
        {
          a2aTck: {
            compatible: proof.compatible,
            failedOrUntestedMust: proof.requirementResults.filter(
              (item) => item.level === "MUST" && item.status !== "PASS"
            ).length,
            mustCompatibility: proof.mustCompatibility,
            reportHash: proof.reportHash,
            requirementCount: proof.requirementResults.length,
            toolVersion: proof.toolVersion
          },
          veraison:
            "Qualified by tests/acceptance/agent-trust-interoperability-flow.test.ts against the published challenge-response contract, including 202 polling."
        },
        null,
        2
      )
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
