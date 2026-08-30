"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type {
  ApiReferenceDocument,
  ApiReferenceEndpoint,
  ApiReferenceSchemaField
} from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { useApiResource, type ApiResource } from "../hooks/use-api-resource";
import {
  ErrorState,
  InfoPopover,
  LoadingSkeleton,
  Panel,
  PanelHeader,
  StateBadge,
  buttonClassName,
  cn,
  type StateTone
} from "../ui";

type ReferenceSection = "api" | "architecture" | "nis2" | "glossary";

const METHOD_TONE: Record<string, StateTone> = {
  GET: "validated",
  POST: "blocked",
  PUT: "approval",
  PATCH: "approval",
  DELETE: "missed"
};
const AUTH_TONE: Record<string, StateTone> = {
  Public: "fixed",
  SessionCookie: "blocked",
  RunnerToken: "approval"
};
const AUTH_LABEL: Record<string, string> = {
  Public: "Public",
  SessionCookie: "Session / API key",
  RunnerToken: "Runner token"
};

const SECTIONS: Array<{
  id: ReferenceSection;
  label: string;
  description: string;
}> = [
  { id: "api", label: "API", description: "Schemas and runnable examples" },
  {
    id: "architecture",
    label: "Runner safety",
    description: "Network and execution model"
  },
  {
    id: "nis2",
    label: "NIS2 walkthrough",
    description: "Requirement → measured proof"
  },
  {
    id: "glossary",
    label: "Scoring glossary",
    description: "How Periscan labels risk"
  }
];

export function ApiReferenceConsole() {
  const doc = useApiResource(() => api.getApiReference(), []);
  const [section, setSection] = useState<ReferenceSection>("api");
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const [method, setMethod] = useState("all");
  const [copied, setCopied] = useState<string | null>(null);

  const endpoints = doc.data?.endpoints ?? [];
  const methods = useMemo(
    () =>
      Array.from(new Set(endpoints.map((endpoint) => endpoint.method))).sort(),
    [endpoints]
  );
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return endpoints
      .filter((endpoint) => group === "all" || endpoint.group === group)
      .filter((endpoint) => method === "all" || endpoint.method === method)
      .filter(
        (endpoint) =>
          !normalizedQuery ||
          endpoint.path.toLowerCase().includes(normalizedQuery) ||
          endpoint.summary.toLowerCase().includes(normalizedQuery) ||
          endpoint.operationId?.toLowerCase().includes(normalizedQuery)
      );
  }, [endpoints, group, method, query]);

  async function copy(key: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 py-6">
      <header className="flex flex-col gap-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">
          Reference
        </p>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Periscan API &amp; product reference
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            {doc.data ? (
              <span
                className="rounded-control border border-line bg-surface px-2.5 py-1 font-mono text-[11px] text-muted"
                data-testid="api-openapi-version"
                title="OpenAPI info.version from the live contract"
              >
                API v{doc.data.version}
              </span>
            ) : null}
            {doc.data ? (
              <a
                href={doc.data.openApiPath}
                target="_blank"
                rel="noreferrer"
                className={buttonClassName({ size: "sm", variant: "secondary" })}
              >
                OpenAPI JSON ↗
              </a>
            ) : null}
          </div>
        </div>
        <p className="max-w-3xl text-sm text-muted">
          Build integrations, clear a network review, or trace a compliance
          claim to the measurement that supports it. Expand any endpoint for a
          ready-to-run sample and use{" "}
          <strong className="font-medium text-ink">Copy as curl</strong>.
          Examples use placeholders and never expose tenant secrets.
        </p>
      </header>

      {/* P07: least-privilege callout for automation integrators. */}
      <div
        role="status"
        data-testid="api-reference-least-privilege-banner"
        className="rounded-card border border-brand/35 bg-brand/[0.07] px-4 py-3 text-sm text-ink"
      >
        <p className="font-semibold text-brand-2">Least-privilege by default</p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          Create API keys with the{" "}
          <span className="font-mono text-ink">read</span> scope first — it is
          least-privilege for inventory, findings, and OpenAPI exploration.
          Escalate only the write scopes your automation needs. Manage keys in{" "}
          <Link
            href="/admin#api-keys"
            className="font-semibold text-brand hover:text-brand-2"
          >
            Admin → API keys
          </Link>
          .
        </p>
      </div>

      <nav
        aria-label="Reference sections"
        className="grid gap-2 md:grid-cols-4"
      >
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={section === item.id}
            onClick={() => setSection(item.id)}
            className={cn(
              "rounded-card border p-3 text-left transition-colors",
              section === item.id
                ? "border-brand/60 bg-brand/10"
                : "border-line bg-surface hover:border-line-strong"
            )}
          >
            <span className="block text-sm font-medium text-ink">
              {item.label}
            </span>
            <span className="mt-0.5 block text-xs text-subtle">
              {item.description}
            </span>
          </button>
        ))}
      </nav>

      {section === "api" ? (
        <ApiReference
          copied={copied}
          doc={doc}
          filtered={filtered}
          group={group}
          method={method}
          methods={methods}
          query={query}
          onCopy={copy}
          onGroupChange={setGroup}
          onMethodChange={setMethod}
          onQueryChange={setQuery}
        />
      ) : section === "architecture" ? (
        <RunnerSafetyReference />
      ) : section === "nis2" ? (
        <Nis2Walkthrough />
      ) : (
        <ScoringGlossary />
      )}
    </div>
  );
}

function ApiReference({
  copied,
  doc,
  filtered,
  group,
  method,
  methods,
  query,
  onCopy,
  onGroupChange,
  onMethodChange,
  onQueryChange
}: {
  copied: string | null;
  doc: ApiResource<ApiReferenceDocument>;
  filtered: ApiReferenceEndpoint[];
  group: string;
  method: string;
  methods: string[];
  query: string;
  onCopy: (key: string, value: string) => Promise<void>;
  onGroupChange: (value: string) => void;
  onMethodChange: (value: string) => void;
  onQueryChange: (value: string) => void;
}) {
  return (
    <>
      {doc.data ? (
        <div className="flex flex-wrap gap-2" aria-label="API groups">
          {doc.data.groups.map((apiGroup) => (
            <button
              key={apiGroup.name}
              type="button"
              aria-pressed={group === apiGroup.name}
              onClick={() =>
                onGroupChange(group === apiGroup.name ? "all" : apiGroup.name)
              }
              className={cn(
                "rounded-control border px-2.5 py-1 text-[12px] transition-colors",
                group === apiGroup.name
                  ? "border-brand/60 bg-brand/12 text-ink"
                  : "border-line text-muted hover:text-ink"
              )}
            >
              {apiGroup.name}{" "}
              <span className="font-mono text-[10px] text-subtle">
                {apiGroup.endpointCount}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search path, summary, or operation…"
          aria-label="Search endpoints"
          className="min-w-0 flex-1 rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-subtle focus:border-line-strong md:max-w-md"
        />
        <label className="flex items-center gap-1.5 rounded-control border border-line bg-surface pl-3 pr-1.5 text-sm">
          <span className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
            Method
          </span>
          <select
            value={method}
            onChange={(event) => onMethodChange(event.target.value)}
            aria-label="Filter by method"
            className="bg-transparent py-2 text-sm text-ink outline-none"
          >
            <option value="all">All</option>
            {methods.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Panel>
        <PanelHeader
          title={`Endpoints (${filtered.length})`}
          actions={
            doc.data ? (
              <span className="font-mono text-[10px] text-subtle">
                v{doc.data.version} · generated contract
              </span>
            ) : null
          }
        />
        {doc.loading ? (
          <LoadingSkeleton rows={8} />
        ) : doc.error ? (
          <ErrorState message={doc.error} onRetry={doc.refetch} />
        ) : filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-subtle">
            No endpoints match these filters.
          </p>
        ) : (
          <div className="divide-y divide-line">
            {filtered.map((endpoint) => (
              <EndpointReference
                key={`${endpoint.method} ${endpoint.path}`}
                endpoint={endpoint}
                copied={copied}
                onCopy={onCopy}
              />
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}

function EndpointReference({
  endpoint,
  copied,
  onCopy
}: {
  endpoint: ApiReferenceEndpoint;
  copied: string | null;
  onCopy: (key: string, value: string) => Promise<void>;
}) {
  const key = `${endpoint.method}:${endpoint.path}`;
  const curl = curlSample(endpoint);

  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none flex-col gap-1.5 px-4 py-3 marker:hidden hover:bg-surface/50 sm:flex-row sm:items-center">
        <span
          className="w-fit rounded-control px-1.5 py-0.5 font-mono text-[10.5px] font-semibold"
          style={{
            color: `var(--color-${METHOD_TONE[endpoint.method] ?? "inconclusive"})`,
            border: `1px solid color-mix(in srgb, var(--color-${METHOD_TONE[endpoint.method] ?? "inconclusive"}) 40%, transparent)`
          }}
        >
          {endpoint.method}
        </span>
        <span className="min-w-0 flex-1 font-mono text-[12.5px] text-ink">
          {endpoint.path}
        </span>
        <span className="text-[12px] text-muted sm:max-w-sm sm:text-right">
          {endpoint.summary}
        </span>
        <StateBadge
          tone={AUTH_TONE[endpoint.authentication] ?? "neutral"}
          dot={false}
        >
          {AUTH_LABEL[endpoint.authentication] ?? endpoint.authentication}
        </StateBadge>
        <span
          aria-hidden
          className="text-subtle transition-transform group-open:rotate-90"
        >
          ›
        </span>
      </summary>

      <div className="grid gap-4 border-t border-line bg-surface/35 p-4 xl:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-subtle">
            <span>Operation: {endpoint.operationId ?? "not specified"}</span>
            {endpoint.queryParameters.length ? (
              <span>Query: {endpoint.queryParameters.join(", ")}</span>
            ) : null}
            <span>
              Success: {endpoint.successStatuses.join(", ") || "not published"}
            </span>
            <InfoPopover
              label={`${endpoint.method} ${endpoint.path} authentication`}
            >
              {endpoint.authentication === "Public"
                ? "This endpoint does not require an authenticated tenant session."
                : endpoint.authentication === "RunnerToken"
                  ? "Use the short-lived or runner-bound token issued during runner enrollment."
                  : "Use the browser session cookie or a tenant-bound psk_ API key as a Bearer token."}
            </InfoPopover>
          </div>
          <SchemaFields
            title="Request body"
            fields={endpoint.requestFields}
            emptyLabel="No JSON request body"
          />
          <SchemaFields
            title="Success response"
            fields={endpoint.responseFields}
            emptyLabel="No JSON response fields published"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <CodeBlock
            label="cURL request"
            copyLabel="Copy as curl"
            value={curl}
            copied={copied === `${key}:curl`}
            onCopy={() => onCopy(`${key}:curl`, curl)}
          />
          {endpoint.responseExample !== null ? (
            <CodeBlock
              label="Example success payload"
              value={JSON.stringify(endpoint.responseExample, null, 2)}
              copied={copied === `${key}:response`}
              onCopy={() =>
                onCopy(
                  `${key}:response`,
                  JSON.stringify(endpoint.responseExample, null, 2)
                )
              }
            />
          ) : null}
        </div>
      </div>
    </details>
  );
}

function SchemaFields({
  title,
  fields,
  emptyLabel
}: {
  title: string;
  fields: ApiReferenceSchemaField[];
  emptyLabel: string;
}) {
  return (
    <section aria-label={title}>
      <h3 className="mb-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
        {title}
      </h3>
      {fields.length ? (
        <div className="overflow-hidden rounded-control border border-line">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface text-subtle">
              <tr>
                <th className="px-2.5 py-2 font-medium">Field</th>
                <th className="px-2.5 py-2 font-medium">Type</th>
                <th className="px-2.5 py-2 font-medium">Constraint</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {fields.map((field) => (
                <tr key={field.name}>
                  <td className="px-2.5 py-2 font-mono text-ink">
                    {field.name}
                  </td>
                  <td className="px-2.5 py-2 font-mono text-muted">
                    {field.type}
                  </td>
                  <td className="px-2.5 py-2 text-subtle">
                    {field.required ? "required" : "optional"}
                    {field.allowedValues.length
                      ? ` · ${field.allowedValues.join(" | ")}`
                      : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-subtle">{emptyLabel}</p>
      )}
    </section>
  );
}

function CodeBlock({
  label,
  value,
  copied,
  onCopy,
  copyLabel = "Copy"
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
  copyLabel?: string;
}) {
  return (
    <section className="min-w-0 rounded-control border border-line bg-bg">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h3 className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
          {label}
        </h3>
        <button
          type="button"
          onClick={onCopy}
          className="text-xs text-brand hover:text-brand-2"
        >
          {copied ? "Copied" : copyLabel}
        </button>
      </div>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all p-3 font-mono text-[11px] leading-5 text-muted">
        {value}
      </pre>
    </section>
  );
}

function curlSample(endpoint: ApiReferenceEndpoint): string {
  const query = endpoint.queryParameters.length
    ? `?${endpoint.queryParameters.map((name) => `${name}=VALUE`).join("&")}`
    : "";
  const lines = [
    `curl --request ${endpoint.method} \\`,
    `  "$PERISCAN_API_URL${endpoint.path}${query}"`
  ];
  if (endpoint.authentication === "SessionCookie") {
    lines[1] += " \\";
    lines.push('  --header "Authorization: Bearer $PERISCAN_API_KEY"');
  } else if (endpoint.authentication === "RunnerToken") {
    lines[1] += " \\";
    lines.push('  --header "Authorization: Bearer $PERISCAN_RUNNER_TOKEN"');
  }
  if (endpoint.requestExample !== null) {
    lines[lines.length - 1] += " \\";
    lines.push('  --header "Content-Type: application/json" \\');
    lines.push(
      `  --data '${JSON.stringify(endpoint.requestExample, null, 2)}'`
    );
  }
  return lines.join("\n");
}

function RunnerSafetyReference() {
  const safetyLevels = [
    [
      "PassiveReadOnly",
      "Observe configuration or signals without changing target state."
    ],
    [
      "ActiveNonInvasive",
      "Make safe requests that do not exploit or alter the target."
    ],
    [
      "ControlledValidation",
      "Requires explicit mission approval and a verified scope."
    ],
    [
      "BASLite",
      "Requires an admin approval and stays inside the BAS-lite module allowlist."
    ],
    [
      "AdvancedAdversarial",
      "Separately authorized; never implied by a lower safety level."
    ],
    ["Disallowed", "Denied by policy and never queued."]
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <Panel>
        <PanelHeader title="Outbound runner data flow" />
        <ol
          className="grid gap-0 p-4 md:grid-cols-4"
          aria-label="Runner data flow"
        >
          {[
            [
              "1",
              "Control plane",
              "Creates a signed, expiring task envelope after policy approval."
            ],
            [
              "2",
              "Outbound HTTPS",
              "Runner polls the gateway. There is no inbound listener or reverse shell."
            ],
            [
              "3",
              "Verified scope",
              "The runner rechecks target, module, scope, expiry, replay, and local policy."
            ],
            [
              "4",
              "Normalized proof",
              "Redacted evidence and the result return through signed task callbacks."
            ]
          ].map(([step, title, body], index) => (
            <li
              key={step}
              className="relative border-l border-line py-3 pl-5 md:border-l-0 md:border-t md:px-3 md:pt-6"
            >
              <span className="absolute -left-3 top-3 grid size-6 place-items-center rounded-full border border-brand/50 bg-bg font-mono text-[10px] text-brand md:-top-3 md:left-3">
                {step}
              </span>
              <h3 className="text-sm font-medium text-ink">{title}</h3>
              <p className="mt-1 text-xs leading-5 text-muted">{body}</p>
              {index < 3 ? <span className="sr-only">Then</span> : null}
            </li>
          ))}
        </ol>
        <div className="border-t border-line p-4">
          <h3 className="text-sm font-medium text-ink">Firewall preflight</h3>
          <p className="mt-1 text-xs leading-5 text-muted">
            Allow DNS plus outbound TCP 443 only to the gateway FQDN shown by
            the paired runner. The runner does not connect directly to Postgres,
            Redis, Supabase, or object storage; task artifact callbacks use the
            same control plane boundary.
          </p>
          <Link
            href="/runners"
            className="mt-3 inline-flex text-xs text-brand hover:text-brand-2"
          >
            View this tenant&apos;s runner FQDN allowlist →
          </Link>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Policy safety ladder"
          actions={
            <InfoPopover label="safety-level enforcement">
              The requested level must be at or below the tenant and scope
              ceilings. OT, Purdue, and SCADA classifications are hard-limited
              to passive read-only.
            </InfoPopover>
          }
        />
        <ol className="divide-y divide-line">
          {safetyLevels.map(([name, description]) => (
            <li key={name} className="px-4 py-3">
              <code className="text-xs text-ink">{name}</code>
              <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}

function Nis2Walkthrough() {
  const controls = [
    {
      id: "NIS2 Art. 21(2)(a)",
      title: "Risk analysis and information-system security policies",
      evidence: "Measured exposure validation + attack-path analysis",
      action: "Run a scoped validation snapshot",
      href: "/missions"
    },
    {
      id: "NIS2 Art. 21(2)(b)",
      title: "Incident detection and handling",
      evidence: "Detection-control validation with timestamped outcomes",
      action: "Validate a control source",
      href: "/controls"
    },
    {
      id: "NIS2 Art. 21(2)(f)",
      title: "Effectiveness testing of cybersecurity measures",
      evidence: "Control validation + persisted continuous-validation history",
      action: "Review measured control trace",
      href: "/compliance"
    }
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-card border border-approval/40 bg-approval/5 p-4 text-sm text-muted">
        <strong className="text-ink">
          Evidence support, not certification.
        </strong>{" "}
        Periscan links current measurements to selected NIS2 Article 21
        controls. It does not determine legal applicability, declare conformity,
        or replace counsel and auditor judgment.
      </div>
      <Panel>
        <PanelHeader title="From requirement to auditable proof" />
        <ol className="divide-y divide-line">
          {controls.map((control, index) => (
            <li
              key={control.id}
              className="grid gap-3 p-4 md:grid-cols-[2rem_1.2fr_1fr_auto] md:items-center"
            >
              <span className="grid size-7 place-items-center rounded-full border border-line font-mono text-xs text-subtle">
                {index + 1}
              </span>
              <div>
                <p className="font-mono text-[11px] text-brand">{control.id}</p>
                <h3 className="mt-1 text-sm font-medium text-ink">
                  {control.title}
                </h3>
              </div>
              <div>
                <p className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
                  Counted only when persisted
                </p>
                <p className="mt-1 text-xs leading-5 text-muted">
                  {control.evidence}
                </p>
              </div>
              <Link
                href={control.href}
                className={buttonClassName({
                  size: "sm",
                  variant: "secondary"
                })}
              >
                {control.action}
              </Link>
            </li>
          ))}
        </ol>
      </Panel>
      <Panel>
        <PanelHeader title="Trace workflow" />
        <div className="grid gap-3 p-4 md:grid-cols-4">
          {[
            [
              "Measure",
              "Run only against verified, customer-authorized scope."
            ],
            [
              "Normalize",
              "Store redacted evidence with provenance and timestamps."
            ],
            [
              "Map",
              "Link evidence types to a catalog control; missing inputs remain gaps."
            ],
            [
              "Export",
              "Generate an auditor PDF whose claims remain linked to evidence IDs."
            ]
          ].map(([title, body]) => (
            <div
              key={title}
              className="rounded-control border border-line bg-surface p-3"
            >
              <h3 className="text-sm font-medium text-ink">{title}</h3>
              <p className="mt-1 text-xs leading-5 text-muted">{body}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function ScoringGlossary() {
  const terms = [
    [
      "Priority score",
      "A 0–100 bounded sum of visible factors such as current validation outcome, control response, business criticality, reachability, exploitability, threat relevance, recurrence, and impact."
    ],
    [
      "Risk bands",
      "Critical ≥85, High ≥70, Medium ≥45, Low ≥20, and Informational below 20 for non-fixed exposure."
    ],
    [
      "Fixed",
      "A verification claim, not a low score. Periscan shows Fixed only when a current verification event or validation state establishes it."
    ],
    [
      "Control state",
      "What the connected control did with the validation: Blocked, Detected, Logged, Alerted, Routed, Missed, Needs tuning, or No evidence."
    ],
    [
      "Evidence basis",
      "Whether a claim is measured, reported by an integration, inferred, or unavailable. Missing proof remains visible instead of becoming a zero."
    ],
    [
      "Readiness",
      "CTEM stage rollup: On track = 100%, Needs attention = 50%, Not started = 0%, averaged across the returned stages."
    ],
    [
      "Annualized loss exposure",
      "A user-supplied, FAIR-inspired PERT planning estimate: expected event frequency × expected loss magnitude. It is not observed loss history."
    ],
    [
      "Evidence integrity",
      "Tenant-scoped SHA-256 chain verification over persisted evidence order. A broken or legacy-unlinked record is disclosed and not counted as verified integrity."
    ]
  ];

  return (
    <Panel>
      <PanelHeader title="Scoring and proof terms" />
      <dl className="grid md:grid-cols-2">
        {terms.map(([term, definition]) => (
          <div key={term} className="border-b border-line p-4 odd:md:border-r">
            <dt className="text-sm font-medium text-ink">{term}</dt>
            <dd className="mt-1 text-xs leading-5 text-muted">{definition}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-2 p-4">
        <Link
          href="/findings"
          className={buttonClassName({ size: "sm", variant: "secondary" })}
        >
          Inspect finding factors
        </Link>
        <Link
          href="/evidence"
          className={buttonClassName({ size: "sm", variant: "secondary" })}
        >
          Verify evidence chain
        </Link>
      </div>
    </Panel>
  );
}
