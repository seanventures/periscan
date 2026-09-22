"use client";

import { useMemo, useState } from "react";

import type { Scope } from "@periscan/shared";

import { useApiResource } from "../hooks/use-api-resource";
import {
  IDENTITY_ABUSE_BLOCKED_NOTE,
  INVASIVE_VALIDATE_BLOCKED_NOTE,
  discoveryCandidateValidateGate,
  honestApiEmpty,
  pendingPromoteCandidates,
  scopeTypeForCandidateHostname
} from "../lib/continuous-external-operator";
import {
  PeriscanApiClientError,
  browserPeriscanApiClient as api
} from "../lib/periscan-api-client";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  Panel,
  PanelHeader,
  StateBadge,
  buttonClassName
} from "../ui";

export function DiscoveryCandidates() {
  const ownership = useApiResource(() => api.getAssetOwnershipSurface(), []);
  const scopes = useApiResource(() => api.listScopes(), []);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [promoted, setPromoted] = useState<Record<string, Scope>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  const candidates = useMemo(() => {
    const entries = ownership.data?.entries ?? [];
    const pending = pendingPromoteCandidates(
      entries.map((entry) => ({
        assetId: entry.asset.assetId,
        hostnames: entry.hostnames,
        name: entry.asset.name,
        ownershipStatus: entry.ownershipStatus,
        reviewDisposition: entry.review?.disposition ?? null
      }))
    );
    return pending.map((item) => {
      const source = entries.find(
        (entry) => entry.asset.assetId === item.assetId
      );
      const hostname = item.hostnames[0] ?? item.name;
      const matchingScope =
        promoted[item.assetId] ??
        (scopes.data ?? []).find(
          (scope) =>
            scope.value.trim().toLowerCase() === hostname.trim().toLowerCase()
        ) ??
        null;
      return { item, hostname, matchingScope, source };
    });
  }, [ownership.data, promoted, scopes.data]);

  async function promote(assetId: string, hostname: string) {
    setPromotingId(assetId);
    setActionError(null);
    try {
      const scope = await api.createScope({
        scopeType: scopeTypeForCandidateHostname(hostname),
        value: hostname
      });
      setPromoted((current) => ({ ...current, [assetId]: scope }));
      await scopes.refetch();
    } catch (caught) {
      if (caught instanceof PeriscanApiClientError && caught.status === 404) {
        setActionError("Promote to pending scope is not available from the API.");
      } else {
        setActionError(
          caught instanceof Error
            ? caught.message
            : "Unable to promote this candidate."
        );
      }
    } finally {
      setPromotingId(null);
    }
  }

  return (
    <Panel aria-label="Discovery candidates">
      <PanelHeader title="Discovery candidates" />
      {ownership.loading ? (
        <LoadingSkeleton rows={3} />
      ) : honestApiEmpty(ownership.errorStatus) ? (
        <div className="p-4" data-testid="discovery-candidates-empty">
          <EmptyState
            title="Discovery candidates not available"
            description="Discovery candidates are not available from the API."
          />
        </div>
      ) : ownership.error ? (
        <ErrorState message={ownership.error} onRetry={ownership.refetch} />
      ) : candidates.length === 0 ? (
        <div className="p-4 text-sm text-muted">
          No discovery candidates pending promote-to-scope.
        </div>
      ) : (
        <div>
          <p className="border-b border-line px-4 py-3 text-xs leading-5 text-muted">
            Unattributed hosts stay pending promote-to-scope. Connected Entra,
            Okta, and JumpCloud inventory is CAASM candidates, not verified
            scope. Promoting creates a Pending authorized target — it does not
            verify ownership. {IDENTITY_ABUSE_BLOCKED_NOTE}
          </p>
          {actionError ? (
            <p className="px-4 pt-3 text-sm text-missed" role="alert">
              {actionError}
            </p>
          ) : null}
          <ol className="divide-y divide-line">
            {candidates.map(({ item, hostname, matchingScope }) => {
              const gate = discoveryCandidateValidateGate({
                verificationStatus: matchingScope?.verificationStatus ?? null
              });
              return (
                <li key={item.assetId} className="flex flex-col gap-3 px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">{hostname}</p>
                      <p className="mt-1 text-xs text-muted">
                        pending promote-to-scope
                      </p>
                    </div>
                    {matchingScope ? (
                      <StateBadge
                        tone={
                          matchingScope.verificationStatus === "Verified"
                            ? "fixed"
                            : "approval"
                        }
                      >
                        {matchingScope.verificationStatus}
                      </StateBadge>
                    ) : (
                      <button
                        type="button"
                        disabled={promotingId === item.assetId}
                        onClick={() => void promote(item.assetId, hostname)}
                        className={buttonClassName({
                          size: "sm",
                          variant: "secondary"
                        })}
                      >
                        {promotingId === item.assetId
                          ? "Promoting…"
                          : "Promote to pending scope"}
                      </button>
                    )}
                  </div>
                  {gate.canValidateInvasive ? null : (
                    <p
                      className="text-xs leading-5 text-muted"
                      data-testid="discovery-invasive-gate"
                    >
                      {INVASIVE_VALIDATE_BLOCKED_NOTE}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </Panel>
  );
}
