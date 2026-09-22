import { SecurityFeedPinReview } from "../../src/components/security-feed-pin-review";
import { PageHeader, PageShell } from "../../src/ui";

export const metadata = {
  title: "Feed pins — Periscan"
};

/**
 * Operator listing for toolchain-bound security-feed pins.
 * PendingReview does not flip executable pins. YAML is never evaluated.
 * Not a Home / first-hour Gitleaks door.
 */
export default function SecurityFeedsPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Setup · Feed pins"
        title="Review recorded security-feed pins."
        description="Newer upstream becomes PendingReview. The recorded pin stays until review. Executable pins are not flipped. YAML is never evaluated. rustinel-rules DRL stays fail-closed for the Community pack."
      />
      <SecurityFeedPinReview />
    </PageShell>
  );
}
