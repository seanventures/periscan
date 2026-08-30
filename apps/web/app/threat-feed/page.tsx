import Link from "next/link";

import { ThreatFeedWorkbench } from "../../src/components/threat-feed-workbench";
import { PageHeader, PageShell, buttonClassName } from "../../src/ui";

export default function ThreatFeedPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Periscan Global Threat Feed"
        title="Public threat intelligence, deduped and kept current."
        description="A consolidated, cross-feed-deduped catalog of world threat data (CVEs, KEV, IOCs, phishing) from public feeds. Sources follow their listed polling cadence, and this workspace refreshes once a minute while visible so fresh correlations surface promptly without claiming a streaming feed."
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
              href="/threat-center"
            >
              Threat Center
            </Link>
          </>
        }
      />
      <ThreatFeedWorkbench />
    </PageShell>
  );
}
