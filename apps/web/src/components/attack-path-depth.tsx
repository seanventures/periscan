import type { AttackPath } from "@periscan/shared";

import { Badge } from "../ui";

/**
 * Presentational depth view for an attack path. Renders only the structured
 * fields the API actually returns (ordered path steps, choke points / path
 * breakers, edge interactions, confidence, impact score). Sections that have
 * no data are omitted rather than fabricated.
 *
 * [P01-1] Status chrome uses kit Badge — not legacy .status-pill classes.
 */
export function AttackPathDepth(props: { attackPath: AttackPath }) {
  const { attackPath } = props;
  const orderedNodes = [...attackPath.pathNodes].sort(
    (left, right) => left.sequence - right.sequence
  );
  const entryNode = orderedNodes[0] ?? null;
  const objectiveNode =
    orderedNodes.length > 1 ? orderedNodes[orderedNodes.length - 1] : null;

  return (
    <div className="stack attack-path-depth">
      <dl className="facts" aria-label="Attack path metrics">
        <div>
          <dt>Confidence</dt>
          <dd>{Math.round(attackPath.confidence * 100)}%</dd>
        </div>
        <div>
          <dt>Impact score</dt>
          <dd>{attackPath.impactScore}</dd>
        </div>
        <div>
          <dt>Evidence basis</dt>
          <dd>
            <span
              className={`status-badge ${
                attackPath.evidenceBasis === "Measured"
                  ? "status-ok"
                  : "status-warn"
              }`}
              role="status"
            >
              {attackPath.evidenceBasis === "Measured"
                ? "Measured"
                : "Heuristic"}
            </span>
            {attackPath.evidenceBasis === "Measured"
              ? " — derived from authoritative configuration or an observed probe."
              : " — inferred from a known attack pattern; impact score is an estimate."}
            {attackPath.methodology ? (
              <span className="muted"> ({attackPath.methodology})</span>
            ) : null}
          </dd>
        </div>
        {entryNode ? (
          <div>
            <dt>Entry point</dt>
            <dd>{entryNode.label}</dd>
          </div>
        ) : null}
        {objectiveNode ? (
          <div>
            <dt>Objective</dt>
            <dd>{objectiveNode.label}</dd>
          </div>
        ) : null}
      </dl>

      {orderedNodes.length > 0 ? (
        <div className="stack">
          <span className="section-kicker">
            Path steps ({orderedNodes.length})
          </span>
          <ol className="path-step-list" aria-label="Attack path steps">
            {orderedNodes.map((node) => (
              <li key={node.pathNodeId}>
                {node.label}
                <span className="muted-copy"> · {node.entityType}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {attackPath.pathEdges.some((edge) => edge.rationale) ? (
        <div className="stack">
          <span className="section-kicker">
            Control &amp; step interactions
          </span>
          <ul className="chip-list">
            {attackPath.pathEdges
              .filter((edge) => edge.rationale)
              .map((edge) => (
                <li key={edge.pathEdgeId}>
                  <strong>{edge.evidenceBasis}</strong> · {edge.relationship}:{" "}
                  {edge.rationale}
                  {edge.measurementMethod ? (
                    <span className="muted-copy">
                      {" "}
                      ({edge.measurementMethod})
                    </span>
                  ) : null}
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      {attackPath.pathBreakers.length > 0 ? (
        <div className="stack">
          <span className="section-kicker">
            Evidence-backed path breakers ({attackPath.pathBreakers.length})
          </span>
          <ul className="stack" aria-label="Evidence-backed path breakers">
            {attackPath.pathBreakers.map((breaker) => (
              <li className="list-card" key={breaker.pathBreakerId}>
                <div>
                  <strong>{breaker.title}</strong>
                  <p className="muted-copy">{breaker.description}</p>
                </div>
                <Badge
                  aria-label={`Path breaker priority: ${breaker.priority}`}
                  className="border-0 bg-transparent px-0"
                  role="status"
                  tone="warning"
                >
                  P{breaker.priority}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
