/**
 * Honest paste hint for hosted GitHub URLs. Control-plane Verify reads a local
 * clone path, not github.com/org/repo. Does not change type inference.
 */

export const HOSTED_GITHUB_SCOPE_HINT =
  "The control plane verifies a local clone it can read. Hosted GitHub URLs stay pending until a runner has the repo. Attest is runner-only, not a skip.";

export function looksLikeHostedGitHubUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  const rest = (
    (
      trimmed.includes("://")
        ? trimmed.slice(trimmed.indexOf("://") + 3)
        : trimmed
    ).split(/[?#]/u)[0] ?? ""
  );
  const slash = rest.indexOf("/");
  if (slash === -1) {
    return false;
  }
  const hostToken = rest.slice(0, slash);
  const host = (
    (
      hostToken.includes("@")
        ? hostToken.slice(hostToken.lastIndexOf("@") + 1)
        : hostToken
    ).split(":")[0] ?? ""
  )
    .toLowerCase()
    .replace(/^www\./u, "");
  if (host !== "github.com" && !host.endsWith(".github.com")) {
    return false;
  }
  const segments = rest
    .slice(slash + 1)
    .split("/")
    .filter((segment) => segment.length > 0);
  return segments.length >= 2;
}

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
