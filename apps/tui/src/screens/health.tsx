import { execFile } from "node:child_process";
import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";

import type { PeriscanApi } from "../lib/api.js";
import { theme } from "../theme.js";

function whichGitleaks(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile("which", ["gitleaks"], (error) => {
      resolve(error == null);
    });
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "health failed";
}

export function HealthScreen(props: {
  api: PeriscanApi;
  onStatus: (s: string) => void;
}) {
  const [healthLine, setHealthLine] = useState("checking…");
  const [healthOk, setHealthOk] = useState<boolean | null>(null);
  const [gitleaksLine, setGitleaksLine] = useState("checking…");
  const [gitleaksOnPath, setGitleaksOnPath] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    props.onStatus("Checking API health…");

    void props.api
      .health()
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setHealthLine(payload.status);
        setHealthOk(true);
        props.onStatus(`API health ${payload.status}`);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        const message = errorMessage(error);
        setHealthLine(message);
        setHealthOk(false);
        props.onStatus(`API health failed: ${message}`);
      });

    void whichGitleaks().then((onPath) => {
      if (cancelled) {
        return;
      }
      setGitleaksOnPath(onPath);
      setGitleaksLine(onPath ? "on PATH" : "not on PATH");
    });

    return () => {
      cancelled = true;
    };
  }, [props.api, props.onStatus]);

  const healthColor =
    healthOk === true ? theme.ok : healthOk === false ? theme.danger : theme.muted;
  const gitleaksColor =
    gitleaksOnPath === true
      ? theme.ok
      : gitleaksOnPath === false
        ? theme.warn
        : theme.muted;

  return (
    <Box flexDirection="column">
      <Text bold>Control plane</Text>
      <Text color={theme.muted}>API {props.api.apiUrl}</Text>
      <Text>
        GET /api/v1/health{"  "}
        <Text color={healthColor}>{healthLine}</Text>
      </Text>
      <Text>
        gitleaks{"  "}
        <Text color={gitleaksColor}>{gitleaksLine}</Text>
      </Text>
      <Text color={theme.warn}>
        If the worker is missing mission context, run drain-validation-queue.sh
      </Text>
    </Box>
  );
}
