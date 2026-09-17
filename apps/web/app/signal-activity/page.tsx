import Link from "next/link";

import { SignalActivityStream } from "../../src/components/signal-activity-stream";
import { PageHeader, PageShell, buttonClassName } from "../../src/ui";

export default async function SignalActivityPage({
  searchParams
}: {
  searchParams: Promise<{ signalId?: string }>;
}) {
  const { signalId } = await searchParams;
  return (
    <PageShell>
      <PageHeader
        eyebrow="Signal activity"
        title="Signal-driven validation in one activity stream."
        description="Periscan evaluates CVE, asset-change, policy-change, and missed-detection triggers against tenant state via /api/v1/signal-triggers, surfaces readiness gaps, and records every non-queueing evaluation in the activity stream. Approving a ready trigger creates a policy decision and a draft mission only."
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
              href="/findings"
            >
              Findings
            </Link>
            <Link
              className={buttonClassName({ size: "sm", variant: "secondary" })}
              href="/missions"
            >
              Missions & runs
            </Link>
          </>
        }
      />
      <SignalActivityStream initialSignalId={signalId ?? ""} />
    </PageShell>
  );
}
