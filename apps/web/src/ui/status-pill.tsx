import { Badge, type BadgeTone } from "./badge";

export const PRD_STATUS_BADGE_LABELS = [
  "Validated",
  "Blocked",
  "Detected",
  "Missed",
  "Mitigated",
  "Fixed",
  "Reopened",
  "Needs Review"
] as const;

// Central status -> tone mapping. This replaces the ~50 per-component
// statusClass/severityClass switch statements scattered across the app, so a
// given status reads the same everywhere.
// [P01-1] Prefer this kit over legacy globals.css .status-pill / .status-pill--*.
const STATUS_TONES: Record<string, BadgeTone> = {
  // success-ish
  ok: "success",
  healthy: "success",
  executed: "success",
  delivered: "success",
  passed: "success",
  pass: "success",
  verified: "success",
  fixed: "success",
  mitigated: "success",
  active: "success",
  completed: "success",
  allowed: "success",
  approved: "success",
  attached: "success",
  ready: "success",
  resolved: "success",
  enabled: "success",
  configured: "success",
  // danger-ish
  error: "danger",
  failed: "danger",
  denied: "danger",
  critical: "danger",
  blocked: "danger",
  missed: "danger",
  reopened: "danger",
  unhealthy: "danger",
  open: "danger",
  cancelled: "danger",
  deniedbypolicy: "danger",
  terminated: "danger",
  expired: "danger",
  // warning-ish
  pending: "warning",
  planned: "warning",
  paused: "warning",
  created: "info",
  inprogress: "warning",
  warn: "warning",
  warning: "warning",
  degraded: "warning",
  high: "warning",
  attention: "warning",
  requiresapproval: "warning",
  needsapproval: "warning",
  needsreview: "warning",
  verificationpending: "warning",
  // info-ish
  detected: "info",
  validated: "info",
  running: "info",
  queued: "info",
  scheduled: "info",
  medium: "info",
  beta: "info"
};

function normalize(status: string): string {
  return status.toLowerCase().replace(/[\s_-]/gu, "");
}

export function statusTone(status: string): BadgeTone {
  return STATUS_TONES[normalize(status)] ?? "neutral";
}

export interface StatusPillProps {
  status: string;
  label?: string;
  className?: string;
  "aria-label"?: string;
}

export function StatusPill({
  status,
  label,
  className,
  ...rest
}: StatusPillProps) {
  return (
    <Badge
      tone={statusTone(status)}
      role="status"
      className={`border-0 bg-transparent px-0 ${className ?? ""}`}
      {...rest}
    >
      {label ?? status}
    </Badge>
  );
}
