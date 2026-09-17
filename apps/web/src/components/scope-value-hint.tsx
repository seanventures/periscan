/**
 * Honest paste hint for hosted GitHub URLs. Control-plane Verify reads a local
 * clone path, not github.com/org/repo. Does not change type inference. Add and
 * Verify are refused; the URL is not a PENDING identifier.
 */

import { looksLikeHostedGitHubUrl } from "@periscan/shared";

export { looksLikeHostedGitHubUrl };

export const HOSTED_GITHUB_SCOPE_HINT =
  "The control plane verifies a local clone path it can read, not github.com/org/repo. Paste an absolute path such as /opt/customer/repo. Hosted GitHub URLs cannot be added or verified here. Attest is runner-only, not a skip.";

export function ScopeValueHint({ value }: { value: string }) {
  if (!looksLikeHostedGitHubUrl(value)) {
    return null;
  }

  return (
    <p
      role="note"
      aria-live="polite"
      data-testid="scope-value-hosted-github-hint"
      className="max-w-prose border-l-2 border-brand/50 pl-3 text-[12.5px] leading-5 text-muted"
    >
      <span className="mb-0.5 block font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-2">
        Hosted GitHub URL
      </span>
      {HOSTED_GITHUB_SCOPE_HINT}
    </p>
  );
}
