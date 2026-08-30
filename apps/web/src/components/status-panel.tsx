import { useId, type ReactNode } from "react";

import { Badge, type BadgeTone } from "../ui";

type StatusPanelKind = "loading" | "error" | "empty" | "info";

const KIND_TONE: Record<StatusPanelKind, BadgeTone> = {
  empty: "neutral",
  error: "danger",
  info: "info",
  loading: "info"
};

const KIND_LABEL: Record<StatusPanelKind, string> = {
  empty: "Empty",
  error: "Action needed",
  info: "Ready",
  loading: "Loading"
};

export function StatusPanel(props: {
  actions?: ReactNode;
  body: ReactNode;
  eyebrow?: string;
  kind: StatusPanelKind;
  title: string;
}) {
  const liveMode = props.kind === "error" ? "assertive" : "polite";
  const titleId = useId();
  const statusLabel = KIND_LABEL[props.kind];

  return (
    <section
      aria-labelledby={titleId}
      aria-live={liveMode}
      className="flex flex-col gap-3 rounded-card border border-line bg-surface-strong p-5"
      role={props.kind === "error" ? "alert" : "status"}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          {props.eyebrow ? (
            <span className="text-xs uppercase tracking-wide text-muted">
              {props.eyebrow}
            </span>
          ) : null}
          <h2 className="text-lg font-semibold text-ink" id={titleId}>
            {props.title}
          </h2>
        </div>
        <Badge tone={KIND_TONE[props.kind]}>{statusLabel}</Badge>
      </div>
      <div className="text-sm text-muted">{props.body}</div>
      {props.actions ? (
        <div className="flex flex-wrap gap-2">{props.actions}</div>
      ) : null}
    </section>
  );
}
