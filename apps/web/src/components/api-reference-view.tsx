"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  ApiReferenceDocument,
  ApiReferenceEndpoint
} from "@periscan/shared";

import {
  PeriscanApiClient,
  PeriscanApiClientError
} from "../lib/periscan-api-client";
import {
  Badge,
  Button,
  Panel,
  PanelHeader,
  buttonClassName,
  type BadgeTone
} from "../ui";
import { StatusPanel } from "./status-panel";

function formatAuthMode(mode: ApiReferenceEndpoint["authentication"]) {
  if (mode === "SessionCookie") {
    return "Session cookie";
  }

  if (mode === "RunnerToken") {
    return "Runner token";
  }

  return "Public";
}

function methodTone(method: string): BadgeTone {
  if (method === "GET") {
    return "success";
  }

  if (method === "DELETE") {
    return "danger";
  }

  return "warning";
}

function getApiError(error: unknown) {
  if (error instanceof PeriscanApiClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "API reference unavailable";
}

function metadataAvailabilityLabel(
  kind: "Query parameters" | "Request schema" | "Response schema",
  available: boolean
) {
  return `${kind}: ${available ? "available" : "not published"}`;
}

function metadataValuesLabel(kind: string, values: string[]) {
  return `${kind}: ${values.length > 0 ? values.join(", ") : "none"}`;
}

function formatMetadataValues(values: string[]) {
  return values.length > 0 ? values.join(", ") : "none";
}

function MetaBadge(props: {
  available: boolean;
  ariaLabel: string;
  children: string;
}) {
  return (
    <Badge
      aria-label={props.ariaLabel}
      className="border-0 bg-transparent px-0"
      role="status"
      tone={props.available ? "success" : "warning"}
    >
      {props.children}
    </Badge>
  );
}

export function ApiReferenceView() {
  const [document, setDocument] = useState<ApiReferenceDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function loadReference() {
    setIsLoading(true);
    setError(null);

    try {
      const api = new PeriscanApiClient();
      setDocument(await api.getApiReference());
    } catch (nextError) {
      setError(getApiError(nextError));
      setDocument(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadReference();
  }, []);

  const endpointsByGroup = useMemo(() => {
    const groups = new Map<string, ApiReferenceEndpoint[]>();

    for (const endpoint of document?.endpoints ?? []) {
      const endpoints = groups.get(endpoint.group) ?? [];
      endpoints.push(endpoint);
      groups.set(endpoint.group, endpoints);
    }

    return groups;
  }, [document]);

  if (isLoading) {
    return (
      <StatusPanel
        body="Periscan is loading the generated API reference from the control-plane API."
        eyebrow="API Reference"
        kind="loading"
        title="Loading API contract"
      />
    );
  }

  if (error) {
    return (
      <StatusPanel
        actions={
          <Button onClick={() => void loadReference()} type="button">
            Retry API reference
          </Button>
        }
        body={error}
        eyebrow="API Reference"
        kind="error"
        title="API reference unavailable"
      />
    );
  }

  if (!document || document.endpoints.length === 0) {
    return (
      <StatusPanel
        actions={
          <Button
            onClick={() => void loadReference()}
            type="button"
            variant="secondary"
          >
            Reload API reference
          </Button>
        }
        body="The API returned no documented endpoints. Check the API service and OpenAPI registration before sharing this with customers."
        eyebrow="API Reference"
        kind="empty"
        title="No endpoints documented"
      />
    );
  }

  return (
    <section aria-labelledby="api-reference-title" className="flex flex-col gap-4">
      <Panel className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">
              Generated API contract
            </span>
            <h2
              className="font-display text-lg font-semibold tracking-[-0.01em] text-ink"
              id="api-reference-title"
            >
              {document.title}
            </h2>
          </div>
          <Badge
            aria-label={`API reference endpoint count: ${document.totalEndpoints}`}
            className="border-0 bg-transparent px-0"
            role="status"
            tone="success"
          >
            {document.totalEndpoints} endpoints
          </Badge>
        </div>
        <p className="text-sm text-muted">
          Generated at {document.generatedAt}. Customer integrations should use
          these API routes as the public control surface; the web UI is a
          consumer of the same contract.
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            className={buttonClassName({ variant: "secondary" })}
            href={document.openApiPath}
          >
            Open OpenAPI JSON
          </a>
        </div>
      </Panel>

      <dl
        className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3"
        aria-label="API endpoint groups"
      >
        {document.groups.map((group) => (
          <div
            className="rounded-control border border-line bg-surface p-3"
            key={group.name}
          >
            <dt className="text-xs text-muted">{group.name}</dt>
            <dd className="m-0 text-base font-semibold text-ink">
              {group.endpointCount} endpoints
            </dd>
          </div>
        ))}
      </dl>

      {[...endpointsByGroup.entries()].map(([groupName, endpoints]) => {
        const groupId = `api-group-${groupName.replaceAll(/\W+/gu, "-").toLowerCase()}`;
        return (
          <Panel aria-labelledby={groupId} key={groupName}>
            <PanelHeader
              actions={
                <Badge
                  aria-label={`${groupName} endpoint count: ${endpoints.length}`}
                  className="border-0 bg-transparent px-0 text-[#cfe0ff]"
                  role="status"
                  tone="warning"
                >
                  {endpoints.length}
                </Badge>
              }
              title={<span id={groupId}>{groupName}</span>}
            />
            <div className="flex flex-col gap-2 p-3">
              {endpoints.map((endpoint) => (
                <article
                  aria-label={`${endpoint.method} ${endpoint.path}`}
                  className="min-w-0 overflow-hidden rounded-control border border-line bg-bg p-3"
                  key={`${endpoint.method}:${endpoint.path}`}
                >
                  <div className="mb-2 flex min-w-0 flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <Badge
                          aria-label={`HTTP method: ${endpoint.method}`}
                          className="border-0 bg-transparent px-0"
                          role="status"
                          tone={methodTone(endpoint.method)}
                        >
                          {endpoint.method}
                        </Badge>
                        <code className="min-w-0 break-all text-sm text-ink">
                          {endpoint.path}
                        </code>
                      </div>
                      <strong className="break-words text-ink">
                        {endpoint.summary}
                      </strong>
                    </div>
                    <Badge
                      aria-label={`Authentication mode: ${formatAuthMode(endpoint.authentication)}`}
                      className="border-0 bg-transparent px-0"
                      role="status"
                      tone="warning"
                    >
                      {formatAuthMode(endpoint.authentication)}
                    </Badge>
                  </div>
                  <p className="mb-2 text-sm text-muted">
                    Operation ID: {endpoint.operationId ?? "Not specified"}
                  </p>
                  <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1">
                    <MetaBadge
                      ariaLabel={metadataAvailabilityLabel(
                        "Query parameters",
                        endpoint.hasQueryParameters
                      )}
                      available={endpoint.hasQueryParameters}
                    >
                      {`Query parameters ${
                        endpoint.hasQueryParameters
                          ? endpoint.queryParameters.join(", ")
                          : "not published"
                      }`}
                    </MetaBadge>
                    <MetaBadge
                      ariaLabel={metadataAvailabilityLabel(
                        "Request schema",
                        endpoint.hasRequestSchema
                      )}
                      available={endpoint.hasRequestSchema}
                    >
                      {`Request schema ${
                        endpoint.hasRequestSchema
                          ? "available"
                          : "not published"
                      }`}
                    </MetaBadge>
                    <MetaBadge
                      ariaLabel={metadataAvailabilityLabel(
                        "Response schema",
                        endpoint.hasResponseSchema
                      )}
                      available={endpoint.hasResponseSchema}
                    >
                      {`Response schema ${
                        endpoint.hasResponseSchema
                          ? "available"
                          : "not published"
                      }`}
                    </MetaBadge>
                    <MetaBadge
                      ariaLabel={metadataValuesLabel(
                        "Request content types",
                        endpoint.requestContentTypes
                      )}
                      available={endpoint.requestContentTypes.length > 0}
                    >
                      {`Request content ${formatMetadataValues(endpoint.requestContentTypes)}`}
                    </MetaBadge>
                    <MetaBadge
                      ariaLabel={metadataValuesLabel(
                        "Response content types",
                        endpoint.responseContentTypes
                      )}
                      available={endpoint.responseContentTypes.length > 0}
                    >
                      {`Response content ${formatMetadataValues(endpoint.responseContentTypes)}`}
                    </MetaBadge>
                    <MetaBadge
                      ariaLabel={metadataValuesLabel(
                        "Success statuses",
                        endpoint.successStatuses
                      )}
                      available={endpoint.successStatuses.length > 0}
                    >
                      {`Success statuses ${formatMetadataValues(endpoint.successStatuses)}`}
                    </MetaBadge>
                  </div>
                </article>
              ))}
            </div>
          </Panel>
        );
      })}
    </section>
  );
}
