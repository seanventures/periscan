"use client";

import {
  isCommunityPermissiveSpdx,
  type SecurityFeedContentVersionStatus,
  type SecurityFeedOperatorItem,
  type SecurityFeedPin
} from "@periscan/shared";

import { useApiResource } from "../hooks/use-api-resource";
import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  Panel,
  PanelHeader,
  StateBadge,
  type StateTone
} from "../ui";

const STATUS_TONE: Record<SecurityFeedContentVersionStatus, StateTone> = {
  Current: "validated",
  PendingReview: "approval",
  Rejected: "blocked"
};

function formatPin(pin: SecurityFeedPin): string {
  if (pin.kind === "unpinned" || pin.value == null) {
    return "unpinned";
  }
  return pin.value;
}

function formatDigest(digest: string | null): string {
  if (!digest) {
    return "—";
  }
  return digest.slice(0, 12);
}

function communityPackLabel(item: SecurityFeedOperatorItem): string {
  if (isCommunityPermissiveSpdx(item.spdxLicenseId)) {
    return "allowed";
  }
  if (item.id === "rustinel-rules" || item.spdxLicenseId.includes("DRL")) {
    return "fail-closed · DRL";
  }
  return "fail-closed";
}

export function SecurityFeedPinReview() {
  const feeds = useApiResource(() => api.listSecurityFeeds(), []);
  const items = feeds.data ?? [];
  const pendingCount = items.filter(
    (item) => item.contentVersionStatus === "PendingReview"
  ).length;

  return (
    <Panel aria-labelledby="security-feed-pins-heading">
      <PanelHeader
        titleId="security-feed-pins-heading"
        title="Recorded pins"
        actions={
          <StateBadge tone={pendingCount > 0 ? "approval" : "validated"} dot>
            {pendingCount} PendingReview
          </StateBadge>
        }
      />
      <div className="flex flex-col gap-3 p-4">
        <p className="text-sm text-muted">
          Toolchain-bound content pins. PendingReview holds the recorded pin.
          Executable pins stay not flipped until review. YAML is never
          evaluated. Community pack DRL (rustinel-rules) stays fail-closed.
        </p>
        {feeds.loading && !feeds.data ? (
          <LoadingSkeleton rows={6} label="Loading security-feed pins…" />
        ) : feeds.error ? (
          <ErrorState message={feeds.error} onRetry={feeds.refetch} />
        ) : items.length === 0 ? (
          <EmptyState
            title="No security-feed pins returned"
            description="The listing is empty. This is not an executable catalog and does not invent pins."
          />
        ) : (
          <div className="overflow-x-auto">
            <table
              className="ps-table ps-table--compact w-full text-left text-sm"
              aria-label="Security-feed pins"
            >
              <caption className="sr-only">Security-feed pins</caption>
              <thead>
                <tr className="border-b border-line text-subtle">
                  <th scope="col" className="font-medium">
                    Feed
                  </th>
                  <th scope="col" className="font-medium">
                    SPDX
                  </th>
                  <th scope="col" className="font-medium">
                    Recorded pin
                  </th>
                  <th scope="col" className="font-medium">
                    Digest
                  </th>
                  <th scope="col" className="font-medium">
                    Content version
                  </th>
                  <th scope="col" className="font-medium">
                    Executable pin
                  </th>
                  <th scope="col" className="font-medium">
                    Community pack
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-line last:border-0">
                    <th
                      scope="row"
                      className="font-mono text-[13px] font-semibold text-ink"
                    >
                      {item.id}
                    </th>
                    <td className="font-mono text-[12px] text-muted">
                      {item.spdxLicenseId}
                    </td>
                    <td className="font-mono text-[12px] text-ink">
                      <span className="text-subtle">{item.pin.kind}</span>{" "}
                      {formatPin(item.pin)}
                    </td>
                    <td className="font-mono text-[12px] text-muted">
                      {formatDigest(item.lastDigest)}
                    </td>
                    <td>
                      <StateBadge
                        tone={STATUS_TONE[item.contentVersionStatus]}
                      >
                        {item.contentVersionStatus}
                      </StateBadge>
                    </td>
                    <td className="text-[12px] text-muted">
                      not flipped
                    </td>
                    <td>
                      <StateBadge
                        tone={
                          isCommunityPermissiveSpdx(item.spdxLicenseId)
                            ? "validated"
                            : "blocked"
                        }
                        variant="outline"
                        dot={false}
                      >
                        {communityPackLabel(item)}
                      </StateBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Panel>
  );
}
