import Link from "next/link";

import { ExternalValidationProfiles } from "../../src/components/external-validation-profiles";
import { PageHeader, PageShell, buttonClassName } from "../../src/ui";

export default function ExternalValidationPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Authorized safe observations"
        title="Validate the outside view—safely."
        description="Bind a verified internet-facing target to policy, run a server-owned GET-only observation profile (headers, fingerprint, public metadata), and carry normalized evidence into remediation and a fresh re-test. This is not a full external ASV scan, crawl, auth fuzz, exploit pack, or pentest."
        actions={
          <>
            <Link
              className={buttonClassName({ size: "sm", variant: "secondary" })}
              href="/validation-ops"
            >
              Validation Ops
            </Link>
            <Link
              className={buttonClassName({ size: "sm", variant: "secondary" })}
              href="/registries"
            >
              Registries
            </Link>
          </>
        }
      />
      <ExternalValidationProfiles />
    </PageShell>
  );
}
