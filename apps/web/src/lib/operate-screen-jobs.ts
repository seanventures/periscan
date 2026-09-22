/**
 * One job per Operate spine screen. Secondary kitchen (CTEM, Connect, BAS)
 * stays under Setup / More — not these sentences.
 */
export const OPERATE_SCREEN_JOBS = [
  {
    href: "/dashboard",
    job: "keep proving: authorized local path → Gitleaks-class → Fixed after retest"
  },
  {
    href: "/scopes",
    job: "Authorize a local path, then verify"
  },
  {
    href: "/missions",
    job: "Run Gitleaks-class on verified scope"
  },
  {
    href: "/findings",
    job: "Review the VALIDATED path · rule"
  },
  {
    href: "/remediation",
    job: "Create remediations, then Re-verify"
  },
  {
    href: "/evidence",
    job: "Read the receipts"
  },
  {
    href: "/schedules",
    job: "Keep Gitleaks-class on a cadence"
  }
] as const;

export type OperateScreenHref = (typeof OPERATE_SCREEN_JOBS)[number]["href"];

export function operateScreenJob(href: string): string | undefined {
  return OPERATE_SCREEN_JOBS.find((row) => row.href === href)?.job;
}

export function operateHint(href: OperateScreenHref): string {
  const job = operateScreenJob(href);
  if (!job) {
    throw new Error(`missing Operate job for ${href}`);
  }
  return job;
}
