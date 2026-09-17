/**
 * GitHub PR proof-card markdown.
 *
 * Distinct from scanner-dump comments: policy receipt, engines that were
 * actually allowed to queue, evidence-backed findings, mission link.
 * Denied work is never presented as queued. Fixed is withheld unless a
 * verification flag is true. Empty findings stay empty — not theater.
 */

export type GithubProofCommentFinding = {
  title: string;
  evidenceCount: number;
  validationState: string;
  /** True only when a measured verification event backs a Fixed claim. */
  verified?: boolean;
};

export type GithubProofCommentInput = {
  policyVerdict: string;
  jobsQueued: number;
  engines: readonly string[];
  findings: readonly GithubProofCommentFinding[];
  missionUrl: string;
};

const PROOF_CARD_MARKER = "<!-- periscan-proof-card -->";

export function renderGithubProofComment(
  input: GithubProofCommentInput
): string {
  const denied = isDeniedVerdict(input.policyVerdict);
  const enginesCell = denied
    ? "none"
    : formatEngineList(input.engines);
  const jobsCell = denied ? "never queued" : String(input.jobsQueued);
  const policyCell = denied ? "Denied" : escapeMarkdownCell(input.policyVerdict);

  const lines = [
    PROOF_CARD_MARKER,
    "> **Periscan proof card**",
    "> AEV / CTEM proof layer on authorized scope.",
    "",
    "| Gate | Receipt |",
    "| --- | --- |",
    `| Policy | **${policyCell}** |`,
    `| Jobs | ${jobsCell} |`,
    `| Engines | ${enginesCell} |`,
    ""
  ];

  if (denied) {
    lines.push("Denied tasks are never queued.", "");
  }

  lines.push("**Findings**", "", renderFindings(input.findings), "");
  lines.push(`[Open mission](${input.missionUrl})`, "");

  return lines.join("\n");
}

function isDeniedVerdict(verdict: string): boolean {
  return verdict === "Denied" || verdict === "DeniedByPolicy";
}

function formatEngineList(engines: readonly string[]): string {
  if (engines.length === 0) {
    return "none";
  }
  return engines
    .map((engine) => `\`${escapeMarkdownCell(engine)}\``)
    .join(", ");
}

function renderFindings(findings: readonly GithubProofCommentFinding[]): string {
  if (findings.length === 0) {
    return "empty list, not theater";
  }

  return findings
    .map((finding) => {
      const receipts =
        finding.evidenceCount === 1
          ? "1 evidence receipt"
          : `${finding.evidenceCount} evidence receipts`;
      return `- **${escapeMarkdownCell(finding.title)}** — ${receipts} · ${findingStateLabel(finding)}`;
    })
    .join("\n");
}

function findingStateLabel(finding: GithubProofCommentFinding): string {
  const state = finding.validationState;
  const claimsFixed = /\bFixed\b/.test(state);
  if (claimsFixed && finding.verified !== true) {
    return "ClosedWithoutEvidence";
  }
  return escapeMarkdownCell(state);
}

function escapeMarkdownCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ").trim();
}
