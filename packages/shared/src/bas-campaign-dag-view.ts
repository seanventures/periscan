import type { BasLivePack } from "./bas-control-plane";
import {
  campaignPinStepKey,
  compileBasCampaignDag,
  livePackFromCampaignPins,
  type BasCampaignDag
} from "./bas-campaign";

export const CAMPAIGN_DAG_EMPTY_TITLE = "No compiled campaign graph";
export const CAMPAIGN_DAG_EMPTY_DESCRIPTION =
  "Compile a campaign to see execution order and edges. The graph is compiler output, not executed coverage.";
export const CAMPAIGN_DAG_NOT_EXECUTED_COVERAGE =
  "Compiled graph is not executed coverage. Import is not executed.";

export type CampaignDagViewPin = {
  dependsOn?: readonly string[];
  provider: string;
  stepKey?: string;
  typedInputs?: Record<string, string | number | boolean>;
  upstreamId: string;
};

export type CampaignDagViewStepLabel =
  | "startable"
  | "not startable"
  | "not live executable";

export type CampaignDagViewStep = {
  dependsOn: string[];
  index: number;
  label: CampaignDagViewStepLabel;
  livePack: Exclude<BasLivePack, "none"> | "none";
  stepKey: string;
  upstreamId: string;
};

export type CampaignDagViewEdge = {
  from: string;
  id: string;
  label: string;
  to: string;
};

export function campaignDagEdgeTestId(from: string, to: string): string {
  return `bas-campaign-dag-edge-${from}-${to}`;
}

export type CampaignDagView = {
  compiled: boolean;
  edges: CampaignDagViewEdge[];
  empty: boolean;
  emptyDescription: string;
  emptyTitle: string;
  executedCoverage: false;
  executionOrder: string[];
  honesty: string;
  steps: CampaignDagViewStep[];
};

function pinLabel(
  livePack: Exclude<BasLivePack, "none"> | "none",
  startable: boolean
): CampaignDagViewStepLabel {
  if (livePack !== "none") {
    return "not live executable";
  }
  return startable ? "startable" : "not startable";
}

function emptyView(): CampaignDagView {
  return {
    compiled: false,
    edges: [],
    empty: true,
    emptyDescription: CAMPAIGN_DAG_EMPTY_DESCRIPTION,
    emptyTitle: CAMPAIGN_DAG_EMPTY_TITLE,
    executedCoverage: false,
    executionOrder: [],
    honesty: CAMPAIGN_DAG_NOT_EXECUTED_COVERAGE,
    steps: []
  };
}

function resolveCompiledDag(
  stored: BasCampaignDag | null | undefined,
  pins: ReadonlyArray<CampaignDagViewPin>
): BasCampaignDag {
  const fromPins = compileBasCampaignDag(pins).graph;
  const storedEdges = stored?.edges ?? [];
  const pinEdges = fromPins?.edges ?? [];
  return {
    edges: pinEdges.length > 0 ? pinEdges : storedEdges,
    executionOrder:
      (stored?.executionOrder.length
        ? stored.executionOrder
        : fromPins?.executionOrder) ?? [],
    nodes: (fromPins?.nodes.length ? fromPins.nodes : stored?.nodes) ?? []
  };
}

export function presentCampaignDagView(input: {
  graph?: BasCampaignDag | null;
  pins?: ReadonlyArray<CampaignDagViewPin>;
  startable?: boolean;
}): CampaignDagView {
  const pins = input.pins ?? [];
  const compiled = resolveCompiledDag(input.graph, pins);
  const pinByKey = new Map(
    pins.map((pin) => [campaignPinStepKey(pin), pin] as const)
  );
  const seen = new Set<string>();
  const executionOrder: string[] = [];
  for (const key of compiled.executionOrder) {
    if (seen.has(key)) continue;
    seen.add(key);
    executionOrder.push(key);
  }
  for (const pin of pins) {
    const key = campaignPinStepKey(pin);
    if (seen.has(key)) continue;
    seen.add(key);
    executionOrder.push(key);
  }

  if (executionOrder.length === 0) {
    return emptyView();
  }

  const startable = input.startable === true;
  const steps: CampaignDagViewStep[] = executionOrder.flatMap(
    (stepKey, index) => {
      const pin = pinByKey.get(stepKey);
      if (!pin) {
        return [];
      }
      const livePack = livePackFromCampaignPins([pin]);
      return [
        {
          dependsOn: [...(pin.dependsOn ?? [])],
          index: index + 1,
          label: pinLabel(livePack, startable),
          livePack,
          stepKey,
          upstreamId: pin.upstreamId
        }
      ];
    }
  );

  return {
    compiled: true,
    edges: compiled.edges.map((edge) => ({
      from: edge.from,
      id: campaignDagEdgeTestId(edge.from, edge.to),
      label: `${edge.from} depends on ${edge.to}`,
      to: edge.to
    })),
    empty: false,
    emptyDescription: CAMPAIGN_DAG_EMPTY_DESCRIPTION,
    emptyTitle: CAMPAIGN_DAG_EMPTY_TITLE,
    executedCoverage: false,
    executionOrder,
    honesty: CAMPAIGN_DAG_NOT_EXECUTED_COVERAGE,
    steps
  };
}
