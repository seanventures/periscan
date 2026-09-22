import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";

import {
  CommunityValidationSuiteResponseSchema,
  ENGINE_LAB_THEATER_TOOL_IDS,
  type CommunityValidationSuiteEntry,
  type CommunityValidationSuiteResponse
} from "@periscan/shared";

import type { PeriscanApi } from "../lib/api.js";
import { theme } from "../theme.js";

const THEATER_TITLES: Record<string, string> = {
  "atomic-red-team": "Atomic Red Team",
  "invoke-atomicredteam": "Invoke-AtomicRedTeam",
  caldera: "Caldera",
  metasploit: "Metasploit",
  netexec: "NetExec",
  promptfoo: "Promptfoo",
  sharphound: "SharpHound",
  sqlmap: "sqlmap"
};

type CommunitySuiteClient = {
  communitySuite?: (
    scopeId?: string
  ) => Promise<CommunityValidationSuiteResponse>;
  getCommunityValidationSuite?: (input?: {
    includeExternalPoa?: boolean;
    scopeId?: string;
  }) => Promise<CommunityValidationSuiteResponse>;
  requestJson?: (path: string, init?: RequestInit) => Promise<unknown>;
};

async function fetchCommunitySuite(
  api: PeriscanApi
): Promise<CommunityValidationSuiteResponse> {
  const client = api as PeriscanApi & CommunitySuiteClient;
  if (typeof client.communitySuite === "function") {
    return client.communitySuite();
  }
  if (typeof client.getCommunityValidationSuite === "function") {
    return client.getCommunityValidationSuite();
  }
  if (typeof client.requestJson === "function") {
    const payload = await client.requestJson(
      "/api/v1/community/validation-suite"
    );
    return CommunityValidationSuiteResponseSchema.parse(payload);
  }
  throw new Error("Community suite is not available on this API client.");
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : "Unable to read Community suite";
}

function communityEngineStatus(
  moduleId: string,
  startableModuleIds: readonly string[]
): "startable" | "tool_unavailable" {
  return startableModuleIds.includes(moduleId)
    ? "startable"
    : "tool_unavailable";
}

function engineLabel(entry: CommunityValidationSuiteEntry): string {
  return entry.toolId ?? entry.title;
}

function theaterTitle(toolId: string): string {
  return THEATER_TITLES[toolId] ?? toolId;
}

export function EnginesScreen(props: {
  api: PeriscanApi;
  onStatus: (s: string) => void;
}) {
  const [suite, setSuite] = useState<CommunityValidationSuiteResponse | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    props.onStatus("Loading Community suite…");

    void fetchCommunitySuite(props.api).then(
      (next) => {
        if (cancelled) {
          return;
        }
        setSuite(next);
        setError(null);
        props.onStatus("Community suite");
      },
      (reason: unknown) => {
        if (cancelled) {
          return;
        }
        const message = errorMessage(reason);
        setError(message);
        props.onStatus(message);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [props.api, props.onStatus]);

  if (error) {
    return (
      <Box flexDirection="column">
        <Text bold>Engines</Text>
        <Text color={theme.danger}>{error}</Text>
      </Box>
    );
  }

  if (!suite) {
    return (
      <Box flexDirection="column">
        <Text bold>Engines</Text>
        <Text color={theme.muted}>Loading Community suite…</Text>
      </Box>
    );
  }

  const licensed = new Set(suite.copyleftOptIn.licensedToolIds);

  return (
    <Box flexDirection="column">
      <Text bold>Engines</Text>
      <Text color={theme.muted}>GET /api/v1/community/validation-suite</Text>
      <Text color={theme.muted}>{suite.licenseNote}</Text>

      <Box marginTop={1} flexDirection="column">
        <Text bold color={theme.accent}>
          Community suite
        </Text>
        {suite.modules.map((entry, index) => {
          const status = communityEngineStatus(
            entry.moduleId,
            suite.startableModuleIds
          );
          return (
            <Text key={`${entry.moduleId}:${index}`}>
              {engineLabel(entry)}
              {"  "}
              <Text color={theme.muted}>{entry.toolLicense}</Text>
              {"  "}
              <Text color={status === "startable" ? theme.ok : theme.warn}>
                {status}
              </Text>
              {entry.executionMode === "ExternalPoA" ? "  second mission" : ""}
            </Text>
          );
        })}
        <Text color={theme.warn}>
          Missing binaries are tool_unavailable — not invented findings.
        </Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold color={theme.warn}>
          Copyleft opt-in
        </Text>
        <Text color={theme.muted}>{suite.copyleftOptIn.hint}</Text>
        {suite.copyleftOptIn.modules.map((entry, index) => {
          const accepted = entry.toolId ? licensed.has(entry.toolId) : false;
          return (
            <Text key={`${entry.moduleId}:${index}`}>
              {engineLabel(entry)}
              {"  "}
              <Text color={theme.muted}>{entry.toolLicense}</Text>
              {"  "}
              {accepted ? "opt-in accepted" : "needs opt-in"}
            </Text>
          );
        })}
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold color={theme.muted}>
          Qualification pending · not runnable
        </Text>
        {ENGINE_LAB_THEATER_TOOL_IDS.map((toolId) => (
          <Text key={toolId}>
            {theaterTitle(toolId)}
            {"  "}
            <Text color={theme.muted}>adapter qualification required</Text>
          </Text>
        ))}
      </Box>
    </Box>
  );
}
