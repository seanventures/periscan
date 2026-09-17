import { describe, expect, it } from "vitest";

import { generatePrescriptivePlanFromVerdict } from "./remediation";

describe("generatePrescriptivePlanFromVerdict (Wave E)", () => {
  it("always ends with auto-revalidate measurement step (no config push language)", () => {
    const plan = generatePrescriptivePlanFromVerdict({
      remediationId: "11111111-1111-4111-8111-111111111111",
      recommendedAction: "Break the path",
      technicalSteps: ["Remove the edge"]
    });
    const last = plan.steps[plan.steps.length - 1];
    expect(last?.title.toLowerCase()).toMatch(/auto-revalidate|revalidat/);
    expect(last?.action.toLowerCase()).toMatch(/does not apply configuration/);
    expect(plan.steps.every((s) => s.safety === "safe")).toBe(true);
  });

  it("adds AWS security group stack template with Terraform iacHint", () => {
    const plan = generatePrescriptivePlanFromVerdict({
      recommendedAction: "Close public AWS security group ingress",
      technicalSteps: ["Review SG-0abc open 0.0.0.0/0"]
    });
    const sg = plan.steps.find((s) => /security group/i.test(s.title));
    expect(sg).toBeDefined();
    expect(sg?.iacHint).toMatch(/aws_security_group|Terraform/i);
  });

  it("adds Kubernetes NetworkPolicy stack template", () => {
    const plan = generatePrescriptivePlanFromVerdict({
      recommendedAction: "Restrict pod-to-pod reachability",
      technicalSteps: [],
      pathLabels: ["k8s cluster lateral", "missing NetworkPolicy"]
    });
    expect(plan.steps.some((s) => /NetworkPolicy/i.test(s.title))).toBe(true);
    expect(
      plan.steps.some((s) => s.iacHint && /NetworkPolicy|kubernetes/i.test(s.iacHint))
    ).toBe(true);
  });

  it("adds Okta / IdP stack template", () => {
    const plan = generatePrescriptivePlanFromVerdict({
      recommendedAction: "Tighten Okta app assignment and MFA",
      technicalSteps: ["Review SSO policy for admin app"]
    });
    expect(plan.steps.some((s) => /Okta|IdP/i.test(s.title))).toBe(true);
  });

  it("never claims Periscan pushes WAF/firewall rules in revalidate step", () => {
    const plan = generatePrescriptivePlanFromVerdict({
      recommendedAction: "Add WAF rule for the public API",
      technicalSteps: ["Draft cloud armor / WAF deny"]
    });
    const joined = plan.steps.map((s) => `${s.title} ${s.action} ${s.rationale}`).join(" ");
    expect(joined.toLowerCase()).toMatch(/does not push|never pushes|operator-owned|auto-revalidate/);
    expect(joined.toLowerCase()).not.toMatch(/periscan will push the waf/);
  });
});
