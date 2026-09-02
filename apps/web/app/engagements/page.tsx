import Link from "next/link";

import { EngagementWorkbench } from "../../src/components/engagement-workbench";
import { PageHeader, PageShell, buttonClassName } from "../../src/ui";

export default function EngagementsPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Autonomous Engagements"
        title="Run the governed validation loop."
        description="Launch a multi-step autonomous engagement over a verified scope. Every step is dispatched through the same policy + approval + audit path as the rest of the platform; offensive steps require explicit authorization and default to a dry-run plan."
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
              href="/validation-ops"
            >
              Validation Ops
            </Link>
          </>
        }
      />
      <EngagementWorkbench />
    </PageShell>
  );
}
