"use client";

import { useEffect, useState } from "react";

import type { HealthResponse } from "@periscan/shared";

import { browserPeriscanApiClient } from "../lib/periscan-api-client";
import { Badge, Button } from "../ui";

type HealthState =
  | {
      kind: "loading";
    }
  | {
      kind: "error";
      message: string;
    }
  | {
      kind: "ready";
      payload: HealthResponse;
    };

function mapHealthError(error: unknown) {
  return error instanceof Error ? error.message : "Health check failed";
}

export function HealthStatusCard() {
  const [state, setState] = useState<HealthState>({ kind: "loading" });

  async function refreshHealth() {
    setState({ kind: "loading" });

    try {
      const payload = await browserPeriscanApiClient.getHealth();
      setState({ kind: "ready", payload });
    } catch (error: unknown) {
      setState({
        kind: "error",
        message: mapHealthError(error)
      });
    }
  }

  useEffect(() => {
    let active = true;

    void browserPeriscanApiClient
      .getHealth()
      .then((payload) => {
        if (active) {
          setState({ kind: "ready", payload });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            kind: "error",
            message: mapHealthError(error)
          });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const badgeTone =
    state.kind === "ready"
      ? "success"
      : state.kind === "error"
        ? "danger"
        : "warning";

  return (
    <section
      className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5"
      aria-labelledby="api-health-title"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 id="api-health-title" className="text-base font-semibold text-ink">
          API health
        </h2>
        <Badge
          tone={badgeTone}
          role="status"
          aria-label={`API health status: ${
            state.kind === "ready"
              ? "Connected"
              : state.kind === "error"
                ? "Unavailable"
                : "Checking"
          }`}
        >
          {state.kind === "ready"
            ? "Connected"
            : state.kind === "error"
              ? "Unavailable"
              : "Checking"}
        </Badge>
      </div>

      <dl
        aria-label="API health details"
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        <div className="flex flex-col gap-1 rounded-control border border-line bg-surface p-3">
          <dt className="text-xs text-muted">Service</dt>
          <dd className="text-sm text-ink">
            {state.kind === "ready" ? state.payload.service : "api"}
          </dd>
        </div>
        <div className="flex flex-col gap-1 rounded-control border border-line bg-surface p-3">
          <dt className="text-xs text-muted">Status</dt>
          <dd className="text-sm text-ink">
            {state.kind === "ready"
              ? state.payload.status
              : state.kind === "error"
                ? state.message
                : "loading"}
          </dd>
        </div>
        <div className="flex flex-col gap-1 rounded-control border border-line bg-surface p-3">
          <dt className="text-xs text-muted">Timestamp</dt>
          <dd className="text-sm text-ink">
            {state.kind === "ready"
              ? state.payload.timestamp
              : "Awaiting response"}
          </dd>
        </div>
      </dl>
      {state.kind === "error" ? (
        <div
          className="flex flex-wrap items-center gap-3 rounded-control border border-danger/40 bg-danger/10 px-3 py-2 text-sm"
          role="alert"
          aria-live="assertive"
        >
          <p className="text-danger">{state.message}</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void refreshHealth();
            }}
          >
            Retry API health
          </Button>
        </div>
      ) : null}
    </section>
  );
}
