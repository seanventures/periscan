export interface ProductHelpStep {
  title: string;
  instruction: string;
  href?: string;
  actionLabel?: string;
}

export interface ProductHelpTerm {
  term: string;
  definition: string;
}

export interface ProductHelpGuide {
  id: string;
  title: string;
  summary: string;
  steps: ProductHelpStep[];
  terms: ProductHelpTerm[];
  caution?: string;
}

/**
 * Canonical product proof-loop stages (operator vocabulary).
 * First-run, help, radar, and activation milestone `stage` fields share this set.
 * CTEM program stages (Scope → Discover → Prioritize → Validate → Mobilize → Verify)
 * remain a separate program model — never label them as the proof loop.
 */
export const PROOF_LOOP_HELP = [
  {
    label: "Connect",
    href: "/integrations",
    detail: "Bring in read-only signals from a source you already operate."
  },
  {
    label: "Authorize",
    href: "/scopes",
    detail: "Add and verify authorized scope, then preview policy on Validate."
  },
  {
    label: "Validate",
    href: "/missions",
    detail: "Run non-invasive checks and preserve the resulting evidence."
  },
  {
    label: "Understand",
    href: "/findings",
    detail:
      "Triage measured findings and inspect their path and evidence basis."
  },
  {
    label: "Act",
    href: "/remediation",
    detail: "Assign the smallest fix that breaks the important path."
  },
  {
    label: "Verify",
    href: "/remediation?status=VerificationPending",
    detail: "Re-test with fresh evidence before treating a risk as fixed."
  },
  {
    label: "Prove",
    href: "/reports",
    detail: "Compose an audience-specific pack from governed evidence."
  }
] as const;

/** Ordered stage labels — single source for radar, first-run, and help UI. */
export const PROOF_LOOP_STAGE_LABELS = PROOF_LOOP_HELP.map(
  (stage) => stage.label
);

/**
 * UX kit alias for proof-stage chip strips (path detail, findings header, etc.).
 * Same ordered labels as PROOF_LOOP_STAGE_LABELS / PROOF_LOOP_HELP — never invent
 * a parallel vocabulary (no CTEM radar labels on operator chrome).
 */
export const PROOF_STAGE_LABELS = PROOF_LOOP_STAGE_LABELS;

/** First-run subset: empty-tenant GetStarted teaches only these three. */
export const FIRST_PROOF_STAGE_LABELS = [
  "Connect",
  "Authorize",
  "Validate"
] as const satisfies ReadonlyArray<(typeof PROOF_LOOP_STAGE_LABELS)[number]>;

const DASHBOARD_GUIDE: ProductHelpGuide = {
  id: "dashboard",
  title: "Work the proof loop",
  summary:
    "Use the ranked queue to find the next decision, then follow the linked record to its evidence or action. When unmeasured hops and verified scope exist, the flagship primary CTA is Measure path hops — not a SIEM dump.",
  steps: [
    {
      title: "Start with Needs you",
      instruction:
        "Open the highest-ranked item, starting with Now when one is present and then Soon. Queue counts come from saved prerequisites, approvals, findings, failed runs, and verification work—not sample tasks."
    },
    {
      title: "Measure multi-hop when ready",
      instruction:
        "If Priority attack paths show Measure path hops, open the deep-link to hop measurement on the top unmeasured path. FullyMeasured requires hop receipts with evidence IDs — launch never upgrades certainty. Empty path boards stay honest.",
      href: "/attack-paths",
      actionLabel: "Open attack paths"
    },
    {
      title: "Check what changed",
      instruction:
        "When two snapshots exist, use Change since last snapshot to separate new, reopened, blocked, and verified-fixed work."
    },
    {
      title: "Follow the evidence",
      instruction:
        "Open a finding, path, or remediation from its section instead of acting on an aggregate number.",
      href: "/findings",
      actionLabel: "Review findings"
    }
  ],
  terms: [
    {
      term: "Proof loop",
      definition:
        "The Connect → Authorize → Validate → Understand → Act → Verify → Prove workflow."
    },
    {
      term: "Measured",
      definition:
        "Observed by an executed validation or source integration, not inferred from configuration alone."
    },
    {
      term: "Needs you",
      definition:
        "Persisted work that requires a person’s decision or a prerequisite the product cannot complete for you."
    },
    {
      term: "FullyMeasured",
      definition:
        "Every hop on the path has a Measured edge receipt with tenant-owned evidence IDs. Never claimed from mission launch or empty boards."
    }
  ]
};

const CONTINUOUS_GUIDE: ProductHelpGuide = {
  id: "continuous",
  title: "Run continuous proof — including multi-hop",
  summary:
    "Plan intel and signals, schedule ContinuousValidation cadence on verified customer scopes only, then measure multi-hop paths hop by hop. Continuous EASM is allowlisted safe external/recon plus snapshot drift — not a SIEM dump and not an autonomous living map.",
  steps: [
    {
      title: "Plan triggers and readiness",
      instruction:
        "Use Threat Center, Threat Feed, and Signal Activity to decide what to validate next. Approvals only — denied work never queues."
    },
    {
      title: "Schedule continuous EASM on verified scope",
      instruction:
        "Create ContinuousValidation (or Control / FixVerification) schedules only against verified authorized Domain/Subdomain or internal scope. ContinuousValidation queues allowlisted safe External PoA and recon modules — seeds come from declared verified scope, not cert-transparency or whois pivot.",
      href: "/schedules",
      actionLabel: "Open schedules"
    },
    {
      title: "Measure multi-hop paths",
      instruction:
        "Correlated paths land on Attack paths. Primary journey: Measure path hops → Measure hop (safe) when Eligible → confirm edge receipts. FullyMeasured only with receipts.",
      href: "/attack-paths",
      actionLabel: "Open attack paths"
    },
    {
      title: "Operator journey help",
      instruction:
        "Getting started and page help on Attack paths document the multi-hop measured operator journey (hop plan, receipts, honesty rules).",
      href: "/getting-started",
      actionLabel: "Open getting started"
    }
  ],
  terms: [
    {
      term: "Multi-hop operator journey",
      definition:
        "Correlate paths → measure each hop with safe probes → confirm edge receipts with evidence IDs → choose breakers only after hop certainty is honest."
    },
    {
      term: "Continuous EASM",
      definition:
        "ContinuousValidation schedule fire of allowlisted safe external/recon modules on verified customer scopes only. Discoveries need measured re-probe before Validated claims — not autonomous CT/whois pivot."
    },
    {
      term: "Continuous schedule",
      definition:
        "A recurring governed validation on verified scope. Each fire re-evaluates policy; denied runs are never silently replayed. Path/risk snapshot diffs are change detection only — not a living map."
    }
  ],
  caution:
    "Continuous EASM is not an autonomous living external map or continuous terrain swarm. Continuous validation does not replace SIEM streaming or invent FullyMeasured paths. Hop launch is not measurement."
};

const INTEGRATIONS_GUIDE: ProductHelpGuide = {
  id: "integrations",
  title: "Connect a signal source",
  summary:
    "Configure only a source you are authorized to read. Periscan shows supported authentication and data access before saving it. Planned catalog entries never accept live credentials.",
  steps: [
    {
      title: "Find the source",
      instruction:
        "Use Search integrations or Category. Choose Configure only when the connector is connectable and ready for credentials; Planned entries offer Design partner instead."
    },
    {
      title: "Review access before saving",
      instruction:
        "Select an Authentication method, read the access summary, and enter every required field. Fixture-only and Planned entries cannot create a customer connection—the API rejects live credential setup."
    },
    {
      title: "Confirm real data",
      instruction:
        "After configuration, use Test and Sync in Configured. A connected status alone is not proof that a useful signal was ingested. Dedicated connectors stay Beta until customer-credential live-smoke—never treat them as Production-certified from fixtures alone.",
      href: "/missions",
      actionLabel: "Continue to scope"
    }
  ],
  terms: [
    {
      term: "Read-only by default",
      definition:
        "Connector permissions are intended to inspect source state; any write capability must be separately governed."
    },
    {
      term: "Sync",
      definition:
        "A persisted import from the connected source. The activity and resulting signals should reflect that run."
    },
    {
      term: "Planned / NotConnectable",
      definition:
        "Marketplace catalog coverage without a dedicated live client. Setup is blocked in UI and API until a vendor-specific client and credentialed contract tests ship."
    },
    {
      term: "vCenter (Partial, read-only)",
      definition:
        "The Broadcom/VMware vCenter connector is Partial depth: inventory and topology only. It does not power VMs, reconfigure, migrate, snapshot, or remediate infrastructure."
    },
    {
      term: "XSIAM vs Cortex XDR",
      definition:
        "Cortex XSIAM incident reads use the same Cortex XDR-compatible public get_incidents REST surface. Do not claim full XSIAM data-lake, XQL, or SOAR depth from this connector."
    }
  ],
  caution:
    "Do not paste production credentials into a connector marked fixture-only, planned, or NotConnectable. Periscan deliberately leaves those entries unavailable and does not elevate any connector to Production without customer-credential live-smoke evidence."
};

const DATA_FABRIC_GUIDE: ProductHelpGuide = {
  id: "assets-scope",
  title: "Trace an asset to its sources",
  summary:
    "Assets & ownership: inspect how persisted connector observations were normalized, resolved, and linked to one canonical asset without discarding disagreements.",
  steps: [
    {
      title: "Check source quality",
      instruction:
        "Start in Data source quality. Qualified means the connector is connected, healthy, inside its sync-frequency budget, and has produced normalized observations or signals. Stale, degraded, and pending states name the exact missing condition."
    },
    {
      title: "Review the ownership boundary",
      instruction:
        "Start in External ownership confidence. Exact scope comes from a verified domain; inherited domain is a descendant of one; unattributed candidates stay outside authorized ownership."
    },
    {
      title: "Triage unattributed candidates",
      instruction:
        "For an ownership-unconfirmed record, choose Request verification or Dismiss candidate and record why. The decision is audited but never creates or verifies scope; use the scope workflow for authorization."
    },
    {
      title: "Read the resolution path",
      instruction:
        "Select an asset in Canonical assets, then compare its source name, observed identifiers, normalized match keys, confidence, and evidence ID in Source-to-canonical activity."
    },
    {
      title: "Investigate disagreements",
      instruction:
        "Review every conflict chip. Periscan keeps the existing canonical field and preserves the disagreeing observation instead of applying last-source-wins."
    },
    {
      title: "Refresh from the source",
      instruction:
        "If an older asset has no durable lineage, sync its supported connector again.",
      href: "/integrations",
      actionLabel: "Open integrations"
    }
  ],
  terms: [
    {
      term: "Source quality",
      definition:
        "Current operating evidence calculated from connection status, connector health, sync age, frequency budget, and normalized output. It is not a blanket vendor-feature certification."
    },
    {
      term: "Canonical asset",
      definition:
        "The tenant-scoped asset record used by paths, findings, controls, and reports after entity resolution."
    },
    {
      term: "Source observation",
      definition:
        "An immutable account of what one connector reported during a sync, linked to that sync's evidence artifact."
    },
    {
      term: "Resolution confidence",
      definition:
        "The deterministic match strength: strong identifier, exact weak identifier, type/name fallback, or ambiguous candidate set."
    },
    {
      term: "Ownership confidence",
      definition:
        "Authorization confidence derived only from verified domain scope: exact scope is 100%, descendants are inherited at 92%, and unmatched candidates remain 0% until reviewed."
    }
  ],
  caution:
    "Entity-resolution confidence is not ownership authorization. An unattributed candidate never expands validation scope, and a descendant still inherits only from a verified domain root."
};

const MISSIONS_GUIDE: ProductHelpGuide = {
  id: "missions",
  title: "Run an authorized validation",
  summary:
    "A measured snapshot requires a verified scope and a current policy decision. Changing the scope or safety ceiling invalidates the preview.",
  steps: [
    {
      title: "Add and verify scope",
      instruction:
        "Choose Domain, Subdomain, repository path, AWS account, or CIDR, then Add scope. Domain and subdomain stay DNS TXT. Repository uses .periscan-authorization or Owner/Admin attest; AWS matches a connected account or attest; CIDR is Owner/Admin attest."
    },
    {
      title: "Check the safety envelope",
      instruction:
        "Review the scope classification, effective safety ceiling, and one-scope blast radius before choosing Preview policy decision."
    },
    {
      title: "Run only after the gate clears",
      instruction:
        "Run Community validation becomes available only when the scope is verified and the policy is Allowed, or its required approval is Approved. Compose snapshot report is a separate evidence pack — it does not start OSS engines."
    },
    {
      title: "Review the result",
      instruction:
        "Open the resulting snapshot to inspect paths, controls, evidence citations, and the report before creating remediation.",
      href: "/findings",
      actionLabel: "Triage findings"
    }
  ],
  terms: [
    {
      term: "Scope ceiling",
      definition:
        "The most intrusive safety level allowed for this scope after classification and policy constraints are applied."
    },
    {
      term: "Policy decision",
      definition:
        "The persisted allow, deny, or approval-required decision bound to a specific run request; denied work is never queued."
    },
    {
      term: "Active non-invasive",
      definition:
        "A live check designed to observe behavior without destructive actions, persistence, credential theft, or uncontrolled exploitation."
    },
    {
      term: "Mission list cursor",
      definition:
        "GET /api/v1/missions returns { items, nextCursor }. Pass nextCursor as ?cursor= for the next page; null means the last page. Findings, audit events, and evidence use offset pages ({ items, page: { hasMore, limit, offset } })."
    }
  ],
  caution:
    "Verification proves control of the target; it does not replace your organization’s authorization process. Validate only customer-approved scope. Public customer references remain 0 — this first-run is the Community proof loop, not a case study."
};

const EXTERNAL_VALIDATION_GUIDE: ProductHelpGuide = {
  id: "external-validation",
  title: "Validate an internet-facing target",
  summary:
    "Use one verified hostname, one server-owned safe GET-only profile, and one target-bound policy decision to create measured external observations. Not a full ASV, crawl, auth-fuzz, or external pentest product.",
  steps: [
    {
      title: "Choose verified scope and target",
      instruction:
        "In Verified scope, select a verified domain or subdomain. Confirm Target hostname is the exact subdomain or a hostname inside the selected verified domain. IP-only and private/reserved targets are blocked."
    },
    {
      title: "Choose a safe observation profile",
      instruction:
        "Select a Safe observation profile (headers, fingerprint, public-metadata class only). Profiles are server-owned GET-only allowlists with request ceilings—not arbitrary Nuclei severity packs or scanner arguments."
    },
    {
      title: "Run the policy preflight",
      instruction:
        "Choose Run policy preflight. Confirm the Persisted authorization section says Allowed and records a decision ID before launch."
    },
    {
      title: "Launch and watch the ledger",
      instruction:
        "Choose Launch safe validation. Follow Authorize, Policy, Execute, and Prove, then use Live validation execution for persisted queue, run, evidence, denial, failure, or timeout state."
    },
    {
      title: "Route evidence and re-test",
      instruction:
        "Inspect Normalized results and Evidence & remediation inspector. Create remediation only when evidence correlates to a path; choose Prepare fresh re-test to require a new preflight."
    }
  ],
  terms: [
    {
      term: "External point of presence",
      definition:
        "The bounded Periscan execution environment eligible for the safe external module; it is intentionally separate from internal runners."
    },
    {
      term: "Target-bound decision",
      definition:
        "A persisted policy result tied to the selected scope, hostname, profile, safety level, and execution environment."
    },
    {
      term: "Normalized evidence",
      definition:
        "A governed observation retained as product evidence without making raw scanner output the primary workflow."
    },
    {
      term: "Not full external ASV",
      definition:
        "External validation is a short allowlist of safe GET observations under verified Domain/Subdomain scope. It does not crawl, fuzz auth flows, run exploit templates, or replace a pentest or commercial ASM scanner."
    }
  ],
  caution:
    "The final launch gate rechecks target scope, tool governance, rate limits, and kill-switch state. If it denies the attempt, denied work is never queued. Do not sell or demo this surface as full ASV, continuous ASM, or external pentest."
};

const FINDINGS_GUIDE: ProductHelpGuide = {
  id: "findings",
  title: "Triage a finding",
  summary:
    "Use validation state, path proof, evidence, and business context together. Severity alone is not the work order.",
  steps: [
    {
      title: "Open the right queue",
      instruction:
        "Start on Active (default; hides false positives and suppressed noise). Choose Priority · unowned for assignment work or New · untriaged for analyst decisions, then open a finding row."
    },
    {
      title: "Check the proof",
      instruction:
        "Read occurrence count and root-cause summary when shown, then Why this priority, Path proof, Scoring factors, and linked Evidence before changing the finding."
    },
    {
      title: "Record the analyst decision",
      instruction:
        "Choose a Disposition, add an owner or note when needed, then choose Save. Accepted risk also requires an owner, expiry, and governed approval."
    },
    {
      title: "Route the smallest fix",
      instruction:
        "Use Fix workflow to create or open the owned remediation instead of treating the disposition as remediation.",
      href: "/remediation",
      actionLabel: "Open remediation"
    }
  ],
  terms: [
    {
      term: "Validation state",
      definition:
        "Whether execution proved exposure, reachability, blocking, or remained inconclusive."
    },
    {
      term: "Disposition",
      definition:
        "The analyst’s handling decision. It does not change the underlying validation evidence."
    },
    {
      term: "Priority score",
      definition:
        "A ranked combination of exploitability, control effectiveness, path context, and business context."
    },
    {
      term: "Findings page envelope",
      definition:
        "GET /api/v1/findings returns { items, page: { hasMore, limit, offset } }. Use ?limit= and ?offset=; advance while page.hasMore is true. This is not a nextCursor list."
    }
  ],
  caution:
    "Accepted risk is a governed exception, not a fix. It can expire and never changes measured evidence to Fixed."
};

const SNAPSHOT_GUIDE: ProductHelpGuide = {
  id: "snapshot",
  title: "Review a validation snapshot",
  summary:
    "Move from the highest-risk path to its control interactions, cited evidence, business impact, and smallest path-breaking fix.",
  steps: [
    {
      title: "Start with the top path",
      instruction:
        "Confirm the path state and evidence basis, then step through Interactive attack replay to see where each control observed, blocked, or missed activity."
    },
    {
      title: "Use grounded analysis",
      instruction:
        "Treat statements with evidence IDs as grounded. Text marked inference is interpretation and should be reviewed against the cited record."
    },
    {
      title: "Choose an evidence-backed path breaker",
      instruction:
        "Use Fix-impact workspace to compare which remediation breaks the most important path with the smallest operational change. Rankings are evidence-backed path breakers (greedy hitting-set, measured-hop weighted) — never exact global min-cut or Leading choke science."
    },
    {
      title: "Prepare the proof",
      instruction:
        "Open Snapshot report only after reviewing freshness, integrity, audience, and included evidence.",
      href: "/reports",
      actionLabel: "Open proof composer"
    }
  ],
  terms: [
    {
      term: "Evidence citation",
      definition:
        "A stable reference to a persisted evidence artifact used to support a statement."
    },
    {
      term: "Inference",
      definition:
        "A reasoned interpretation that is not itself a directly observed fact."
    },
    {
      term: "Evidence-backed path breaker",
      definition:
        "A controllable internal node or relationship whose remediation intersects one or more persisted, evidence-linked paths. Ranked via greedy approximation (evidence-weighted cover) for prioritization — not an exact global min-cut, max-flow, or Leading graph claim."
    }
  ]
};

const REMEDIATION_GUIDE: ProductHelpGuide = {
  id: "remediation",
  title: "Fix, then verify",
  summary:
    "A task can be implemented without being proven. Periscan reserves Fixed for a successful fresh re-test.",
  steps: [
    {
      title: "Open the task and choose the fix path",
      instruction:
        "Open an owned remediation and review its source path. For IaC, pick a real GitHub PAT integration, set the authorized repository and one proposed file, then Preview exact diff. Approve only after reviewing the red/green diff and preview hash. Periscan opens a single-file PR (never merges); multi-file or multi-repo needs separate PRs."
    },
    {
      title: "Track or roll back the pull request",
      instruction:
        "After Open pull request, use Refresh CI + merge state. Before merge, Close PR + delete branch performs the declared rollback. After merge, the task moves to Verification Pending. For work completed outside Periscan, choose Mark ready for verification or Run auto-revalidate (plan + re-measure only — never a WAF/firewall push). Neither path marks the risk fixed."
    },
    {
      title: "Run fresh verification",
      instruction:
        "Choose Run targeted verification or Auto-revalidate. Compare the before/after evidence and timeline; a failed re-test reopens or preserves the exposure. Auto-revalidate always reports actionApplied=false until a separate approved control-push capability ships."
    },
    {
      title: "Deliver verified proof",
      instruction:
        "Once the timeline records measured success, include the result in an audience-specific evidence pack.",
      href: "/reports",
      actionLabel: "Compose proof"
    }
  ],
  terms: [
    {
      term: "Verification pending",
      definition:
        "The fix is reported as implemented, but Periscan has not yet confirmed the outcome with fresh evidence."
    },
    {
      term: "Fixed",
      definition:
        "Only a fresh measured re-validation can confirm that the exposure is gone."
    },
    {
      term: "Reopened",
      definition:
        "Fresh validation found the exposure again after it had previously been treated as resolved."
    },
    {
      term: "Exact preview hash",
      definition:
        "The SHA-256 binding the approved repository, base source, full proposed file, exact diff, write operations, rollback contract, and verification contract."
    },
    {
      term: "Pull-request-only",
      definition:
        "Periscan may create the reviewed branch, file commit, and pull request but exposes no merge operation. Repository protections and human reviewers decide whether to merge."
    }
  ],
  caution:
    "Do not paste literal secrets into proposed IaC; Periscan blocks common credential patterns. Do not use a PR merge, task completion, ticket state, or stale evidence as proof that exposure is fixed."
};

const REPORTS_GUIDE: ProductHelpGuide = {
  id: "reports",
  title: "Compose governed proof",
  summary:
    "Select the audience and scope of evidence first. Preview exactly what will leave the workspace before exporting or sharing. Executive packs always show Measured/Heuristic honesty counts and are never certification.",
  steps: [
    {
      title: "Choose the audience variant",
      instruction:
        "Select a Pack type, Report preset or audience, and Priority items shown. These settings control emphasis, not the underlying evidence. Executive Risk Summary omits the technical appendix but still prints path claim honesty metrics."
    },
    {
      title: "Check governance facts",
      instruction:
        "Before Generate & preview, inspect Inclusion, Freshness, Integrity, Redaction, and Delivery. If Freshness says No snapshot, complete an authorized Validation Snapshot first.",
      href: "/missions",
      actionLabel: "Run validation first"
    },
    {
      title: "Preview before delivery",
      instruction:
        "Open the generated snapshot and verify claims, citations, audience language, Measured vs Heuristic counts, and any analyst note before export. Hypothesis-mode packs (zero fully measured paths) must not be sold as board-validated exposure."
    },
    {
      title: "Control shared access",
      instruction:
        "When sharing is enabled, create the link with the intended expiry, copy it once, and use Manage to revoke access when it is no longer needed."
    }
  ],
  terms: [
    {
      term: "Integrity",
      definition:
        "The evidence chain was checked for missing or altered links before report generation."
    },
    {
      term: "Redaction",
      definition:
        "The governed removal or masking applied when the pack is generated."
    },
    {
      term: "Share grant",
      definition:
        "A revocable, expiring access token for a specific report—not general tenant access."
    },
    {
      term: "Path claim honesty",
      definition:
        "Mandatory Measured/Heuristic and fully-measured hop counts on executive packs. Hypothesis mode means zero fully measured paths — not certification."
    },
    {
      term: "Claim deny-list",
      definition:
        "Shared prove/integrate/refuse language (never full BAS peer, never live ransomware, never DORA certification). Source: packages/shared claim-deny-list."
    }
  ],
  caution:
    "A report can summarize evidence but does not upgrade inferred, stale, or inconclusive data into measured proof. Do not treat executive packs as certification or as proof when they run in hypothesis mode."
};

const PACKS_GUIDE: ProductHelpGuide = {
  id: "packs",
  title: "Check capability readiness",
  summary:
    "Deep-linked admin readiness matrix (not a daily product line). Explains which persisted prerequisites exist for a proof loop. Does not simulate installation or entitlement. Prefer Connect → Validate empty states for first-run.",
  steps: [
    {
      title: "Choose the desired outcome",
      instruction:
        "Find the pack matching the source, validation surface, or delivery workflow you need."
    },
    {
      title: "Read every prerequisite",
      instruction:
        "For proof-loop packs, Ready means every prerequisite exists. In Enterprise breadth, Operational requires healthy tenant data, Configurable means the native path still needs customer data, and Externally gated means a contract, licensed feed, approval, or outside qualification is still required."
    },
    {
      title: "Resolve the linked gap",
      instruction:
        "Use the pack’s action to open the real setup surface. Return after completing the prerequisite to see readiness recalculate.",
      href: "/integrations",
      actionLabel: "Review integrations"
    }
  ],
  terms: [
    {
      term: "Pack",
      definition:
        "A product workflow and its real prerequisites, not a bundle of sample findings."
    },
    {
      term: "Ready",
      definition:
        "All required persisted capabilities are present for the workflow described."
    },
    {
      term: "Externally gated",
      definition:
        "Periscan has reached a boundary it cannot truthfully complete alone, such as partner-lab qualification or licensed breach-corpus access."
    }
  ],
  caution:
    "A registered module or catalog connector is not Operational until the tenant has healthy measured input."
};

const ADMIN_GUIDE: ProductHelpGuide = {
  id: "admin",
  title: "Govern the tenant",
  summary:
    "Manage tenant access, report identity, outbound webhooks (all six catalog events emit), and reviewed localization releases without changing evidence semantics or data residency.",
  steps: [
    {
      title: "Preview language and timezone",
      instruction:
        "Under Language release desk, choose a supported language and IANA timezone, then select Preview formatting. Confirm the date, number, and relative-time examples without changing the tenant policy."
    },
    {
      title: "Verify catalog assurance",
      instruction:
        "Check Product shell and Snapshot report coverage for the selected catalog. Both scopes must show every key translated, zero fallback keys, a version, and a digest before activation."
    },
    {
      title: "Activate a reviewed release",
      instruction:
        "Record the regional support owner, review or ticket reference, and review reason, then activate. Confirm navigation changes in place and a new immutable activation-ledger row appears."
    },
    {
      title: "Wire webhooks and check reports",
      instruction:
        "Subscribe outbound webhooks for mission.completed|failed, snapshot.ready, remediation.created|verified, and policy.denied (all emit, HMAC-signed). After a locale change, regenerate a report so headings localize while evidence IDs and claim semantics stay stable.",
      href: "/reports",
      actionLabel: "Open reports"
    },
    {
      title: "Recover by reviewed reactivation",
      instruction:
        "To roll back, preview the previous language and timezone and activate it with a new review reference. Confirm the evidence IDs, verdict values, data region, and prior release history remain unchanged."
    }
  ],
  terms: [
    {
      term: "Localization release",
      definition:
        "An immutable reviewed activation that binds locale, timezone, catalog version and digest, coverage, support owner, and review provenance."
    },
    {
      term: "Catalog assurance",
      definition:
        "Per-surface key coverage and fallback evidence for the exact built-in catalog version selected for activation."
    },
    {
      term: "Stable claim semantics",
      definition:
        "Stored verdicts, evidence IDs, module outcomes, and machine-readable values are not translated."
    },
    {
      term: "API list pagination",
      definition:
        "List JSON is not one envelope for every route. Missions use nextCursor; findings and audit events use page.hasMore/limit/offset; most other lists return only items (sometimes with a limit cap). OpenAPI documents each operationId honestly."
    },
    {
      term: "Webhook event catalog",
      definition:
        "mission.started|completed|failed, snapshot.ready, remediation.created|verified, finding.disposition_changed, policy.denied, schedule.failed — each HMAC-signed; secret shown once on create. Admin chips derive from WEBHOOK_EVENT_TYPES."
    },
    {
      term: "OpenAPI auth",
      definition:
        "Documented security schemes: Bearer psk_ API keys for automation and periscan_session cookie for browser sessions (OpenAPI 0.3.x)."
    }
  ],
  caution:
    "Changing language or timezone changes presentation only. It does not translate page bodies or inline help outside the stated catalog, move tenant data, authorize cross-border transfer, calculate tax, change legal terms, or alter evidence, policy, or validation state."
};

const MSSP_GUIDE: ProductHelpGuide = {
  id: "mssp",
  title: "Triage client exceptions",
  summary:
    "Rank tenants by work requiring attention, batch the review queue, then make changes inside one tenant at a time.",
  steps: [
    {
      title: "Rank the portfolio",
      instruction:
        "Start with clients showing approvals, overdue work, failed runs, missing proof, or fixes ready to verify."
    },
    {
      title: "Batch review, not mutation",
      instruction:
        "Select visible clients to build a review queue. The batch does not change findings, approvals, or remediation across tenants."
    },
    {
      title: "Enter the client context",
      instruction:
        "Use Open client (or Open findings / Open rem on a batch row). That sets the working tenant, shows Working as in the shell, and lands in that client’s workspace. Leave returns to the MSSP portfolio. Mutations stay one named tenant at a time."
    }
  ],
  terms: [
    {
      term: "Exception",
      definition:
        "A client-specific condition that requires operator attention or a governed decision."
    },
    {
      term: "Tenant-safe",
      definition:
        "Data and mutations remain isolated to the currently authorized client tenant."
    }
  ],
  caution:
    "A portfolio batch is an ordering aid only. Periscan does not apply cross-tenant bulk mutations from this view."
};

const NON_HUMAN_IDENTITIES_GUIDE: ProductHelpGuide = {
  id: "non-human-identities",
  title: "Rank machine-identity sprawl",
  summary:
    "Inventory service accounts, workload roles, OAuth credentials, API keys, and certificates without storing their plaintext credentials.",
  steps: [
    {
      title: "Register metadata, never the secret",
      instruction:
        "Choose Register metadata. Enter the source identifier or key ID—not its token, password, private key, or certificate material. Periscan stores a tenant-scoped one-way hash."
    },
    {
      title: "Describe reach and lifecycle",
      instruction:
        "Add owner, environment, privileges, resource edges, last-use, rotation, and expiry metadata. Missing source data is called out instead of treated as safe."
    },
    {
      title: "Work highest compound risk first",
      instruction:
        "Use Ranked identities to prioritize orphaned, over-privileged, public, stale, expired, and cross-environment identities. Follow Resource reach before changing access."
    }
  ],
  terms: [
    {
      term: "Source identifier hash",
      definition:
        "A tenant-scoped SHA-256 digest used to recognize an identity without retaining its original source ID."
    },
    {
      term: "Credential fingerprint",
      definition:
        "An optional SHA-256 digest of credential material. It can correlate rotations but cannot be used as the credential."
    },
    {
      term: "Resource reach",
      definition:
        "The recorded resources, environments, and access levels a machine identity can use."
    }
  ],
  caution:
    "Do not paste passwords, tokens, private keys, or certificate material. The registration API rejects unknown secret-bearing fields."
};

const MCP_GUIDE: ProductHelpGuide = {
  id: "mcp",
  title: "Query posture and start Community validation over MCP",
  summary:
    "Wave H catalog remains read-only posture query. Community tools add list_community_suite, start_community_validation (verified scopeId and policyDecisionId), and list_findings_for_mission. Denied tasks never queue. Not live Atomic, Caldera, SharpHound, sqlmap, or Metasploit.",
  steps: [
    {
      title: "Confirm Wave H catalog vs Community tools",
      instruction:
        "Open Capability honesty on the MCP console. Wave H tools stay read-only posture query. Schema still forces readOnlyHint true and destructiveHint false as Wave H catalog metadata; Community start is policy-gated in the tool description and run path. Fine-grained mutate-only keys such as mission:run alone are denied."
    },
    {
      title: "Mint a read-scope API key",
      instruction:
        "Create a tenant API key with read (or admin) scope in Admin, then paste the secret into your MCP client config. Prefix-only placeholders cannot authenticate. MCP still requires coarse read or admin to invoke; start_community_validation then enforces editor role and mission:run.",
      href: "/admin",
      actionLabel: "Open Admin API keys"
    },
    {
      title: "Connect a client over streamable HTTP",
      instruction:
        "Point the client at this origin /mcp with Authorization Bearer. Use tools/list then tools/call; every call is tenant-scoped and audited. start_community_validation needs a verified scopeId and policyDecisionId. Denied tasks never queue. Remediation apply is still not an MCP tool."
    },
    {
      title: "Use the durable flight recorder for workflow proof",
      instruction:
        "MCP does not rewrite history. For hash-chained workflow events, seal checkpoints, and fork-from-checkpoint replay, open Agent Workflows Durable flight recorder catalog.",
      href: "/workflows",
      actionLabel: "Open flight recorder"
    }
  ],
  terms: [
    {
      term: "Wave H catalog",
      definition:
        "list_findings, get_attack_paths, list_evidence, and peer tools map only to AppServices reads. readOnlyHint true is Wave H catalog metadata, not a claim that Community start is absent."
    },
    {
      term: "Community MCP tools",
      definition:
        "list_community_suite inventories the Community pack. start_community_validation starts a run only with verified scopeId and policyDecisionId. list_findings_for_mission lists evidence-backed findings for that mission. Denied tasks never queue."
    },
    {
      term: "MCP scope gate",
      definition:
        "API keys need coarse read or admin. Session users pass role gates; mutate-only fine-grained keys receive mcp_read_access_denied. Community start additionally requires editor role and mission:run after that gate."
    }
  ],
  caution:
    "Do not demo MCP as multi-agent BAS swarm or live Atomic, Caldera, SharpHound, sqlmap, or Metasploit. Denied tasks never queue. Denied mutate keys must fail closed. Prefer Agent Workflows and Model Gateway for policy-gated analyst sessions."
};

const COMPLIANCE_GUIDE: ProductHelpGuide = {
  id: "compliance",
  title: "Trace measured evidence to framework controls",
  summary:
    "Compliance control trace attaches measured Periscan validation evidence to a representative control matrix. Packs are customer evidence support only — not certification and not an audit opinion.",
  steps: [
    {
      title: "Pick a framework pack",
      instruction:
        "Choose DORA, NIS2, PCI DSS, or another listed framework. Coverage is representative and partial — never present these rows as a complete compliance program catalog."
    },
    {
      title: "Read Met / Partial / Unmet honestly",
      instruction:
        "Met requires every required measured evidence kind. Partial means some support is present; Unmet means none. Do not rebrand Partial as certified or Leading compliance."
    },
    {
      title: "Export only as evidence support",
      instruction:
        "Generate PDF/HTML from Reports when needed. Every pack carries not certification / not audit opinion language. Exports do not assert certification status or replace auditor judgment.",
      href: "/reports",
      actionLabel: "Open Reports"
    },
    {
      title: "Ground claims in a current snapshot",
      instruction:
        "If the matrix is empty or stale, run authorized validation with verified scope first so control traces can bind to real evidence IDs and last-validated times.",
      href: "/missions",
      actionLabel: "Run validation"
    }
  ],
  terms: [
    {
      term: "Evidence-support pack",
      definition:
        "Customer follow-up material linking control IDs to measured evidence kinds and evidence IDs. Not a vendor SOC 2 Type II, ISO certification, or formal framework attestation."
    },
    {
      term: "Not certification / not audit opinion",
      definition:
        "Required Wave G2 disclaimer on every compliance pack (UI banner, HTML, PDF). Never claim DORA certification, PCI attestation, or auditor sign-off from Periscan alone."
    },
    {
      term: "Representative catalog",
      definition:
        "A subset of controls used for diligence mapping. Program-complete catalogs are not claimed; depth stays Partial until evidence paths and mappings are complete."
    }
  ],
  caution:
    "Never sell compliance packs as certification, audit opinion, Leading compliance coverage, or a substitute for auditor judgment. Deny full-framework certification claims in RFIs until program-complete catalogs and customer evidence exist."
};

const WORKFLOWS_GUIDE: ProductHelpGuide = {
  id: "workflows",
  title: "Verify workflow history and deployment trust",
  summary:
    "Inspect the verified flight recorder, then qualify customer-supplied confidential-compute attestation evidence against fresh hardware-backed verifier receipts. Periscan does not run workloads inside an enclave.",
  steps: [
    {
      title: "Verify recorder integrity",
      instruction:
        "Choose the recorded run, then confirm Chain verified and History verified in Durable flight recorder before using the Variable lens. The seeded demo run states that no live model inference was performed; any integrity failure makes comparison untrusted."
    },
    {
      title: "Choose two moments",
      instruction:
        "Set Compare from and Compare to, or choose a numbered bar in Recorded moments to move the later point. Bar height shows how many variables changed at that moment."
    },
    {
      title: "Inspect the exact delta",
      instruction:
        "Use Variable family to isolate the relevant state, then select a changed or added variable. The inspector shows its bounded before/after preview and SHA-256 proof; include unchanged state only when required."
    },
    {
      title: "Reuse only verified history",
      instruction:
        "After reviewing the permanent event ledger, choose Seal checkpoint. Fork from checkpoint creates a new run only while input, policy, evidence, and chain hashes still match."
    },
    {
      title: "Qualify with fresh TEE evidence",
      instruction:
        "Confirm scope, provider, freshness, policy, and owner on the workload requirement. Create a Veraison challenge if needed, submit authorized customer evidence, select the matching receipt, and Seal decision. Periscan only qualifies customer attestation evidence — it does not host TDX/SEV/H100 or run agents inside an enclave."
    },
    {
      title: "Respond and escalate",
      instruction:
        "Treat Expired, Rejected, and Revoked as unqualified; collect fresh evidence or revoke an active qualification instead of editing history. Escalate Veraison, trust-anchor, endorsement, attester, or hardware failures using the named owner/reference; those external prerequisites are never claimed configured."
    }
  ],
  terms: [
    {
      term: "Variable lens",
      definition:
        "A derived comparison of persisted redacted workflow state. It does not reconstruct prompts, responses, credentials, or values that were never recorded."
    },
    {
      term: "Flight recorder",
      definition:
        "An append-only, hash-linked history of workflow transitions and redacted references, including model, cost, latency, policy, and evidence metadata."
    },
    {
      term: "Checkpoint fork",
      definition:
        "A new run that may reuse verified upstream history; Periscan never overwrites or resumes the original run in place."
    },
    {
      term: "Reviewed capability set",
      definition:
        "The explicitly approved MCP or A2A capability names and schema hashes that an endpoint may expose to a governed workflow."
    },
    {
      term: "Official TCK proof",
      definition:
        "A normalized, hashed result from the pinned A2A Technology Compatibility Kit. Periscan requires every reported MUST requirement to pass before labeling it compatible."
    },
    {
      term: "AgentDID trust profile",
      definition:
        "A tenant-approved issuer DID, subject DID, credential-type allowlist, audience, endpoint origin, verified scope, policy decision, and resolved document hashes for one reviewed A2A endpoint."
    },
    {
      term: "VC delegation",
      definition:
        "A short-lived vc+jwt whose issuer assertion key, subject, SPIFFE workload, audience, endpoint origin, validity window, and capability subset were verified and normalized without retaining the raw credential."
    },
    {
      term: "Veraison session",
      definition:
        "A time-bounded remote-attestation challenge whose nonce, verifier origin, evidence hash, media type, workload, scope, and result are bound before Periscan records a verdict."
    },
    {
      term: "TEE assurance requirement",
      definition:
        "An immutable, policy-bound workload contract for provider, verified scope, freshness, validity, expected claims, support ownership, and escalation. It is not proof by itself."
    },
    {
      term: "Qualification receipt",
      definition:
        "An append-only Qualified, Rejected, or Revoked decision bound to the exact normalized attestation hashes and their expiry. Qualified status degrades automatically when its evidence expires."
    },
    {
      term: "Engagement replay",
      definition:
        "A hash-linked sequence of workspace creation, collaborator changes, notes, assignments, status changes, and engagement-owned evidence pins."
    }
  ],
  caution:
    "The Variable lens analyzes only persisted redacted manifests and references; it cannot reconstruct deliberately unrecorded secrets or raw prompt/response text. Stale policy, evidence, input, or chain state denies checkpoint reuse. DID control and a valid signature do not make an issuer trusted without the tenant profile. A TEE requirement, ordinary OCI signature, demo token, or controlled verifier test is not customer hardware proof; qualification requires a fresh matching Veraison receipt from provisioned trust anchors, endorsements, and an authorized attester. Never claim Periscan runs customer agents inside a TEE/enclave or operates H100 hardware — only qualify customer-supplied attestation evidence."
};

const MODEL_GATEWAY_GUIDE: ProductHelpGuide = {
  id: "model-gateway",
  title: "Resolve a paused model action safely",
  summary:
    "Use a signed, expiring intervention link to hand an approval-gated tool request to a tenant administrator without treating a Slack or Teams message as authority.",
  steps: [
    {
      title: "Open Interventions",
      instruction:
        "Choose Interventions in Frontier Gateway. Select a request marked RequiresApproval and confirm its session purpose, mode, policy profile, scope count, input commitment, and policy decision."
    },
    {
      title: "Issue a bounded handoff",
      instruction:
        "Choose a transport label and a five-to-sixty-minute expiry, then choose Issue review link. Copy the signed link from the success panel. Periscan stores only its SHA-256 fingerprint."
    },
    {
      title: "Transport the link, not an approval",
      instruction:
        "Paste the link into Slack, Teams, or another approved channel. Do not reply with words such as approve or resume: a plain message has no authority and cannot call the decision endpoint."
    },
    {
      title: "Verify the envelope",
      instruction:
        "Open the link while signed in as a tenant administrator. Confirm Signed envelope verified, recheck the bound fields and expiry, then enter a decision reason and a review reference."
    },
    {
      title: "Resume or cancel once",
      instruction:
        "Choose Resume request to move the tool request to Approved, or Cancel request to make it non-executable. Resume does not execute the tool; execution remains a separate governed action. The same link cannot decide twice."
    },
    {
      title: "Confirm the ledger and limits",
      instruction:
        "Return to the queue and Decision log. Confirm the sealed state plus InterventionResumed or InterventionCancelled and ToolAllowed or ToolDenied. Under Model economics & routing, verify pre-turn budget and rate limits plus reconciled provider, tokens, cost, latency, and status; an intervention never bypasses them."
    }
  ],
  terms: [
    {
      term: "Authorization envelope",
      definition:
        "The exact tenant, request, session, scope, policy, input commitment, and expiry bound into the signed link. Any change invalidates the handoff."
    },
    {
      term: "Transport label",
      definition:
        "The channel expected to carry the link. Slack and Teams transport bytes only; they do not supply approval authority."
    },
    {
      term: "Resume",
      definition:
        "A one-time administrator decision that changes the paused request to Approved. It does not execute the tool."
    },
    {
      term: "Pre-turn fallback",
      definition:
        "A route selected before a provider call begins. Periscan does not switch a partially completed turn to another provider."
    },
    {
      term: "Normalized cost",
      definition:
        "Provider token usage reconciled against the tenant's configured input, output, and cached-input prices and stored in micro-US dollars."
    },
    {
      term: "Managed providers",
      definition:
        "The current strategy while production cost, trust, latency, and concurrency evidence is gathered; self-hosted production scale is not claimed."
    }
  ],
  caution:
    "Never treat a chat reaction, reply, forwarded screenshot, or copied request ID as approval. Denied requests fail closed before queueing. Only an authenticated administrator using the unexpired signed link can resume or cancel, and a changed, expired, superseded, tampered, or replayed envelope fails closed."
};

const CONTROLS_GUIDE: ProductHelpGuide = {
  id: "controls",
  title: "Validate controls without overclaiming BAS",
  summary:
    "Register detection sources, import Atomic scenarios only as dry-run content, close the DRV benign-marker class with Detection marker proof (allowlisted periscan-* emit→observe), and keep overall DRV Partial until a full ATT&CK library ships—not live Atomic inject.",
  steps: [
    {
      title: "Connect an observer first",
      instruction:
        "Register a SIEM, EDR, XDR, or WAF control source and confirm it can return read-only telemetry. Coverage and verdicts depend on real observer evidence, not a scenario catalog alone."
    },
    {
      title: "Treat Atomic as import-only",
      instruction:
        "Atomic Red Team modules supply an ATT&CK-mapped control scenario library in dry-run or fixture mode only. They do not live-inject attack techniques and are not competitive inject BAS."
    },
    {
      title: "Run Detection marker proof (DRV marker class)",
      instruction:
        "Use the Controls CTA Run detection marker proof for one allowlisted periscan-* emit→SIEM/EDR observe chain. Responses stamp drvClaimClass=benign_marker_only and fullAttackLibrary=false — marker class only, not full ATT&CK BAS. Lab may use mock SIEM when live telemetry is empty.",
      href: "/controls",
      actionLabel: "Open Controls · marker proof"
    },
    {
      title: "Measure with canaries when needed",
      instruction:
        "For measured Detected or Missed beyond the marker panel, use the exact-marker URL canary or another inject-and-observe path with live telemetry correlation. A dry-run scenario import alone never proves block or detect. Observe telemetry remains dry-run / control_live_execution_disabled."
    },
    {
      title: "Tune from evidence",
      instruction:
        "Review rule coverage per MITRE technique, apply expected-behavior tuning, and re-check history. Prefer evidence IDs and observer verdicts over fixture defaults."
    }
  ],
  terms: [
    {
      term: "Dry-run scenario import",
      definition:
        "Allowlisted Atomic ATT&CK scenario content loaded as fixture or dry-run evidence without executing techniques against endpoints."
    },
    {
      term: "Detection marker proof",
      definition:
        "Signed Wave B product path: allowlisted periscan-* benign process canary emit correlated with SIEM/EDR observation into one ControlValidation mission. drvClaimClass is always benign_marker_only; never full ATT&CK BAS."
    },
    {
      term: "DRV Partial",
      definition:
        "Detection Rule Validation honesty for the Controls surface: the benign-marker class can reach closed-loop Fully-E2E proof, but library-wide ATT&CK inject remains Scaffold/refused — overall DRV stays Partial."
    },
    {
      term: "Live inject BAS",
      definition:
        "Competitive breach-and-attack simulation that executes a stimulus and measures block/detect. Periscan keeps Atomic live inject disabled; use marker proof, canaries, or certified non-destructive probes instead."
    },
    {
      term: "Observer verdict",
      definition:
        "A control outcome derived from connected SIEM/EDR/WAF telemetry correlated to a scenario or canary marker."
    }
  ],
  caution:
    "Atomic dry-run/import is a control scenario library, not live inject BAS. Detection marker proof closes only the benign-marker class (periscan-*); overall DRV remains Partial — do not claim full ATT&CK BAS library coverage. Kill-chain is a coverage planner only; ransomware emulation is a null safety-floor stage (never build live crypto). Do not market fixture outcomes as measured control effectiveness without canary, marker proof, or live observer proof."
};

const REGISTRY_GUIDE: ProductHelpGuide = {
  id: "registries",
  title: "Engine Lab — Community vs legal-review vs catalog-only",
  summary:
    "Community engines start from Validate. Legal-review tools need license accept and are never baked into the default scan image. Catalog-only rows (Atomic, Caldera, SharpHound, sqlmap, Metasploit) are not Community validation.",
  steps: [
    {
      title: "Browse Engine Lab lanes",
      instruction:
        "Filter Community, Legal review, or Catalog only first. Ready / Needs install are install posture, not Community-start. Restricted (GPL/LGPL) engines show Legal review until your tenant records acceptance."
    },
    {
      title: "Accept the upstream license (when required)",
      instruction:
        "For Requires legal review engines, open Accept license & install. Confirm you are authorized for the tenant, record the SPDX pin ceremony, then install from the reviewed upstream pin. Periscan does not redistribute those packages in the default image."
    },
    {
      title: "Install, check, and enable",
      instruction:
        "Install queues a governed job (docker/git/pip from allowlisted coordinates only). Check readiness, then Enable for tenant. Install never enables automatically; enable never starts a mission."
    },
    {
      title: "Start with the capability, not the tool",
      instruction:
        "Use endpoint analytics for live detection proof, Kubernetes CIS plus Trivy for cluster and image posture, ZAP for passive web baselining, Syft for CycloneDX inventory, and Cosign for offline signed-artifact verification. Atomic remains dry-run/import only, not live inject."
    },
    {
      title: "Create, build, and sign an extension (optional)",
      instruction:
        "Enter a unique package name, repository, support URL, SPDX license, and bounded purpose. Generate and verify the scaffold, implement the typed adapter, pin the OCI image by SHA-256, keep the private signing key local, and submit the signed version 1.0 contract."
    },
    {
      title: "Run through an authorized mission",
      instruction:
        "Verify the target scope and preview its policy decision before dispatching a supported module. Review the resulting normalized evidence instead of raw scanner output.",
      href: "/missions",
      actionLabel: "Open Validation Snapshot"
    }
  ],
  terms: [
    {
      term: "Engine Lab",
      definition:
        "Browse, license, and install governed engines. Community-startable rows are labeled. Restricted-license tools need tenant acceptance. Catalog-only rows are not Community validation."
    },
    {
      term: "License acceptance",
      definition:
        "An auditable tenant record (who, when, tool pin, SPDX, text hash) that you accepted the upstream license. Required before install for RequiresLegalReview engines."
    },
    {
      term: "Not redistributed by default",
      definition:
        "GPL/LGPL and other legal-review engines are absent from the default scan-executor image. Customer-side install from upstream pins is the opt-in path."
    },
    {
      term: "Catalog active",
      definition:
        "The tenant-selected reviewed extension release. It does not authorize module binding, runner dispatch, network access, or execution."
    },
    {
      term: "Compatibility report",
      definition:
        "A deterministic check of immutable image digest, contract signature, declared permissions, allowlists, typed output, redaction, and resource bounds. Human certification remains separate."
    },
    {
      term: "Live supported",
      definition:
        "The module has a production execution or ingestion path; it still needs its declared scope, source, permissions, and policy prerequisites."
    },
    {
      term: "Supplied report",
      definition:
        "Evidence imported from a caller or external tool. It can substantiate observed failures but cannot earn a measured clean-state claim without verified collection provenance."
    },
    {
      term: "Observation window",
      definition:
        "The bounded time after a separately recorded benign stimulus during which a verified endpoint source is queried for the exact marker."
    }
  ],
  caution:
    "Never infer execution authority from compatibility, certification, or catalog activation. Custom extensions still require an implemented module binding, license/security review, verified scope, policy approval, and runner eligibility."
};

const RUNNERS_GUIDE: ProductHelpGuide = {
  id: "runners",
  title: "Operate the runner fleet",
  summary:
    "Use fleet health as the ops instrument: triage server-received liveness first, inspect signed work and control acknowledgements, then pair or govern outbound-only agents without opening an inbound management path.",
  steps: [
    {
      title: "Triage the fleet strip",
      instruction:
        "Start with Fleet healthy and Needs attention — the primary ops instrument. Offline, late, and halted agents sort first; select a row to open its operating record."
    },
    {
      title: "Read liveness as a receipt",
      instruction:
        "In Liveness signal, confirm Last receipt, queue depth, certificate time remaining, and agent version. Health age uses the control plane's receipt time, while the agent-reported observed time remains preserved in each immutable sample."
    },
    {
      title: "Inspect the exception and task timeline",
      instruction:
        "Read every Operator attention item, then confirm the recent signed module, safety level, terminal state, and redacted evidence count in Task activity. No task row means no persisted dispatch; it is not hidden activity."
    },
    {
      title: "Halt safely when needed",
      instruction:
        "Choose Emergency halt to stop new leases immediately. Keep the runner selected until Kill-switch host ack changes from Pending, proving that the host observed the server control on an outbound poll. Release only after the incident condition is cleared."
    },
    {
      title: "Seal the operating contract",
      instruction:
        "Open Fleet operating policy. Set the attention and later offline thresholds, queue and certificate warnings, minimum agent version, support owner, and escalation reference; then choose Seal fleet policy. The change is tenant-scoped and audited."
    },
    {
      title: "Pair through outbound HTTPS",
      instruction:
        "Open Pair and deploy a runner, enter a name and deployment mode, and choose Start pairing. Primary install is Supported Customer Runner (Go LTS); Agent (in-network) is optional lab only. Run the one-time command on an authorized host, then verify check-in and certificate fingerprint. Network and transport lists outbound destinations only."
    }
  ],
  terms: [
    {
      term: "Heartbeat receipt",
      definition:
        "An immutable control-plane record of one authenticated runner poll, including server receipt time, host observation time, version, queue state, active task reference, and certificate expiry when reported."
    },
    {
      term: "Derived fleet health",
      definition:
        "The current Healthy, Attention, Offline, Halted, Revoked, or Provisioning state calculated from server-received heartbeat age, fleet thresholds, and control state—not a self-asserted host label."
    },
    {
      term: "Host acknowledgement",
      definition:
        "Confirmation received on the runner's next outbound poll that it observed a server-side kill switch or revocation."
    },
    {
      term: "Emergency halt",
      definition:
        "A reversible server-side kill switch that prevents new task leases immediately; it does not revoke the runner's identity or erase task and heartbeat history."
    }
  ],
  caution:
    "Revocation is permanent for that runner identity. A fresh heartbeat proves authenticated liveness, not that any security control worked; control conclusions still require a signed task result and its governed evidence."
};

const ATTACK_PATHS_GUIDE: ProductHelpGuide = {
  id: "attack-paths",
  title: "Measured multi-hop is the default journey",
  summary:
    "Flagship loop: open a correlated path, measure each hop with safe probes and edge receipts, keep technical proof separate from customer-supplied loss assumptions, then prioritize breakers only after hop certainty is honest.",
  steps: [
    {
      title: "Lead with hop measurement progress",
      instruction:
        "On Attack paths, read Multi-hop measurement first: hops measured vs total, fully measured vs partial vs hypothesis. Paths with zero measured hops stay Heuristic. Open a path (links land on Hop measurement) and treat Measured as evidence-backed only."
    },
    {
      title: "Inspect proof fusion and hop plan",
      instruction:
        "Treat Measured as evidence-backed and Heuristic as modeled reachability. A fused posture path is not cluster-breakout or exploitability proof, and a high score never upgrades evidence basis. On path detail, review hop eligibility, safe modules, prerequisites, missing telemetry, and evidence basis."
    },
    {
      title: "Measure hops safely, then confirm receipts",
      instruction:
        "Primary CTA is Measure path hops when the path is not fully measured. When a hop is Eligible or NeedsApproval, choose Measure hop (safe). Allowed policy auto-queues the hop probe; RequiresApproval and Denied never queue work. Launch never upgrades a hop to Measured — confirm progress only via measured edge ratio and edge receipts with tenant-owned evidence IDs."
    },
    {
      title: "Create assumptions with cited inputs",
      instruction:
        "In Business impact desk, create an assumption version for a discovered asset (scenario prompts never supply benchmark dollars). Enter ordered low/likely/high ranges for frequency and magnitude with at least one named source, preview the PERT estimate, and leave path exposure unchanged until approval."
    },
    {
      title: "Submit, decide, and verify",
      instruction:
        "Select Submit for review. An Owner or Admin adds a durable reference and note before Approve & activate or Reject; then confirm the permanent ledger shows status, estimate, source count, digest, and Integrity verified."
    },
    {
      title: "Choose and revalidate the path breaker",
      instruction:
        "Use the optimizer only after confirming path evidence and assumption provenance. After remediation, run a policy-gated re-test; neither a valuation nor a recommendation can mark the path fixed.",
      href: "/remediation?status=VerificationPending",
      actionLabel: "Review re-tests"
    }
  ],
  terms: [
    {
      term: "Annualized loss exposure (ALE)",
      definition:
        "The PERT expected loss-event frequency multiplied by the PERT expected loss magnitude. In Periscan it is explicitly a customer planning assumption."
    },
    {
      term: "Validated",
      definition:
        "The required evidence-backed conditions were observed. It does not claim exploit execution unless the path has separate permitted exploitability proof."
    },
    {
      term: "Hop eligibility",
      definition:
        "Whether a path edge can receive a safe hop-probe launch (Eligible or NeedsApproval — launch still policy-gates), is already Measured with evidence, or is blocked by scope, runner, integration, or missing safe module."
    },
    {
      term: "Path edge receipt",
      definition:
        "The durable record of a hop measurement: module, outcome, validation state, evidence IDs, and measured-at. Path evidence basis is recomputed from receipts by weakest edge."
    },
    {
      term: "Source provenance",
      definition:
        "The named owner, reference, as-of date, and note that explain where a financial assumption came from."
    },
    {
      term: "Path breaker",
      definition:
        "An evidence-backed controllable internal node or relationship whose remediation intersects one or more current persisted paths. Operator prioritization only (greedy hitting-set + measured-hop weights) — not exact min-cut science."
    }
  ],
  caution:
    "Business-impact values are not observed loss history, actuarial advice, or a full FAIR assessment. Hop launch RequiresApproval or Denied never means Measured. Approval changes prioritization context only; it does not upgrade inferred or heuristic evidence and never proves a fix."
};

const BILLING_GUIDE: ProductHelpGuide = {
  id: "billing",
  title: "Reconcile access and measured usage",
  summary:
    "Billing is a usage and entitlement ledger without a payment bank. paymentProcessorStatus is NotConfigured: invoice / approval-reference design partners only — never silent self-serve checkout readiness. AWS Marketplace public listing is NotConfigured until seller ops attest Public; product code alone never invents a live listing URL.",
  steps: [
    {
      title: "Confirm the entitlement source",
      instruction:
        "Read Your plan, Renewal continuity, and AWS Marketplace separately. A direct agreement, Marketplace entitlement, and provider configuration are distinct sources and never imply one another. Package status Available means entitlements, not a charged purchase. Do not claim live public Marketplace or card checkout while listing/processor stay NotConfigured."
    },
    {
      title: "Start the direct-agreement ledger",
      instruction:
        "After commercial approval, record the package, order-form reference, support owner, term end, and review lead time. Periscan changes entitlements but does not charge a card, calculate tax, or issue an invoice."
    },
    {
      title: "Approve and apply the next term",
      instruction:
        "Before term end, record an approved renewal reference, package, duration, and reason or record non-renewal. At the due boundary, Reconcile closes the usage period and applies only the scheduled reviewed term."
    },
    {
      title: "Handle exceptions without ambiguity",
      instruction:
        "Use bounded grace for a referenced invoice or procurement exception. Resolve it with a reference, or schedule cancellation at term end; cancellation never removes access early and can be revoked before reconciliation."
    },
    {
      title: "Attach and refresh Marketplace",
      instruction:
        "After AWS redirects here, attach the one-time claim token, then use Refresh entitlements after contract changes. Empty, expired, cancelled, false, or zero entitlement removes Marketplace-derived access fail closed."
    },
    {
      title: "Meter one completed hour",
      instruction:
        "Use Sync completed hour only after dimension mappings are configured. Repeating it does not resubmit a terminal subscription, dimension, and UTC-hour record."
    }
  ],
  terms: [
    {
      term: "IntegrationReady",
      definition:
        "Registration, entitlement, and metering code is configured, but no AWS limited or public listing is claimed."
    },
    {
      term: "Limited",
      definition:
        "AWS has made the product available only to approved test accounts for integration qualification."
    },
    {
      term: "Public",
      definition:
        "Commercial operations has independently verified that the AWS Marketplace offer is publicly reachable and transactable (LISTING_STATE=Public plus PUBLIC_AVAILABILITY_PROVEN). Product code or IntegrationReady alone is not a live public listing."
    },
    {
      term: "NotConfigured (payments / Marketplace)",
      definition:
        "Default honesty: no payment bank and no public Marketplace offer. Sales-led invoice path only; never invent checkout CTAs or marketplace listing URLs."
    },
    {
      term: "Term ledger",
      definition:
        "The hash-linked direct-agreement history, period boundaries, usage snapshots, renewal decisions, grace events, and cancellation recovery for one tenant."
    },
    {
      term: "Grace exception",
      definition:
        "A bounded, referenced interval that preserves current entitlements while an external invoice or procurement issue is resolved."
    }
  ],
  caution:
    "Payment processing, tax, invoicing, procurement settlement, and public Marketplace availability remain external facts. A saved lifecycle, product code, successful test double, or configured SDK does not prove them."
};

const ASYNC_OPERATIONS_GUIDE: ProductHelpGuide = {
  id: "async-operations",
  title: "Recover asynchronous work safely",
  summary:
    "Use reviewed tenant targets to identify genuinely stale validation work, terminalize it deliberately, and prepare a fresh policy-gated draft instead of replaying it.",
  steps: [
    {
      title: "Review operating targets",
      instruction:
        "Open Reviewed operating targets, name the support owner and escalation channel, set queue-age, running-timeout, and runner-lease warning seconds, add the runbook reference, then choose Save reviewed targets."
    },
    {
      title: "Read the live operating rail",
      instruction:
        "Start with Operating state, Stalled, and Waiting. Select an exception in Recovery queue to inspect its persisted status, age, mission, run, attempts, error, and exact next action."
    },
    {
      title: "Reconcile only stale work",
      instruction:
        "Open Reconciliation boundary, enter a decision reference and a reason of at least ten characters, then choose Reconcile stale work. Running jobs change only after the reviewed timeout; runner tasks change only after signed expiry."
    },
    {
      title: "Choose the terminal decision",
      instruction:
        "For a TerminalFailure, enter the incident or change reference and operator reason. Choose Accept terminal outcome when no new run is needed, or Prepare recovery draft when the mission should be reviewed again."
    },
    {
      title: "Verify the recovery draft",
      instruction:
        "After Prepare recovery draft succeeds, open Validation Snapshot recent activity and confirm the new mission is Draft, has no copied policy decision, and has not created a job or runner task. Preview policy and start it only after fresh approval.",
      href: "/missions",
      actionLabel: "Open Validation Snapshot"
    },
    {
      title: "Check the recovery ledger",
      instruction:
        "Read Recovery ledger for sequence, actor-backed reference, result, and hash verified. Policy changes, reconciliations, prepared drafts, and accepted outcomes remain immutable operating evidence."
    }
  ],
  terms: [
    {
      term: "Operating target",
      definition:
        "A tenant-reviewed queue or execution threshold used for triage and reconciliation; it is not an externally audited availability SLO."
    },
    {
      term: "Reconciliation",
      definition:
        "An idempotent check that marks only objectively stale active work terminal and records exact counts in the ledger."
    },
    {
      term: "Recovery draft",
      definition:
        "A new Draft mission cloned from verified source intent without a policy decision, run, job, or direct replay."
    }
  ],
  caution:
    "There is no direct replay action. Recovery requires verified source scope and creates a Draft with no copied policy decision; denied work is never queued, and this screen does not claim production soak or 10,000-workload qualification."
};

const ENGAGEMENTS_GUIDE: ProductHelpGuide = {
  id: "engagements",
  title: "Operate a bounded evidence feedback loop",
  summary:
    "Compile one deterministic graph over verified scope, approve its exact hash and cycle budget, then make each fresh evidence decision explicit and attributable.",
  steps: [
    {
      title: "Select verified scope",
      instruction:
        "Choose the customer-authorized Scope, describe the proof in Validation intent, and choose a Signed cycle budget. The budget becomes immutable when you compile."
    },
    {
      title: "Review the signed graph",
      instruction:
        "Choose Compile preview, then inspect every module, prerequisite, branch condition, compiled hash, and signature. The graph cannot invent a tool, permission, scope, or branch at runtime."
    },
    {
      title: "Approve the exact hash",
      instruction:
        "Choose Approve exact hash only when the preview matches the authorized proof. Approval seals the graph and budget; editing the intent requires a newly compiled bundle."
    },
    {
      title: "Record the next decision",
      instruction:
        "In Next decision, enter a Feedback decision reason and Feedback review reference, then choose Run next governed cycle. A stale cycle count fails closed instead of replaying your decision."
    },
    {
      title: "Inspect fresh branch evidence",
      instruction:
        "Select the completed cycle in Signed cycle rail. In Branch evidence, confirm each step's status, evidence count, signal count, and the exact prior-step facts used to match or skip its branch."
    },
    {
      title: "Stop or recompile deliberately",
      instruction:
        "Use Stop loop with a decision reason and review reference when no further cycle is authorized. Stopped and exhausted bundles are terminal; compile and approve a new hash to continue."
    }
  ],
  terms: [
    {
      term: "Feedback cycle",
      definition:
        "One human-triggered execution of the approved graph whose engagement, evidence, branch decisions, reason, reference, and cycle number are persisted."
    },
    {
      term: "Branch predicate",
      definition:
        "A signed condition evaluated only from the named prior step's fresh status, evidence count, signal count, and validation state."
    },
    {
      term: "Signed cycle budget",
      definition:
        "The maximum number of attempts sealed into the approved bundle. Every reserved attempt consumes one cycle, including a failed execution."
    },
    {
      term: "Exhausted",
      definition:
        "The bundle reached its signed cycle limit and cannot execute again. Continuing requires a separately compiled and approved bundle."
    }
  ],
  caution:
    "A feedback loop is not self-modifying autonomy: tools, policy, scope, graph, and cycle budget stay fixed. Every reserved attempt consumes budget, stopping is terminal, and denied tasks are never queued."
};

/** P07-2: authorize home help for Operate · Scope. */
const SCOPES_GUIDE: ProductHelpGuide = {
  id: "scopes",
  title: "Authorize validation scope",
  summary:
    "Add and verify customer-authorized targets. Nothing measures outside verified scope. Inventory and ownership live on Assets & ownership.",
  steps: [
    {
      title: "Add an authorized target",
      instruction:
        "Create a Domain, Subdomain, or IP range the customer has authorized. Pending entries are visible but cannot be validated until verified."
    },
    {
      title: "Complete verification",
      instruction:
        "Finish the DNS/token challenge for the selected scope, then Verify. Stale verifications must be re-checked before use."
    },
    {
      title: "Set the safety envelope",
      instruction:
        "Confirm the effective max safety level for the scope. Policy previews on Validate bind to this envelope."
    },
    {
      title: "Run Validate on verified scope",
      instruction:
        "Open Validate to run a guided Validation Snapshot. Inventory lineage stays under Assets & ownership.",
      href: "/missions",
      actionLabel: "Open Validate"
    }
  ],
  terms: [
    {
      term: "Verified scope",
      definition:
        "A customer-authorized target with a completed ownership challenge. Only Verified scope may be validated."
    },
    {
      term: "Safety ceiling",
      definition:
        "The maximum safety level allowed for work on this scope. Policy may further restrict; denied work is never queued."
    }
  ],
  caution:
    "Do not treat asset inventory confidence as authorization. Authorize here; measure only after Verified."
};

const SCHEDULES_GUIDE: ProductHelpGuide = {
  id: "schedules",
  title: "Schedule recurring validation",
  summary:
    "Create recurring Validation Snapshot, ContinuousValidation (continuous EASM on verified scopes), Control, or FixVerification schedules with policy gates — never an autonomous living map.",
  steps: [
    {
      title: "Pick verified scope",
      instruction:
        "Schedules only fire against verified, authorized scope. Open Scope first if none are Verified. ContinuousValidation seeds from declared verified targets only — not cert-transparency or whois pivot.",
      href: "/scopes",
      actionLabel: "Open Scope"
    },
    {
      title: "Define cadence and ContinuousValidation intent",
      instruction:
        "Choose interval and mission type. ContinuousValidation queues allowlisted safe External PoA (Nuclei) and recon modules plus prior-snapshot path/risk change detection — not a living external map. Preview shows the next fire time before save."
    },
    {
      title: "Confirm policy still allows",
      instruction:
        "Denied or expired policy stops queueing. Review Approvals or Trust & Safety when schedules go quiet."
    }
  ],
  terms: [
    {
      term: "Next fire",
      definition:
        "The computed next run time from the schedule interval and last success — not a guarantee of runner capacity."
    },
    {
      term: "ContinuousValidation EASM",
      definition:
        "Allowlisted safe continuous external/recon modules on verified Domain/Subdomain or internal scope. Snapshot diffs are change detection only — not autonomous terrain or a living map."
    },
    {
      term: "Policy gate",
      definition:
        "Each fire re-checks authorization and policy; denied work is never queued."
    }
  ],
  caution:
    "Schedules never bypass policy. ContinuousValidation is not a living map. A denied decision means no job is queued."
};

const THREAT_CENTER_GUIDE: ProductHelpGuide = {
  id: "threat-center",
  title: "Threats door",
  summary:
    "Advisories, feed, and signal activity behind one Threats entry — Labs intel, not the daily proof loop.",
  steps: [
    {
      title: "Triage advisories first",
      instruction:
        "Review tenant-relevant advisories before opening the raw feed, signal stream, or ATT&CK catalog."
    },
    {
      title: "Open feed or signal activity from the hub",
      instruction:
        "Use hub links for feed and signal stream — they are deep links, not separate rail peers."
    },
    {
      title: "Link only measured paths",
      instruction:
        "When an advisory maps to a path or finding, open that Operate surface for disposition — do not invent coverage from feed text."
    },
    {
      title: "Return to the proof loop",
      instruction:
        "Use Paths and Findings for measured next actions after intel context is clear.",
      href: "/findings",
      actionLabel: "Open Findings"
    }
  ],
  terms: [
    {
      term: "Threats door",
      definition:
        "Single Labs entry for advisories, feed, and signal activity (P07-11 / UX-W2)."
    },
    {
      term: "Measured path",
      definition:
        "An attack path with hop evidence; intel without measurement is not proof."
    }
  ],
  caution:
    "Threat intel is context, not measured validation. Prefer Paths and Findings for proof-loop work."
};

const THREAT_FEED_GUIDE: ProductHelpGuide = {
  id: "threat-feed",
  title: "Threat feed",
  summary:
    "Raw or tenant-filtered threat feed deep-link. Prefer Threats in Labs for the primary door.",
  steps: [
    {
      title: "Use Threats as the home door",
      instruction:
        "Return to the Labs Threats door for the curated path; this feed is a deep-link residual."
    },
    {
      title: "Filter before acting",
      instruction:
        "Apply severity and relevance filters before opening related product objects."
    },
    {
      title: "Hand off to measured surfaces",
      instruction:
        "Open Findings when a feed item maps to tenant evidence — never invent coverage from text alone.",
      href: "/findings",
      actionLabel: "Open Findings"
    }
  ],
  terms: [
    {
      term: "Feed residual",
      definition:
        "A freestanding route kept for deep links; not a peer Operate destination."
    },
    {
      term: "Honest empty",
      definition:
        "An empty feed means NotConfigured or no tenant-matched items — not synthetic noise."
    }
  ],
  caution: "Do not demo the raw feed as the product flagship."
};

const LABS_GUIDE: ProductHelpGuide = {
  id: "labs",
  title: "Labs portal",
  summary:
    "Directory of demoted and experimental surfaces. Daily proof work stays on Operate; open Labs only after the loop is real.",
  steps: [
    {
      title: "Stay on Operate for first value",
      instruction:
        "Connect, Scope, Validate, Paths, Findings, and Remediation are the proof loop. Use Labs only for secondary tools.",
      href: "/dashboard",
      actionLabel: "Open Home"
    },
    {
      title: "Pick a Labs destination deliberately",
      instruction:
        "Each card has an honest one-liner. Live validation ops, MCP, and Threats are not first-demo openers."
    },
    {
      title: "Prefer Continuous for ops health",
      instruction:
        "Queue metrics and runner health join through Continuous Health (Live validation ops deep-link) and Runners — not a peer rail item.",
      href: "/continuous",
      actionLabel: "Open Continuous"
    }
  ],
  terms: [
    {
      term: "Labs portal",
      definition:
        "Single /labs home listing Labs destinations; rail children remain for power users (UX-W6)."
    },
    {
      term: "Labs demotion",
      definition:
        "Autonomous and live-ops surfaces sit under Labs, hidden until Show Labs & more."
    }
  ],
  caution:
    "Do not sell Labs as the product. Fixed remains verification-only everywhere."
};

const SWARM_GUIDE: ProductHelpGuide = {
  id: "swarm",
  title: "Live validation ops (Labs)",
  summary:
    "Live sessions and engagement activity. Labs surface — not part of the first-run proof loop or Operate daily rail.",
  steps: [
    {
      title: "Prefer Validate for measured work",
      instruction:
        "First measured proof runs on Validate with verified scope. Open Labs only after the proof loop is real.",
      href: "/missions",
      actionLabel: "Open Validate"
    },
    {
      title: "Read status, avoid theater",
      instruction:
        "Use list and status views. Do not present autonomous radar as the customer story on first demo."
    },
    {
      title: "Escalate only governed sessions",
      instruction:
        "Any live ops action still requires verified scope, policy, and audit — denied tasks never queue."
    }
  ],
  terms: [
    {
      term: "Labs demotion",
      definition:
        "Autonomous and live-ops surfaces sit under Labs, hidden until Show Labs & more."
    },
    {
      term: "Governed live ops",
      definition:
        "Live validation activity that still respects scope ceilings, policy, and Fixed-only-via-verification."
    }
  ],
  caution:
    "Not part of the first-run spine. Keep Swarm in Labs for design partners who ask — never the SE opening act."
};

const GENERIC_GUIDE: ProductHelpGuide = {
  id: "generic",
  title: "Orient on this page",
  summary:
    "Use the page heading for scope, status labels for current state, and linked records for evidence or next action.",
  steps: [
    {
      title: "Confirm where you are",
      instruction:
        "Read the breadcrumb and page description before changing data. Use Jump to a page or Command-K to move without hunting through the rail."
    },
    {
      title: "Separate status from action",
      instruction:
        "Badges report persisted state. Buttons perform actions and may still require scope, policy, permission, or approval."
    },
    {
      title: "Return to ranked work",
      instruction:
        "Use the Dashboard when you are unsure what needs attention next.",
      href: "/dashboard",
      actionLabel: "Open Dashboard"
    }
  ],
  terms: [
    {
      term: "Evidence basis",
      definition:
        "Whether the state is measured, source-observed, inferred, or currently missing supporting evidence."
    },
    {
      term: "Governed action",
      definition:
        "An action constrained by tenant authorization, policy, approval, and audit logging."
    }
  ]
};

/**
 * P19-r2 / P19-r3 residual: single honest sales walk for BAS refuse + Wiz
 * co-exist. Deep-links real product surfaces only — no fake demo data, no
 * inject-library claims, no CNAPP replacement. Continuous hub labels this
 * "Sales walk (honest)".
 */
const COMPETITIVE_WALK_GUIDE: ProductHelpGuide = {
  id: "competitive-walk",
  title: "Competitive walk: BAS refuse + Wiz co-exist",
  summary:
    "Single honest sales walk: refuse full multi-vector BAS bake-offs, co-exist with Wiz as CNAPP context, and prove paths on verified scope. Real surfaces only — no fake demo data, no inject claims.",
  steps: [
    {
      title: "Authorize verified scope",
      instruction:
        "Open Scope and confirm Verified authorized targets. Nothing measures without verified scope. Customer-authorized assets only — Wiz inventory becomes exposure context after Connect, never a free-for-all scan.",
      href: "/scopes",
      actionLabel: "Open Scope"
    },
    {
      title: "Read engines honesty",
      instruction:
        "Open Engine Lab. Show Ready vs Needs install vs Not available. Restricted engines need license acceptance. Atomic and live-inject peers stay dry-run or unavailable — never demo as competitive inject BAS.",
      href: "/engines",
      actionLabel: "Open Engines"
    },
    {
      title: "Refuse full BAS on Controls",
      instruction:
        "Open Controls. Atomic is dry-run/import only. Measured Detected/Missed needs canary or live observer correlation. Walk away from malware/phishing/DNS-exfil library bake-offs — partner or refuse full multi-vector BAS RFPs.",
      href: "/controls",
      actionLabel: "Open Controls"
    },
    {
      title: "Triage Active findings",
      instruction:
        "Open Findings on Active (default; hides FP and suppressed noise). Start with measured exposure. If Wiz issues were ingested as CNAPP context, prove which matter here — do not claim Periscan replaces the Wiz graph.",
      href: "/findings",
      actionLabel: "Open Active findings"
    },
    {
      title: "Multi-hop Measure CTA",
      instruction:
        "Open Attack paths. Primary CTA is Measure path hops when unmeasured hops and verified scope exist. FullyMeasured only with edge receipts and evidence IDs — launch never upgrades certainty. This is path-proof co-exist with CNAPP inventory.",
      href: "/attack-paths",
      actionLabel: "Measure path hops"
    },
    {
      title: "Scorecard honesty note",
      instruction:
        "Return to Continuous. Read Specialist coverage — Scaffold/gated rows (ransomware, APT, OT, dark web) are not Available and not sold as full BAS peers. Never export Leading claims for matrix Missing or Scaffold rows.",
      href: "/continuous",
      actionLabel: "Open Continuous hub"
    }
  ],
  terms: [
    {
      term: "BAS refuse",
      definition:
        "Refuse full multi-vector scenario-library bake-offs. Governed control observation and safe probes only — not malware, phishing, or DNS-exfil inject parity."
    },
    {
      term: "Wiz co-exist",
      definition:
        "Bring Wiz inventory and issues as normalized CNAPP exposure context. Prove paths and Fixed; never replace CNAPP or claim toxic-combo graph parity."
    },
    {
      term: "Sales walk (honest)",
      definition:
        "The Continuous hub label for this guide: ordered deep-links to real product surfaces with no fake demo data and no inject claims."
    }
  ],
  caution:
    "No fake demo data, no inject-library claims, no CNAPP replacement. Fixed only via verification. Denied work is never queued. Do not inflate scorecard verdicts."
};

export const PRODUCT_HELP_GUIDES = [
  DASHBOARD_GUIDE,
  CONTINUOUS_GUIDE,
  COMPETITIVE_WALK_GUIDE,
  INTEGRATIONS_GUIDE,
  DATA_FABRIC_GUIDE,
  SCOPES_GUIDE,
  MISSIONS_GUIDE,
  EXTERNAL_VALIDATION_GUIDE,
  FINDINGS_GUIDE,
  SNAPSHOT_GUIDE,
  REMEDIATION_GUIDE,
  REPORTS_GUIDE,
  PACKS_GUIDE,
  MSSP_GUIDE,
  NON_HUMAN_IDENTITIES_GUIDE,
  WORKFLOWS_GUIDE,
  MCP_GUIDE,
  COMPLIANCE_GUIDE,
  MODEL_GATEWAY_GUIDE,
  CONTROLS_GUIDE,
  REGISTRY_GUIDE,
  RUNNERS_GUIDE,
  ATTACK_PATHS_GUIDE,
  ASYNC_OPERATIONS_GUIDE,
  ENGAGEMENTS_GUIDE,
  BILLING_GUIDE,
  ADMIN_GUIDE,
  SCHEDULES_GUIDE,
  THREAT_CENTER_GUIDE,
  THREAT_FEED_GUIDE,
  LABS_GUIDE,
  SWARM_GUIDE,
  GENERIC_GUIDE
] as const;

/** Look up a catalogued help guide by stable id (e.g. competitive-walk). */
export function getProductHelpGuide(id: string): ProductHelpGuide | undefined {
  return PRODUCT_HELP_GUIDES.find((guide) => guide.id === id);
}

export function resolveProductHelp(pathname: string): ProductHelpGuide {
  if (pathname === "/" || pathname === "/dashboard") return DASHBOARD_GUIDE;
  if (pathname === "/continuous") return CONTINUOUS_GUIDE;
  if (pathname === "/integrations") return INTEGRATIONS_GUIDE;
  if (pathname === "/assets" || pathname === "/data-fabric")
    return DATA_FABRIC_GUIDE;
  if (pathname === "/scopes") return SCOPES_GUIDE;
  if (pathname === "/missions" || pathname.startsWith("/missions/")) {
    return MISSIONS_GUIDE;
  }
  if (pathname === "/external-validation") {
    return EXTERNAL_VALIDATION_GUIDE;
  }
  if (pathname === "/findings") return FINDINGS_GUIDE;
  if (pathname.startsWith("/snapshots/") && !pathname.endsWith("/report")) {
    return SNAPSHOT_GUIDE;
  }
  if (pathname === "/remediation" || pathname.startsWith("/remediation/")) {
    return REMEDIATION_GUIDE;
  }
  if (pathname === "/reports" || pathname.endsWith("/report")) {
    return REPORTS_GUIDE;
  }
  if (pathname === "/packs") return PACKS_GUIDE;
  if (pathname === "/mssp") return MSSP_GUIDE;
  if (pathname === "/non-human-identities") {
    return NON_HUMAN_IDENTITIES_GUIDE;
  }
  if (pathname === "/workflows") return WORKFLOWS_GUIDE;
  if (pathname === "/mcp") return MCP_GUIDE;
  if (pathname === "/compliance") return COMPLIANCE_GUIDE;
  if (pathname === "/model-gateway") return MODEL_GATEWAY_GUIDE;
  if (pathname === "/controls") return CONTROLS_GUIDE;
  if (pathname === "/engines" || pathname === "/registries") {
    return REGISTRY_GUIDE;
  }
  if (pathname === "/runners") return RUNNERS_GUIDE;
  if (pathname === "/attack-paths") return ATTACK_PATHS_GUIDE;
  if (pathname === "/validation-ops") return ASYNC_OPERATIONS_GUIDE;
  if (pathname === "/engagements") return ENGAGEMENTS_GUIDE;
  if (pathname === "/billing") return BILLING_GUIDE;
  if (pathname === "/admin") return ADMIN_GUIDE;
  if (pathname === "/schedules") return SCHEDULES_GUIDE;
  if (pathname === "/threat-center" || pathname === "/threats") {
    return THREAT_CENTER_GUIDE;
  }
  if (pathname === "/threat-feed") return THREAT_FEED_GUIDE;
  if (pathname === "/signal-activity") return THREAT_CENTER_GUIDE;
  if (pathname === "/labs") return LABS_GUIDE;
  if (pathname === "/swarm") return SWARM_GUIDE;
  if (pathname.startsWith("/attack-paths/")) return ATTACK_PATHS_GUIDE;
  return GENERIC_GUIDE;
}
