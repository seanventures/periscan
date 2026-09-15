import Link from "next/link";

import { BlueShiftBriefPanel } from "../../src/components/blue-shift-brief";
import { PageHeader, PageShell, buttonClassName } from "../../src/ui";

export const metadata = {
  title: "Blue shift — Periscan"
};

export default function BlueShiftPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Operate"
        title="Blue shift"
        description="One refresh for validated program health at the start of the shift. Deep links only — Periscan sits beside SIEM/ITSM, it does not replace them."
        actions={
          <Link
            href="/findings"
            data-testid="shift-header-primary-cta"
            className={buttonClassName({
              size: "md",
              variant: "primary",
              className: "min-h-11 min-w-[7rem] px-4 py-2.5"
            })}
          >
            Start triage
          </Link>
        }
      />
      <BlueShiftBriefPanel />
    </PageShell>
  );
}
