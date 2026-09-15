import Link from "next/link";

import { renderValidationSnapshotReportHtml } from "@periscan/reports";
import { createPublicDemoValidationSnapshot } from "@periscan/shared";

import { Badge, buttonClassName } from "../ui";

/**
 * Public sample Validation Snapshot surface.
 * [P01-1] CTAs and status chrome use the Tailwind kit (buttonClassName / Badge),
 * not legacy .primary-button / .status-pill classes.
 */
export function PublicDemoReport() {
  const snapshot = createPublicDemoValidationSnapshot();
  const reportHtml = renderValidationSnapshotReportHtml(snapshot);

  return (
    <main id="main-content" tabIndex={-1} className="public-main public-demo-page">
      <section className="public-demo-hero">
        <div className="stack">
          <span className="eyebrow">Public sample data</span>
          <h1 className="headline">
            See the proof loop before connecting systems.
          </h1>
          <p className="subcopy compact">
            This public demo uses deterministic sample data and the same report
            generator as authenticated Validation Snapshot exports. It shows
            evidence-labeled attack paths, control observations, AI validation,
            remediation, verification planning, and the evidence appendix
            without implying real customer data.
          </p>
        </div>
        <div className="public-demo-actions">
          <Link
            className={buttonClassName({ variant: "primary" })}
            href="/demo/workspace"
          >
            Enter guided demo
          </Link>
          <a
            className={buttonClassName({ variant: "secondary" })}
            href="/demo#sample-report"
          >
            View sample report
          </a>
        </div>
      </section>

      <section
        aria-label="Sample snapshot highlights"
        className="public-demo-proof-grid"
      >
        <article className="proof-card">
          <span className="coverage-label">Priority paths</span>
          <strong
            aria-label={`Sample priority attack path count: ${snapshot.metrics.topPathCount}`}
            role="status"
          >
            {snapshot.metrics.topPathCount}
          </strong>
          <p className="muted-copy">
            Repository-to-cloud and AI app paths are linked to evidence IDs.
          </p>
        </article>
        <article className="proof-card">
          <span className="coverage-label">Control verdicts</span>
          <strong
            aria-label={`Sample control verdict count: ${snapshot.metrics.controlObservationCount}`}
            role="status"
          >
            {snapshot.metrics.controlObservationCount}
          </strong>
          <p className="muted-copy">
            Sample SIEM observation shows how missed detection evidence appears.
          </p>
        </article>
        <article className="proof-card">
          <span className="coverage-label">AI validation</span>
          <strong
            aria-label={`Sample AI validation risk count: ${snapshot.metrics.aiRiskCount}`}
            role="status"
          >
            {snapshot.metrics.aiRiskCount}
          </strong>
          <p className="muted-copy">
            Safe fixture data demonstrates RAG authorization risk reporting.
          </p>
        </article>
        <article className="proof-card">
          <span className="coverage-label">Fix proof</span>
          <strong
            aria-label={`Sample fix proof count: ${snapshot.remediationPriorities.length}`}
            role="status"
          >
            {snapshot.remediationPriorities.length}
          </strong>
          <p className="muted-copy">
            Each remediation includes verification method and linked proof.
          </p>
        </article>
      </section>

      <section className="panel stack public-demo-story">
        <div className="panel-header">
          <h2>Demo story</h2>
          <Badge
            aria-label="Demo story data status: Sample only"
            className="border-0 bg-transparent px-0"
            role="status"
            tone="success"
          >
            Sample only
          </Badge>
        </div>
        <ol className="story-list">
          <li>Periscan finds a redacted fake repository secret candidate.</li>
          <li>It maps that evidence to possible cloud role access.</li>
          <li>
            It identifies a path from the repository to production impact.
          </li>
          <li>
            It checks whether the mock SIEM saw related credential-use activity.
          </li>
          <li>Periscan recommends the highest-value path breaker.</li>
          <li>Periscan creates a remediation task with evidence IDs.</li>
          <li>Periscan re-tests through the fix verification workflow.</li>
          <li>Periscan records whether the risk is fixed or still exposed.</li>
          <li>
            Periscan generates an evidence pack without raw scanner dumps.
          </li>
        </ol>
        <blockquote className="success-signal">
          <span className="coverage-label">MVP success signal</span>
          <p>
            "This is not a scanner. This is the report I wish I had before the
            audit / customer review / insurance renewal / board meeting."
          </p>
        </blockquote>
      </section>

      <section className="public-demo-report-shell" id="sample-report">
        <div className="report-toolbar public-demo-toolbar">
          <div>
            <span className="eyebrow">Sample report</span>
            <h2>Validation Snapshot report preview</h2>
          </div>
          <Badge
            aria-label="Sample report data status: Not real customer data"
            className="border-0 bg-transparent px-0"
            role="status"
            tone="warning"
          >
            Not real customer data
          </Badge>
        </div>
        <iframe
          className="demo-report-frame"
          srcDoc={reportHtml}
          title="Sample Validation Snapshot report"
        />
      </section>
    </main>
  );
}
