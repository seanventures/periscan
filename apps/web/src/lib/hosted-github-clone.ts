/**
 * Copy-paste `git clone` for a hosted GitHub URL paste.
 * UI refuse only — not GitHub OAuth and not an API-side clone.
 */

import { looksLikeHostedGitHubUrl } from "@periscan/shared";

export const HOSTED_GITHUB_CLONE_FOLLOW_UP =
  "then paste the local path (this GitHub URL is not a control-plane identifier).";

const GITHUB_ORG_REPO =
  /(?:https?:\/\/)?(?:[^/\s@]+@)?(?:www\.)?github\.com[:/]+([^/\s]+)\/([^/\s?#]+)/iu;

export function hostedGitHubCloneUrl(paste: string): string | null {
  if (!looksLikeHostedGitHubUrl(paste)) {
    return null;
  }
  const match = paste.trim().match(GITHUB_ORG_REPO);
  const org = match?.[1];
  const repo = match?.[2]?.replace(/\.git$/iu, "");
  if (!org || !repo) {
    return null;
  }
  return `https://github.com/${org}/${repo}.git`;
}

export function hostedGitHubCloneCommand(paste: string): string | null {
  const url = hostedGitHubCloneUrl(paste);
  return url ? `git clone ${url}` : null;
}
