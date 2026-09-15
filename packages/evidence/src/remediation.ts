import type { AttackPath, MitigationStep, PrescriptivePlan, RiskScore } from "@periscan/shared";
import {
  simulateRemediationWhatIf,
  generateReviewableRemediationTemplates,
  createTripwireBehavioralDetector,
  computeFixEffectivenessTrending,
  type RemediationSimulationInput,
  type RemediationSimulationResult,
  type PlaybookArtifacts,
  type TripwireConfig,
  type FixEffectivenessTrend
} from "@periscan/shared";

export interface RemediationTaskDraft {
  owner: string | null;
  recommendedAction: string;
  relatedExposureId: string | null;
  technicalSteps: string[];
  verificationMethod: string;
  verificationRequired: boolean;
}

interface PlaybookRemediationInput {
  remediationId: string;
  recommendedAction?: string | null;
  technicalSteps?: string[] | null;
}

interface PastFixEffectivenessInput {
  remediationId: string;
  verificationOutcome?: string;
  riskDelta?: number;
}

function firstExposureId(path: AttackPath) {
  return (
    path.pathNodes.find((node) => node.entityType === "Exposure")?.entityId ??
    null
  );
}

export function generateRemediationTaskDraft(
  path: AttackPath,
  risk: RiskScore
): RemediationTaskDraft {
  const haystack = [path.name, ...path.pathNodes.map((node) => node.label)]
    .join(" ")
    .toLowerCase();

  if (haystack.includes("secret")) {
    return {
      owner: "Security engineering",
      recommendedAction:
        "Rotate the exposed secret and remove the downstream production role path.",
      relatedExposureId: firstExposureId(path),
      technicalSteps: [
        "Rotate the credential in the source repository and invalidate active sessions.",
        "Remove repository-derived access from the production role or brokered credential path.",
        "Confirm the production target is no longer reachable from the rotated secret path."
      ],
      verificationMethod:
        "Rerun the repository secret validation and confirm the correlated cloud path no longer resolves.",
      verificationRequired: true
    };
  }

  if (
    haystack.includes("public") ||
    haystack.includes("external") ||
    haystack.includes("internet")
  ) {
    return {
      owner: "Cloud platform",
      recommendedAction:
        "Restrict the public entry point and tighten the production ingress boundary.",
      relatedExposureId: firstExposureId(path),
      technicalSteps: [
        "Remove or narrow the public exposure from the verified external scope.",
        "Update ingress policy, security group, or firewall rules to match intended access.",
        "Confirm the production service is no longer externally reachable."
      ],
      verificationMethod:
        "Rerun the safe external validation against the verified domain or service boundary.",
      verificationRequired: true
    };
  }

  if (haystack.includes("ai")) {
    return {
      owner: "AI application owner",
      recommendedAction:
        "Restrict the AI app data path and reduce tool or retrieval permissions.",
      relatedExposureId: firstExposureId(path),
      technicalSteps: [
        "Limit the AI app to approved data sources and authorization checks.",
        "Reduce tool permissions and ensure the test account cannot reach restricted content.",
        "Revalidate with the same safe AI test harness and compare the evidence."
      ],
      verificationMethod:
        "Rerun the AI app validation suite with the same customer-approved test account.",
      verificationRequired: true
    };
  }

  return {
    owner:
      risk.band === "Critical" || risk.band === "High"
        ? "Platform owner"
        : null,
    recommendedAction:
      "Break the highest-confidence edge in the path and rerun validation.",
    relatedExposureId: firstExposureId(path),
    technicalSteps: [
      "Remove the highest-value path breaker identified by the correlated evidence.",
      "Revalidate the impacted control, permission, or exposure edge.",
      "Confirm the path state drops to mitigated or fixed with new evidence."
    ],
    verificationMethod:
      "Rerun the targeted validation mission for this path and compare evidence before and after remediation.",
    verificationRequired: true
  };
}

/** Stack-aware template fragments for planner (no fake AI; deterministic match). */
function stackAwareTemplates(haystack: string): MitigationStep[] {
  const templates: MitigationStep[] = [];
  let order = 0;
  const push = (
    title: string,
    action: string,
    rationale: string,
    iacHint?: string
  ) => {
    order += 1;
    templates.push({
      order,
      title,
      action,
      rationale,
      iacHint,
      safety: "safe"
    });
  };

  if (
    /security.?group|aws.?sg|\bsg-|ec2|nacl|network.?acl/i.test(haystack)
  ) {
    push(
      "Tighten AWS security group ingress",
      "Remove or narrow the public/open ingress rule on the implicated security group; prefer least-privilege CIDRs or prefix lists.",
      "AWS SG / network exposure path — human or IaC applies the change; Periscan only revalidates.",
      "Terraform: aws_security_group / aws_security_group_rule (or aws_vpc_security_group_ingress_rule). CloudFormation: AWS::EC2::SecurityGroup."
    );
  }

  if (
    /network.?pol|netpol|k8s|kubernetes|pod.?to.?pod|cluster.?cidr/i.test(
      haystack
    )
  ) {
    push(
      "Apply Kubernetes NetworkPolicy deny-by-default",
      "Add or tighten a NetworkPolicy (or Cilium/Calico equivalent) so only intended namespaces/pods can reach the target service.",
      "K8s lateral/network path — operator applies NetPol; Periscan revalidates connectivity exposure.",
      "Manifest: networking.k8s.io/v1 NetworkPolicy. Terraform: kubernetes_manifest / helm chart values."
    );
  }

  if (
    /okta|idp|sso|mfa|saml|oidc|identity.?provider|app.?assignment/i.test(
      haystack
    )
  ) {
    push(
      "Restrict Okta / IdP policy and assignments",
      "Tighten sign-on policy, MFA requirements, and application assignments for the implicated group or app; revoke stale sessions.",
      "Identity path — policy change is human/IdP admin; Periscan revalidates with authorized identity checks.",
      "Okta: App Sign On Policy + Group Rules (API/Terraform okta_app_signon_policy). No Periscan live IdP write."
    );
  }

  if (/firewall|waf|cloud.?armor|nsg|azure.?firewall/i.test(haystack)) {
    push(
      "Update firewall / WAF allowlist (operator-owned)",
      "Apply the reviewed deny or restrict rule in the customer firewall/WAF control plane (or its IaC). Periscan does not push this rule.",
      "Network control path — auto-revalidate measures after the human/IaC change; actionApplied stays false on revalidate.",
      "Terraform/provider for the WAF or NSG product in use; open a GitHub PR via Infrastructure proof loop when repo-backed."
    );
  }

  return templates;
}

function iacHintForStep(step: string): string | undefined {
  if (/security.?group|aws.?sg|\bsg-/i.test(step)) {
    return "Terraform: aws_security_group_rule / aws_vpc_security_group_ingress_rule.";
  }
  if (/network.?pol|netpol|kubernetes|k8s/i.test(step)) {
    return "Kubernetes NetworkPolicy manifest or Terraform kubernetes_manifest.";
  }
  if (/okta|idp|sso|mfa|saml/i.test(step)) {
    return "Okta app sign-on policy / group assignment (Terraform okta_* or Admin Console).";
  }
  if (/firewall|waf|ingress|nsg/i.test(step)) {
    return "Provider firewall/WAF resource or GitHub PR for the controlling IaC file.";
  }
  if (/secret|credential|token|key/i.test(step)) {
    return "Rotate in secret manager; update Terraform/Vault reference if repo-backed.";
  }
  if (/role|iam|permission|policy/i.test(step)) {
    return "IAM/IdP policy document or Terraform aws_iam_*/azuread_* equivalent.";
  }
  return undefined;
}

export function generatePrescriptivePlanFromVerdict(input: {
  remediationId?: string;
  recommendedAction: string;
  technicalSteps: string[];
  pathLabels?: string[];
  riskBand?: string;
}): PrescriptivePlan {
  const haystack = [
    input.recommendedAction,
    ...input.technicalSteps,
    ...(input.pathLabels ?? [])
  ].join(" ");

  const steps: MitigationStep[] = [];
  const stackSteps = stackAwareTemplates(haystack);
  // Prefer stack templates when they match; otherwise use recorded technical steps.
  const baseSteps =
    stackSteps.length > 0
      ? stackSteps
      : (input.technicalSteps.length > 0
          ? input.technicalSteps
          : [
              "Apply recommended action to break the path (human or IaC — not Periscan push).",
              "Update related configuration or IaC via your change process.",
              "Re-validate and capture before/after evidence."
            ]
        ).map((step, i) => ({
          order: i + 1,
          title: step.length > 60 ? step.slice(0, 57) + "..." : step,
          action: step,
          rationale: `Derived from verdict action: ${input.recommendedAction}.`,
          iacHint: iacHintForStep(step),
          safety: "safe" as const
        }));

  if (stackSteps.length > 0) {
    // When stack templates fire, still surface original technical steps if distinct.
    steps.push(...stackSteps);
    const seen = new Set(stackSteps.map((s) => s.action.toLowerCase()));
    for (const step of input.technicalSteps) {
      if (!seen.has(step.toLowerCase())) {
        steps.push({
          order: steps.length + 1,
          title: step.length > 60 ? step.slice(0, 57) + "..." : step,
          action: step,
          rationale: `Recorded technical step for: ${input.recommendedAction}.`,
          iacHint: iacHintForStep(step),
          safety: "safe"
        });
      }
    }
  } else {
    steps.push(...baseSteps);
  }

  // Closed-loop revalidation step — measurement only, not control push.
  steps.push({
    order: steps.length + 1,
    title: "Auto-revalidate (measured re-test)",
    action:
      "Trigger FixVerification + targeted re-run with before/after evidence. Does not apply configuration.",
    rationale:
      "Fixed status requires verification evidence. Auto-revalidate measures; it never pushes WAF/SG/firewall rules.",
    safety: "safe"
  });
  return {
    remediationId: input.remediationId,
    objective:
      input.recommendedAction ||
      "Close the validated exposure via operator/IaC fix, then revalidate.",
    steps,
    source: "operator",
    generatedAt: new Date().toISOString()
  };
}

// D-track integrations: simulator + playbooks + tripwires + trending wired to RemOps/FixVerification/reports
export function runRemediationSimulator(
  input: RemediationSimulationInput & { riskScore?: number }
): RemediationSimulationResult {
  const simInput: RemediationSimulationInput = {
    remediationId: input.remediationId,
    currentRiskBand: "High",
    currentRiskScore: input.riskScore ?? 72,
    pathSummary: input.proposedFix,
    proposedFix: input.proposedFix,
    relatedPathId: input.relatedPathId
  };
  return simulateRemediationWhatIf(simInput);
}

export function generateAutoPlaybooks(
  remediation: PlaybookRemediationInput
): PlaybookArtifacts {
  return generateReviewableRemediationTemplates(remediation);
}

export function createTripwireForRemediation(remediationId: string, pathKey?: string): TripwireConfig {
  return createTripwireBehavioralDetector(remediationId, pathKey || "attack-path");
}

export function getFixEffectivenessTrends(
  past: PastFixEffectivenessInput[]
): FixEffectivenessTrend[] {
  return computeFixEffectivenessTrending(past);
}
