"use client";

import { useEffect, useState } from "react";

import {
  LOCALE_LABELS,
  type LocalizationFormatPreview,
  type SupportedLocale
} from "@periscan/shared";

import { useApiResource } from "../hooks/use-api-resource";
import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import {
  ErrorState,
  LoadingSkeleton,
  StateBadge,
  buttonClassName,
  cn
} from "../ui";

const TIME_ZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney"
];

const inputClass =
  "h-10 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none placeholder:text-subtle focus:border-brand";

function formatDate(value: string | null) {
  if (!value) return "Not reviewed";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function LocalizationReleaseWorkspace() {
  const workspace = useApiResource(
    () => api.getTenantLocalizationWorkspace(),
    []
  );
  const [locale, setLocale] = useState<SupportedLocale>("en-US");
  const [timeZone, setTimeZone] = useState("UTC");
  const [supportOwnerEmail, setSupportOwnerEmail] = useState("");
  const [reviewReference, setReviewReference] = useState("");
  const [reviewReason, setReviewReason] = useState(
    "Reviewed the product-shell and report catalogs, formatting preview, fallback boundary, and support ownership."
  );
  const [preview, setPreview] = useState<LocalizationFormatPreview | null>(
    null
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!workspace.data) return;
    setLocale(workspace.data.localization.preferredLocale);
    setTimeZone(workspace.data.localization.preferredTimeZone);
    setSupportOwnerEmail(workspace.data.localization.supportOwnerEmail ?? "");
    setReviewReference(workspace.data.localization.reviewReference ?? "");
    setPreview(workspace.data.formatPreview);
  }, [workspace.data]);

  async function run(
    key: string,
    action: () => Promise<void>,
    success: string
  ) {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(success);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The localization action did not complete."
      );
    } finally {
      setBusy(null);
    }
  }

  async function previewFormatting() {
    await run(
      "preview",
      async () => {
        setPreview(await api.previewTenantLocalization({ locale, timeZone }));
      },
      "Preview refreshed without changing the tenant policy."
    );
  }

  async function activate() {
    await run(
      "activate",
      async () => {
        await api.updateTenantLocalization({
          preferredLocale: locale,
          reviewReason: reviewReason.trim(),
          reviewReference: reviewReference.trim(),
          supportOwnerEmail: supportOwnerEmail.trim(),
          timeZone
        });
        await workspace.refetch();
        window.dispatchEvent(new Event("periscan:localization-updated"));
      },
      "Reviewed localization release activated; navigation updated in place."
    );
  }

  const activeCatalog = workspace.data?.catalogs.find(
    (catalog) => catalog.locale === locale
  );

  return (
    <section
      aria-labelledby="localization-release-heading"
      className="border-y border-line py-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-2">
            Localization operations · governed catalog
          </p>
          <h2
            className="mt-1 font-display text-lg font-semibold text-ink"
            id="localization-release-heading"
          >
            Language release desk
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            Preview regional formatting, verify catalog coverage, and activate
            one reviewed presentation policy without changing evidence or data
            residency.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StateBadge
            dot={false}
            tone={
              workspace.data?.localization.activeReleaseId
                ? "fixed"
                : "approval"
            }
          >
            {workspace.data?.localization.activeReleaseId
              ? "Reviewed release"
              : "Review required"}
          </StateBadge>
          <StateBadge dot={false} tone="brand">
            {workspace.data?.localization.catalogVersion ?? "Loading"}
          </StateBadge>
        </div>
      </div>

      {workspace.loading && !workspace.data ? (
        <div className="mt-5">
          <LoadingSkeleton rows={5} />
        </div>
      ) : workspace.error || !workspace.data ? (
        <div className="mt-5">
          <ErrorState
            message={
              workspace.error ?? "Localization operations are unavailable."
            }
            onRetry={workspace.refetch}
          />
        </div>
      ) : (
        <>
          {error ? (
            <p className="mt-4 text-sm text-missed" role="alert">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="mt-4 text-sm text-fixed" role="status">
              {message}
            </p>
          ) : null}

          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,0.72fr)]">
            <div className="min-w-0">
              <dl className="grid grid-cols-2 gap-x-5 gap-y-3 border-b border-line pb-4 sm:grid-cols-4">
                <Metric
                  label="Active locale"
                  value={workspace.data.localization.preferredLocale}
                />
                <Metric
                  label="Timezone"
                  value={workspace.data.localization.preferredTimeZone}
                />
                <Metric label="Data region" value={workspace.data.dataRegion} />
                <Metric
                  label="Last review"
                  value={formatDate(workspace.data.localization.reviewedAt)}
                />
              </dl>

              <div className="pt-4">
                <h3 className="text-sm font-semibold text-ink">
                  Preview a release
                </h3>
                <p className="mt-1 text-xs leading-5 text-muted">
                  Preview uses the same Intl runtime contract as activated
                  presentation. It does not mutate the tenant.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <select
                    aria-label="Localization release language"
                    className={inputClass}
                    onChange={(event) =>
                      setLocale(event.target.value as SupportedLocale)
                    }
                    value={locale}
                  >
                    {workspace.data.catalogs.map((catalog) => (
                      <option key={catalog.locale} value={catalog.locale}>
                        {LOCALE_LABELS[catalog.locale]}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label="Localization release timezone"
                    className={inputClass}
                    list="periscan-localization-timezones"
                    onChange={(event) => setTimeZone(event.target.value)}
                    value={timeZone}
                  />
                  <datalist id="periscan-localization-timezones">
                    {TIME_ZONES.map((zone) => (
                      <option key={zone} value={zone} />
                    ))}
                  </datalist>
                </div>
                <button
                  className={cn(
                    buttonClassName({ size: "sm", variant: "secondary" }),
                    "mt-2"
                  )}
                  disabled={busy !== null || timeZone.trim().length === 0}
                  onClick={() => void previewFormatting()}
                  type="button"
                >
                  {busy === "preview" ? "Previewing…" : "Preview formatting"}
                </button>
              </div>

              {preview ? (
                <div
                  aria-label="Localization format preview"
                  className="mt-5 border-l-2 border-brand pl-4"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">
                    {preview.locale} · {preview.timeZone}
                  </p>
                  <p className="mt-2 font-display text-xl font-semibold text-ink">
                    {preview.dateTime}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs text-muted">
                    <span>{preview.number}</span>
                    <span>{preview.relativeTime}</span>
                  </div>
                </div>
              ) : null}

              <div className="mt-6 border-t border-line pt-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-ink">
                    Catalog assurance
                  </h3>
                  <span className="font-mono text-[10px] text-subtle">
                    {activeCatalog?.catalogDigest.slice(0, 12)}…
                  </span>
                </div>
                <div className="mt-3 divide-y divide-line">
                  {(activeCatalog?.coverage ?? []).map((coverage) => (
                    <div
                      className="grid gap-2 py-3 sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-center"
                      key={coverage.scope}
                    >
                      <span className="text-xs font-semibold text-ink">
                        {coverage.scope === "ProductShell"
                          ? "Product shell"
                          : "Snapshot report"}
                      </span>
                      <div className="h-1.5 overflow-hidden rounded-full bg-line">
                        <div
                          className="h-full rounded-full bg-brand"
                          style={{ width: `${coverage.completionPercent}%` }}
                        />
                      </div>
                      <span className="font-mono text-[10px] text-subtle">
                        {coverage.translatedKeys}/{coverage.totalKeys} ·{" "}
                        {coverage.fallbackKeys.length} fallback
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <aside className="border-t border-line pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <h3 className="text-sm font-semibold text-ink">
                Activate reviewed catalog
              </h3>
              <p className="mt-1 text-xs leading-5 text-muted">
                Activation records immutable review provenance. To roll back,
                preview a prior locale and activate it as a new reviewed
                release.
              </p>
              <div className="mt-3 grid gap-2">
                <input
                  aria-label="Localization support owner email"
                  className={inputClass}
                  onChange={(event) => setSupportOwnerEmail(event.target.value)}
                  placeholder="regional-support@example.com"
                  type="email"
                  value={supportOwnerEmail}
                />
                <input
                  aria-label="Localization review reference"
                  className={inputClass}
                  onChange={(event) => setReviewReference(event.target.value)}
                  placeholder="Reviewed release or ticket reference"
                  value={reviewReference}
                />
                <textarea
                  aria-label="Localization review reason"
                  className="min-h-24 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-subtle focus:border-brand"
                  onChange={(event) => setReviewReason(event.target.value)}
                  value={reviewReason}
                />
                <button
                  className={buttonClassName({ variant: "primary" })}
                  disabled={
                    busy !== null ||
                    !activeCatalog?.readyForActivation ||
                    !supportOwnerEmail.includes("@") ||
                    reviewReference.trim().length < 3 ||
                    reviewReason.trim().length < 10 ||
                    timeZone.trim().length === 0
                  }
                  onClick={() => void activate()}
                  type="button"
                >
                  {busy === "activate"
                    ? "Activating…"
                    : "Activate localization release"}
                </button>
              </div>

              <div className="mt-5 border-t border-line pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
                  Content boundary
                </p>
                <p className="mt-2 text-xs leading-5 text-muted">
                  {workspace.data.contentBoundary}
                </p>
              </div>
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
                  Residency boundary
                </p>
                <p className="mt-2 text-xs leading-5 text-muted">
                  {workspace.data.residencyBoundary}
                </p>
              </div>
            </aside>
          </div>

          <div className="mt-6 border-t border-line pt-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-ink">
                Activation ledger
              </h3>
              <span className="font-mono text-[10px] text-subtle">
                {workspace.data.releaseHistory.length} reviewed releases
              </span>
            </div>
            {workspace.data.releaseHistory.length === 0 ? (
              <p className="mt-3 text-xs leading-5 text-muted">
                The built-in en-US policy is active by default, but it has no
                customer review provenance yet. Preview and activate the first
                governed release.
              </p>
            ) : (
              <ol className="mt-2 divide-y divide-line">
                {workspace.data.releaseHistory.map((release) => (
                  <li
                    className="grid gap-1 py-3 text-xs sm:grid-cols-[3rem_5rem_9rem_minmax(0,1fr)_auto] sm:items-center"
                    key={release.localizationReleaseId}
                  >
                    <span className="font-mono text-subtle">
                      #{release.sequence}
                    </span>
                    <span className="font-semibold text-ink">
                      {release.locale}
                    </span>
                    <span className="truncate text-muted">
                      {release.timeZone}
                    </span>
                    <span className="truncate text-muted">
                      {release.reviewReference} · {release.supportOwnerEmail}
                    </span>
                    <span className="font-mono text-[10px] text-subtle">
                      {release.catalogDigest.slice(0, 10)}…
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-subtle">
        {label}
      </dt>
      <dd
        className="mt-1 truncate text-xs font-semibold text-ink"
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}
