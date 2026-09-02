import { pino } from "pino";

// Structured JSON logger for the in-network runner agent. Replaces console.* so
// the agent's output is consistent and aggregatable wherever it is deployed.
export const logger = pino({
  base: { service: "runner-agent" },
  level: process.env.LOG_LEVEL || "info"
});
