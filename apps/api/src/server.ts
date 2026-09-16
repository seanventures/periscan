import { buildApp } from "./app.js";
import { registerGracefulShutdown } from "./graceful-shutdown.js";

const port = Number(process.env.PERISCAN_API_PORT ?? 3001);
const host = process.env.PERISCAN_API_HOST ?? "0.0.0.0";

const app = await buildApp({ enableScheduler: true });

// Drain in-flight requests + run onClose hooks on SIGTERM/SIGINT before exit.
registerGracefulShutdown(app);

try {
  await app.listen({ host, port });
  app.log.info(`Periscan API listening on ${host}:${port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
