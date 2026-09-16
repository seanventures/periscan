import { pino } from "pino";

// Structured JSON logger for the worker process. Replaces ad-hoc console.* so
// log lines carry a consistent shape (service, level, time) and are aggregatable.
// Correlation across api->worker is available via the job's runId/missionId/jobId
// which are logged with each job event.
export const logger = pino({
  base: { service: "worker" },
  level: process.env.LOG_LEVEL || "info"
});
