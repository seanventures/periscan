import Link from "next/link";
import { Suspense } from "react";

import { PolicyApprovalsPanel } from "../../src/components/policy-approvals-panel";
import {
  LoadingSkeleton,
  PageHeader,
  PageShell,
  Panel,
  buttonClassName
} from "../../src/ui";

export const metadata = {
  title: "Policies — Periscan"
};

/**
 * Policies is the govern entry for pending authorization decisions (Needs you
 * "Policy approvals waiting" deep-links here with `?approvalState=Pending`).
 * Live safety boundaries, audit, retention, and runner constraints live on
 * `/trust-safety` (single TrustSafetyDashboard v2 surface) — not a second clone.
 */
export default function PoliciesPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Policies"
        title="Control what validation is allowed."
        description="Record pending policy decisions for governed missions, then review live safety posture on Trust & Safety. Denied tasks are never queued."
        actions={
          <>
            <Link
              className={buttonClassName({ size: "sm", variant: "primary" })}
              href="#policy-approvals"
            >
              Pending approvals
            </Link>
            <Link
              className={buttonClassName({ size: "sm", variant: "secondary" })}
              href="/trust-safety"
            >
              Open Trust &amp; Safety
            </Link>
            <Link
              className={buttonClassName({ size: "sm", variant: "secondary" })}
              href="/api-reference"
            >
              API reference
            </Link>
          </>
        }
      />

      <Suspense
        fallback={
          <Panel>
            <LoadingSkeleton rows={4} label="Loading policy approvals…" />
          </Panel>
        }
      >
        <PolicyApprovalsPanel />
      </Suspense>

      <Panel>
        <div className="flex flex-col gap-3 p-5">
          <p className="text-sm leading-6 text-muted">
            Periscan validates only customer-authorized scope under policy
            gates. Fixed status requires a verification event. Use Trust &amp;
            Safety for the API-backed summary of principles, runner security
            model, identity lifecycle, and connected-system health.
          </p>
          <ul className="list-none space-y-2 text-sm text-ink">
            <li className="flex gap-2">
              <span className="text-brand" aria-hidden>
                →
              </span>
              <span>
                <Link
                  href="/trust-safety"
                  className="font-semibold text-brand hover:text-brand-2"
                >
                  Trust &amp; Safety
                </Link>{" "}
                — live safety posture and audit path
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand" aria-hidden>
                →
              </span>
              <span>
                <Link
                  href="/missions"
                  className="font-semibold text-brand hover:text-brand-2"
                >
                  Validate
                </Link>{" "}
                — policy preview before a validation run
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand" aria-hidden>
                →
              </span>
              <span>
                <Link
                  href="/audit"
                  className="font-semibold text-brand hover:text-brand-2"
                >
                  Audit
                </Link>{" "}
                — filterable event log
              </span>
            </li>
          </ul>
        </div>
      </Panel>
    </PageShell>
  );
}
