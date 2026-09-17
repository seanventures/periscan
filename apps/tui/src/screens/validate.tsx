import React, { useEffect, useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import {
  communityFirstHourStartModuleIds,
  communityPolicyPreviewRequest,
  type SafetyLevel
} from "@periscan/shared";

import { theme } from "../theme.js";

export const HTTP_200_NOT_QUEUED =
  "HTTP 200 is not jobs queued — read jobsQueued and mission.status.";
export const NUCLEI_SECOND_MISSION = "Nuclei is a second mission";
export const DENIED_NEVER_QUEUES = "Denied never queues";

export type ValidateScope = {
  scopeId: string;
  scopeType: string;
  value: string;
  verificationStatus: string;
};

export type ValidateSuite = {
  cloudAwsAvailable?: boolean;
  runnerAvailable?: boolean;
  startableModuleIds: string[];
  valueLine?: string;
};

export type ValidatePolicy = {
  approvalState: string;
  outcome: string;
  policyDecisionId: string;
  rationale: string;
  scopeId: string;
};

export type ValidateStart = {
  jobsQueued: number;
  mission: { missionId: string; status: string };
  moduleIds: string[];
  nucleiMissionId: string | null;
  nucleiSkipReason: string | null;
};

export type ValidatePolicyPreviewInput = {
  executionEnvironment: "ControlPlane" | "ExternalPoA" | "InternalRunner";
  missionType: string;
  requestedAction: {
    credentialTheft: boolean;
    destructive: boolean;
    persistence: boolean;
    realDataExfiltration: boolean;
    requiresInternalRunner?: boolean;
    requiresTimeWindow?: boolean;
    uncontrolledExploitChaining: boolean;
  };
  safetyLevel: SafetyLevel;
  scopeId: string;
  target: Record<string, unknown>;
};

export const GITLEAKS_REPO_SECRETS = "gitleaks.repo_secrets";

export type ValidateApi = {
  communitySuite: (scopeId: string) => Promise<ValidateSuite>;
  listScopes: () => Promise<ValidateScope[]>;
  previewPolicy: (input: ValidatePolicyPreviewInput) => Promise<ValidatePolicy>;
  startCommunity: (input: {
    moduleIds?: string[];
    policyDecisionId: string;
    scopeId: string;
  }) => Promise<ValidateStart>;
};

export function isVerifiedScope(scope: ValidateScope): boolean {
  return scope.verificationStatus === "Verified";
}

export function policyAllowsCommunityRun(
  policy: ValidatePolicy | null
): boolean {
  if (!policy) {
    return false;
  }
  return (
    policy.outcome === "Allowed" ||
    (policy.outcome === "RequiresApproval" &&
      policy.approvalState === "Approved")
  );
}

function nucleiLine(start: ValidateStart | null): string {
  if (start?.nucleiMissionId) {
    return `${NUCLEI_SECOND_MISSION} ${start.nucleiMissionId}`;
  }
  if (start?.nucleiSkipReason) {
    return `${NUCLEI_SECOND_MISSION} — ${start.nucleiSkipReason}`;
  }
  return `${NUCLEI_SECOND_MISSION} — not in startableModuleIds`;
}

export function ValidateScreen(props: {
  api: ValidateApi;
  onStatus: (s: string) => void;
}) {
  const { api, onStatus } = props;
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scopes, setScopes] = useState<ValidateScope[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [suite, setSuite] = useState<ValidateSuite | null>(null);
  const [policy, setPolicy] = useState<ValidatePolicy | null>(null);
  const [started, setStarted] = useState<ValidateStart | null>(null);
  const [busy, setBusy] = useState<"preview" | "start" | null>(null);
  const [pinnedGitleaks, setPinnedGitleaks] = useState(false);

  const verified = useMemo(() => scopes.filter(isVerifiedScope), [scopes]);
  const selected = verified[selectedIndex] ?? null;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void api
      .listScopes()
      .then((items) => {
        if (cancelled) {
          return;
        }
        setScopes(items);
        setSelectedIndex(0);
      })
      .catch((caught: unknown) => {
        if (cancelled) {
          return;
        }
        setError(
          caught instanceof Error ? caught.message : "Unable to list scopes"
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  useEffect(() => {
    if (!selected) {
      setSuite(null);
      setPolicy(null);
      setStarted(null);
      return;
    }
    let cancelled = false;
    setSuite(null);
    setPolicy(null);
    setStarted(null);
    setPinnedGitleaks(false);
    setError(null);
    void api
      .communitySuite(selected.scopeId)
      .then((next) => {
        if (!cancelled) {
          setSuite(next);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to read Community suite"
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [api, selected]);

  useEffect(() => {
    if (loading) {
      onStatus("loading verified scopes");
      return;
    }
    if (!selected) {
      onStatus("verify a scope before Community can start");
      return;
    }
    onStatus(
      "j/k pick verified scope · p preview policy · r run Community · g pin gitleaks.repo_secrets"
    );
  }, [loading, onStatus, selected]);

  async function preview() {
    if (!selected || !suite || busy) {
      return;
    }
    const request = communityPolicyPreviewRequest({
      cloudAwsAvailable: suite.cloudAwsAvailable,
      runnerAvailable: suite.runnerAvailable,
      scopeType: selected.scopeType
    });
    setBusy("preview");
    setError(null);
    setStarted(null);
    try {
      const decision = await api.previewPolicy({
        executionEnvironment: request.executionEnvironment,
        missionType: "ValidationSnapshot",
        requestedAction: request.requestedAction,
        safetyLevel: request.safetyLevel,
        scopeId: selected.scopeId,
        target: { value: selected.value }
      });
      setPolicy(decision);
      onStatus(
        decision.outcome === "Denied"
          ? `policy Denied — ${DENIED_NEVER_QUEUES}`
          : `policy ${decision.outcome}`
      );
    } catch (caught) {
      setPolicy(null);
      setError(
        caught instanceof Error ? caught.message : "Policy preview failed"
      );
    } finally {
      setBusy(null);
    }
  }

  async function start(pack: "first-hour" | "full" = "first-hour") {
    if (!selected || !suite || busy) {
      return;
    }
    if (!policy || policy.scopeId !== selected.scopeId) {
      setError("Preview policy first");
      return;
    }
    if (policy.outcome === "Denied") {
      setError(DENIED_NEVER_QUEUES);
      onStatus(`policy Denied — ${DENIED_NEVER_QUEUES}`);
      return;
    }
    if (!policyAllowsCommunityRun(policy)) {
      setError(`${policy.outcome} does not queue Community work`);
      return;
    }
    if (suite.startableModuleIds.length === 0) {
      setError("No engines can start yet");
      return;
    }
    const firstHour = communityFirstHourStartModuleIds(suite.startableModuleIds);
    let moduleIds: string[] | undefined;
    if (pack === "full") {
      moduleIds = [...suite.startableModuleIds];
    } else if (
      pinnedGitleaks &&
      suite.startableModuleIds.includes(GITLEAKS_REPO_SECRETS)
    ) {
      moduleIds = [GITLEAKS_REPO_SECRETS];
    } else if (firstHour.length > 0) {
      moduleIds = firstHour;
    }
    setBusy("start");
    setError(null);
    try {
      const result = await api.startCommunity({
        policyDecisionId: policy.policyDecisionId,
        scopeId: selected.scopeId,
        ...(moduleIds ? { moduleIds } : {})
      });
      setStarted(result);
      onStatus(
        result.jobsQueued === 0
          ? `jobsQueued 0 · ${result.mission.status} · ${HTTP_200_NOT_QUEUED}`
          : `jobsQueued ${result.jobsQueued} · ${result.mission.status}`
      );
    } catch (caught) {
      setStarted(null);
      setError(
        caught instanceof Error
          ? caught.message
          : "Community validation did not start"
      );
    } finally {
      setBusy(null);
    }
  }

  useInput((input, key) => {
    if (busy) {
      return;
    }
    if ((key.upArrow || input === "k") && verified.length > 0) {
      setSelectedIndex((index) => Math.max(0, index - 1));
      return;
    }
    if ((key.downArrow || input === "j") && verified.length > 0) {
      setSelectedIndex((index) => Math.min(verified.length - 1, index + 1));
      return;
    }
    if (input === "p") {
      void preview();
      return;
    }
    if (input === "g") {
      if (suite?.startableModuleIds.includes(GITLEAKS_REPO_SECRETS)) {
        setPinnedGitleaks((current) => !current);
      }
      return;
    }
    if (input === "f") {
      void start("full");
      return;
    }
    if (input === "r") {
      void start();
    }
  });

  const policyDenied = policy?.outcome === "Denied";
  const startDenied =
    started != null &&
    (started.jobsQueued === 0 || started.mission.status === "DeniedByPolicy");

  return (
    <Box flexDirection="column">
      <Text bold color={theme.accent}>
        VALIDATE
      </Text>
      <Text color={theme.muted}>
        Community pack · verified scope → policy → start
      </Text>
      <Text color={theme.muted}>
        Verified scopes only — pending and rejected never start.
      </Text>

      {loading ? (
        <Text color={theme.muted}>Loading verified scopes…</Text>
      ) : null}
      {error ? <Text color={theme.danger}>{error}</Text> : null}

      {!loading && verified.length === 0 ? (
        <Text color={theme.warn}>
          No verified scope. Authorize and verify a scope before Community can
          start.
        </Text>
      ) : null}

      {verified.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>verified scopes</Text>
          {verified.map((scope, index) => (
            <Text
              key={scope.scopeId}
              color={index === selectedIndex ? theme.ink : theme.muted}
            >
              {index === selectedIndex ? ">" : " "} {scope.value}{" "}
              {scope.scopeType}
            </Text>
          ))}
        </Box>
      ) : null}

      {selected && suite ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>startableModuleIds {suite.startableModuleIds.length}</Text>
          {suite.startableModuleIds.length === 0 ? (
            <Text color={theme.warn}>No engines can start yet</Text>
          ) : (
            suite.startableModuleIds.map((moduleId) => (
              <Text key={moduleId} color={theme.ink}>
                {"  "}
                {moduleId}
              </Text>
            ))
          )}
          <Text color={theme.muted}>{nucleiLine(null)}</Text>
          {suite.startableModuleIds.includes(GITLEAKS_REPO_SECRETS) ? (
            pinnedGitleaks ? (
              <Text color={theme.ok}>pinned {GITLEAKS_REPO_SECRETS}</Text>
            ) : (
              <Text color={theme.muted}>
                first-hour {GITLEAKS_REPO_SECRETS} · f full Community pack
              </Text>
            )
          ) : null}
        </Box>
      ) : null}

      {policy ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color={policyDenied ? theme.danger : theme.ok}>
            policy {policy.outcome}
          </Text>
          {policyDenied ? (
            <Text color={theme.danger}>{DENIED_NEVER_QUEUES}</Text>
          ) : (
            <Text color={theme.muted}>{policy.rationale}</Text>
          )}
        </Box>
      ) : selected && suite ? (
        <Text color={theme.muted}>p preview policy before run</Text>
      ) : null}

      {started ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color={startDenied ? theme.warn : theme.ok}>
            QUEUE TAPE
          </Text>
          <Text color={startDenied ? theme.warn : theme.ink}>
            jobsQueued {started.jobsQueued}
          </Text>
          <Text color={theme.muted}>{HTTP_200_NOT_QUEUED}</Text>
          <Text color={startDenied ? theme.danger : theme.ink}>
            mission {started.mission.status} {started.mission.missionId}
            {started.jobsQueued === 0 ? " never queued" : ""}
          </Text>
          <Text color={theme.muted}>{nucleiLine(started)}</Text>
        </Box>
      ) : null}

      <Text color={theme.muted}>
        j/k pick · p preview policy · r run Community · g pin gitleaks · f full pack
      </Text>
    </Box>
  );
}
