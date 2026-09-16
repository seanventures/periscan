import Link from "next/link";

import { AsyncOperationsControlRoom } from "../../src/components/async-operations-control-room";
import { ValidationOpsDashboard } from "../../src/components/validation-ops-dashboard";
import { PageHeader, PageShell, buttonClassName } from "../../src/ui";

export default function ValidationOpsPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Operate"
        title="Queue operations"
        description="Monitor tenant validation jobs and signed runner leases, reconcile objectively stale work, and prepare policy-gated recovery drafts without silent replay."
        actions={
          <>
            <Link
              className={buttonClassName({ size: "sm", variant: "secondary" })}
              href="/"
            >
              Back to workspace
            </Link>
            <Link
              className={buttonClassName({ size: "sm", variant: "secondary" })}
              href="/api-reference"
            >
              API reference
            </Link>
            <Link
              className={buttonClassName({ size: "sm", variant: "secondary" })}
              href="/trust-safety"
            >
              Trust & safety
            </Link>
          </>
        }
      />
      <AsyncOperationsControlRoom />
      <details className="group overflow-hidden rounded-card border border-line bg-surface">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 sm:px-5">
          <span>
            <span className="block font-display text-sm font-semibold text-ink">
              Full API proof inventory
            </span>
            <span className="mt-1 block text-xs leading-5 text-muted">
              Expand the broader validation, remediation, evidence, CTEM, and
              usage diagnostics when you need them.
            </span>
          </span>
          <span
            aria-hidden
            className="shrink-0 text-muted transition-transform group-open:rotate-45"
          >
            +
          </span>
        </summary>
        <div className="border-t border-line">
          <ValidationOpsDashboard />
        </div>
      </details>
    </PageShell>
  );
}
