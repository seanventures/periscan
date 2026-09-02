import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";

import type { EvidenceArtifact } from "@periscan/shared";

import type { PeriscanApi } from "../lib/api.js";
import { theme } from "../theme.js";

function redactionColor(status: EvidenceArtifact["redactionStatus"]): string {
  if (status === "Redacted") {
    return theme.ok;
  }
  if (status === "Blocked") {
    return theme.danger;
  }
  return theme.muted;
}

function evidenceIdsForScope(
  runs: Array<{ evidenceIds: string[]; runId: string }>,
  runId?: string
): string[] {
  const scoped = runId ? runs.filter((run) => run.runId === runId) : runs;
  return [...new Set(scoped.flatMap((run) => run.evidenceIds))];
}

export function EvidenceScreen(props: {
  api: PeriscanApi;
  missionId?: string;
  onStatus: (s: string) => void;
  runId?: string;
}) {
  const { api, missionId, onStatus, runId } = props;
  const scoped = Boolean(missionId || runId);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<EvidenceArtifact[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    onStatus("Loading evidence…");
    setError(null);
    setItems(null);

    void (async () => {
      try {
        const [artifacts, runs] = await Promise.all([
          api.listEvidence(),
          missionId ? api.listMissionRuns(missionId) : Promise.resolve(null)
        ]);
        if (cancelled) {
          return;
        }

        let selected = artifacts;
        if (missionId && runs) {
          const allowed = new Set(evidenceIdsForScope(runs, runId));
          selected = artifacts.filter((item) => allowed.has(item.evidenceId));
        } else if (runId) {
          selected = artifacts.filter((item) => item.relatedEntityId === runId);
        }

        setItems(selected);
        onStatus(
          selected.length === 0
            ? "No evidence yet"
            : `${selected.length} artifact${selected.length === 1 ? "" : "s"}`
        );
      } catch (cause) {
        if (cancelled) {
          return;
        }
        const message =
          cause instanceof Error && cause.message
            ? cause.message
            : "Unable to read evidence";
        setError(message);
        setItems([]);
        onStatus(message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [api, missionId, onStatus, runId]);

  const title = [
    "Evidence",
    missionId ? `mission ${missionId}` : null,
    runId ? `run ${runId}` : null
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");

  return (
    <Box flexDirection="column">
      <Text bold>{title}</Text>
      <Text color={theme.muted}>Raw scanner JSON is not shown.</Text>
      {items === null && !error ? (
        <Text color={theme.muted}>Loading evidence…</Text>
      ) : null}
      {error ? <Text color={theme.danger}>{error}</Text> : null}
      {error === null && items?.length === 0 ? (
        <Text color={theme.muted}>
          {scoped
            ? "No evidence for this mission/run."
            : "No evidence artifacts yet."}
        </Text>
      ) : null}
      {error === null && items && items.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <Text color={theme.muted}>
            evidenceId  artifactType  redactionStatus
          </Text>
          {items.map((item) => (
            <Box key={item.evidenceId}>
              <Text>{item.evidenceId}  </Text>
              <Text>{item.artifactType}  </Text>
              <Text color={redactionColor(item.redactionStatus)}>
                {item.redactionStatus}
              </Text>
            </Box>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}
