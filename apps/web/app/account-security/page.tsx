import Link from "next/link";

import { AccountSecurity } from "../../src/components/account-security";
import { PageHeader, PageShell, buttonClassName } from "../../src/ui";

export default function AccountSecurityPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Account security"
        title="Protect your account."
        description="Manage multi-factor authentication for your Periscan account — enroll an authenticator, save single-use recovery codes, and disable MFA, all through the tenant-scoped auth API."
        actions={
          <Link
            className={buttonClassName({ size: "sm", variant: "secondary" })}
            href="/trust-safety"
          >
            Trust &amp; Safety
          </Link>
        }
      />
      <AccountSecurity />
    </PageShell>
  );
}
