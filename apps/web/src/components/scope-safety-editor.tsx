"use client";

import { useEffect, useMemo, useState } from "react";

import {
  resolveScopeSafetyEnvelope,
  type Scope,
  type ScopeAssetClass,
  type ScopeClassification
} from "@periscan/shared";

import { useApiResource } from "../hooks/use-api-resource";
import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { Button, InlineError, SafetyLevelBadge, StateBadge } from "../ui";

const ASSET_CLASSES: Array<{ label: string; value: ScopeAssetClass }> = [
  { label: "Business application", value: "BusinessApplication" },
  { label: "Cloud", value: "Cloud" },
  { label: "Code / repository", value: "Code" },
  { label: "Identity", value: "Identity" },
  { label: "IT network", value: "Network" },
  { label: "Operational technology (OT)", value: "OT" },
  { label: "IoT", value: "IoT" },
  { label: "Physical", value: "Physical" },
  { label: "Other", value: "Other" }
];

const PURDUE_LEVELS = [
  ["Level5Enterprise", "Level 5 · Enterprise"],
  ["Level4BusinessPlanning", "Level 4 · Business planning"],
  ["Level3_5IndustrialDMZ", "Level 3.5 · Industrial DMZ"],
  ["Level3OperationsManagement", "Level 3 · Operations management"],
  ["Level2SupervisoryControl", "Level 2 · Supervisory control"],
  ["Level1BasicControl", "Level 1 · Basic control"],
  ["Level0Process", "Level 0 · Process"],
  ["SafetySystem", "Safety system"]
] as const;

const SAFETY_LEVELS = [
  "PassiveReadOnly",
  "ActiveNonInvasive",
  "ControlledValidation",
  "BASLite",
  "AdvancedAdversarial",
  "Disallowed"
] as const;

const fieldClass = "flex min-w-0 flex-col gap-1 text-xs text-muted";
const controlClass =
  "min-w-0 rounded-control border border-line bg-elevated px-3 py-2 text-sm text-ink outline-none focus:border-line-strong focus-visible:ring-2 focus-visible:ring-brand";

function classificationFromScope(scope: Scope): ScopeClassification {
  return {
    assetClass: scope.assetClass,
    businessCriticality: scope.businessCriticality,
    externalValidationProfileId: scope.externalValidationProfileId,
    maxSafetyLevel: scope.maxSafetyLevel,
    purdueLevel: scope.purdueLevel,
    segmentName: scope.segmentName,
    sensitivity: scope.sensitivity,
    tags: scope.tags
  };
}

export function ScopeSafetyEditor({
  onSaved,
  scope
}: {
  onSaved: (scope: Scope) => Promise<unknown>;
  scope: Scope;
}) {
  const profiles = useApiResource(() => api.listExternalValidationProfiles(), []);
  const [draft, setDraft] = useState<ScopeClassification>(() =>
    classificationFromScope(scope)
  );
  const [tagsText, setTagsText] = useState(scope.tags.join(", "));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(classificationFromScope(scope));
    setTagsText(scope.tags.join(", "));
    setError(null);
  }, [scope]);

  const envelope = useMemo(
    () =>
      resolveScopeSafetyEnvelope({
        ...draft,
        tags: tagsText
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      }),
    [draft, tagsText]
  );

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateScopeClassification(scope.scopeId, {
        ...draft,
        tags: tagsText
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      });
      await onSaved(updated);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save the scope safety envelope."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      aria-labelledby="scope-safety-heading"
      className="rounded-control border border-line bg-surface p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h3 id="scope-safety-heading" className="text-sm font-semibold text-ink">
            Scope safety envelope
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Classification is enforced at policy evaluation and runner dispatch.
            Purdue or OT classification always overrides the selected ceiling and
            hard-blocks active validation.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {envelope.isOperationalTechnology ? (
            <StateBadge tone="approval" dot={false}>
              OT protected
            </StateBadge>
          ) : null}
          <SafetyLevelBadge level={envelope.effectiveMaxSafetyLevel} dot={false} />
        </div>
      </div>

      <div
        className={`mt-3 rounded-control border px-3 py-2 text-xs ${
          envelope.isOperationalTechnology
            ? "border-warning/40 bg-warning/5 text-ink"
            : "border-line bg-elevated text-muted"
        }`}
        role="status"
      >
        <span className="font-semibold text-ink">Effective ceiling · </span>
        {envelope.safetyRestrictionReason}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className={fieldClass}>
          Asset class
          <select
            aria-label="Scope asset class"
            className={controlClass}
            value={draft.assetClass}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                assetClass: event.target.value as ScopeAssetClass
              }))
            }
          >
            {ASSET_CLASSES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className={fieldClass}>
          Sensitivity
          <select
            aria-label="Scope sensitivity"
            className={controlClass}
            value={draft.sensitivity}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                sensitivity: event.target.value as Scope["sensitivity"]
              }))
            }
          >
            {(["Low", "Moderate", "High", "Restricted"] as const).map(
              (value) => (
                <option key={value}>{value}</option>
              )
            )}
          </select>
        </label>

        <label className={fieldClass}>
          Business criticality
          <select
            aria-label="Scope business criticality"
            className={controlClass}
            value={draft.businessCriticality}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                businessCriticality: event.target
                  .value as Scope["businessCriticality"]
              }))
            }
          >
            {(["Low", "Moderate", "High", "Critical"] as const).map(
              (value) => (
                <option key={value}>{value}</option>
              )
            )}
          </select>
        </label>

        <label className={fieldClass}>
          Configured maximum
          <select
            aria-label="Scope maximum safety level"
            className={controlClass}
            value={draft.maxSafetyLevel}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                maxSafetyLevel: event.target.value as Scope["maxSafetyLevel"]
              }))
            }
          >
            {SAFETY_LEVELS.map((value) => (
              <option key={value} value={value}>
                {value === "BASLite" ? "limited safe stimulus" : value}
              </option>
            ))}
          </select>
        </label>

        <label className={fieldClass}>
          Segment name
          <input
            aria-label="Scope segment name"
            className={controlClass}
            placeholder="Plant line 2, payment DMZ…"
            value={draft.segmentName ?? ""}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                segmentName: event.target.value || null
              }))
            }
          />
        </label>

        <label className={fieldClass}>
          Purdue level
          <select
            aria-label="Scope Purdue level"
            className={controlClass}
            value={draft.purdueLevel ?? ""}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                purdueLevel: (event.target.value || null) as Scope["purdueLevel"]
              }))
            }
          >
            <option value="">Not an industrial control segment</option>
            {PURDUE_LEVELS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className={fieldClass}>
          External validation profile
          <select
            aria-label="Scope external validation profile"
            className={controlClass}
            disabled={profiles.loading}
            value={draft.externalValidationProfileId ?? ""}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                externalValidationProfileId: event.target.value || null
              }))
            }
          >
            <option value="">No external profile</option>
            {(profiles.data ?? []).map((profile) => (
              <option key={profile.profile} value={profile.profile}>
                {profile.displayName} · {profile.maxRequestsPerTarget} req/target
              </option>
            ))}
          </select>
        </label>

        <label className={fieldClass}>
          Classification tags
          <input
            aria-label="Scope classification tags"
            className={controlClass}
            placeholder="scada, production, safety-critical"
            value={tagsText}
            onChange={(event) => setTagsText(event.target.value)}
          />
        </label>
      </div>

      {profiles.error ? (
        <p className="mt-3 text-xs text-warning">
          External profiles are unavailable; the current binding is preserved.
        </p>
      ) : null}
      {error ? <InlineError className="mt-3" message={error} /> : null}
      <div className="mt-4 flex justify-end">
        <Button disabled={saving} size="sm" onClick={() => void save()}>
          {saving ? "Saving envelope…" : "Save safety envelope"}
        </Button>
      </div>
    </section>
  );
}
