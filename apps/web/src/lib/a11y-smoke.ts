/**
 * Lightweight axe-core helper for vitest + jsdom component smoke gates (UX-W16).
 *
 * This is intentionally narrower than Playwright route scans in
 * tests/e2e/web-accessibility.spec.ts. jsdom does not compute real layout or
 * painted colors, so color-contrast is disabled here. Claims are limited to
 * what axe reports for the rendered DOM fragment under WCAG 2 A/AA tags.
 */

import axe from "axe-core";

export type AxeViolationSummary = {
  id: string;
  impact: string | null | undefined;
  help: string;
  nodes: number;
};

export async function runAxeSmoke(
  container: HTMLElement
): Promise<AxeViolationSummary[]> {
  // axe needs a full document context; scope to the rendered fragment.
  const results = await axe.run(container, {
    runOnly: {
      type: "tag",
      values: ["wcag2a", "wcag2aa"]
    },
    rules: {
      // Requires computed styles / real viewport; covered by Playwright e2e.
      "color-contrast": { enabled: false }
    }
  });

  return results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.length
  }));
}

export function formatAxeViolations(violations: AxeViolationSummary[]): string {
  if (violations.length === 0) {
    return "";
  }
  return violations
    .map(
      (v) =>
        `${v.id} (${v.impact ?? "unknown"}): ${v.help} [${v.nodes} node(s)]`
    )
    .join("\n");
}
