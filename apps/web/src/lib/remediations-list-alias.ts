/**
 * Plural `/remediations` is a list alias of `/remediation`.
 * Detail stays `/remediation/:id` — this helper never rewrites that.
 */
export function remediationsListAliasTarget(
  pathname: string,
  search = ""
): string | null {
  const path = pathname.replace(/\/+$/u, "") || "/";
  if (path !== "/remediations") {
    return null;
  }
  if (!search) {
    return "/remediation";
  }
  const query = search.startsWith("?") ? search : `?${search}`;
  return `/remediation${query}`;
}
