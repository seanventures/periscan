import { describe, expect, it } from "vitest";

import { compileBasCampaignDag } from "./bas-campaign.js";
import {
  CAMPAIGN_DAG_EMPTY_DESCRIPTION,
  CAMPAIGN_DAG_EMPTY_TITLE,
  CAMPAIGN_DAG_NOT_EXECUTED_COVERAGE,
  presentCampaignDagView
} from "./bas-campaign-dag-view.js";

const markerPin = {
  dependsOn: ["recon"],
  provider: "ControlPlane",
  stepKey: "marker",
  typedInputs: { timeout: 30 },
  upstreamId: "control.detection.benign-marker"
};

const reconPin = {
  dependsOn: [] as string[],
  provider: "ControlPlane",
  stepKey: "recon",
  typedInputs: {},
  upstreamId: "control.detection.benign-marker"
};

describe("presentCampaignDagView", () => {
  it("returns an honest empty view when there is no compiled graph", () => {
    const view = presentCampaignDagView({});

    expect(view.empty).toBe(true);
    expect(view.compiled).toBe(false);
    expect(view.executedCoverage).toBe(false);
    expect(view.executionOrder).toEqual([]);
    expect(view.edges).toEqual([]);
    expect(view.steps).toEqual([]);
    expect(view.emptyTitle).toBe(CAMPAIGN_DAG_EMPTY_TITLE);
    expect(view.emptyTitle).toBe("No compiled campaign graph");
    expect(view.emptyDescription).toBe(CAMPAIGN_DAG_EMPTY_DESCRIPTION);
    expect(view.honesty).toBe(CAMPAIGN_DAG_NOT_EXECUTED_COVERAGE);
    expect(view.honesty).toMatch(/not executed coverage/i);
  });

  it("lists from→to compiler edges for a 2-pin compile with a declared dependency", () => {
    const pins = [markerPin, reconPin];
    const compiled = compileBasCampaignDag(pins);
    expect(compiled.error).toBeNull();
    expect(compiled.graph?.edges).toEqual([{ from: "marker", to: "recon" }]);

    const view = presentCampaignDagView({
      graph: { edges: [], executionOrder: [], nodes: [] },
      pins,
      startable: true
    });

    expect(view.empty).toBe(false);
    expect(view.compiled).toBe(true);
    expect(view.executedCoverage).toBe(false);
    expect(view.honesty).toMatch(/not executed coverage/i);
    expect(view.edges).toEqual([
      {
        from: "marker",
        id: "bas-campaign-dag-edge-marker-recon",
        label: "marker depends on recon",
        to: "recon"
      }
    ]);
    expect(view.edges.map((edge) => edge.id)).toEqual([
      "bas-campaign-dag-edge-marker-recon"
    ]);
  });

  it("does not invent edges for a 1-node compiled graph", () => {
    const pins = [
      {
        dependsOn: [] as string[],
        provider: "ControlPlane",
        upstreamId: "control.detection.benign-marker"
      }
    ];
    const compiled = compileBasCampaignDag(pins);
    expect(compiled.graph?.edges).toEqual([]);

    const view = presentCampaignDagView({
      graph: compiled.graph,
      pins,
      startable: true
    });

    expect(view.compiled).toBe(true);
    expect(view.executedCoverage).toBe(false);
    expect(view.edges).toEqual([]);
    expect(view.executionOrder).toEqual(["control.detection.benign-marker"]);
  });

  it("orders steps by compiled executionOrder, not pin array order", () => {
    const pins = [markerPin, reconPin];
    const compiled = compileBasCampaignDag(pins);
    expect(compiled.graph).not.toBeNull();
    const view = presentCampaignDagView({
      graph: compiled.graph,
      pins,
      startable: true
    });

    expect(view.empty).toBe(false);
    expect(view.compiled).toBe(true);
    expect(view.executedCoverage).toBe(false);
    expect(view.executionOrder).toEqual(["recon", "marker"]);
    expect(view.steps.map((step) => step.stepKey)).toEqual(["recon", "marker"]);
    expect(view.steps[0]).toMatchObject({
      index: 1,
      label: "startable",
      livePack: "none",
      stepKey: "recon"
    });
    expect(view.steps[1]).toMatchObject({
      dependsOn: ["recon"],
      index: 2,
      label: "startable",
      stepKey: "marker"
    });
    expect(view.edges).toEqual([
      {
        from: "marker",
        id: "bas-campaign-dag-edge-marker-recon",
        label: "marker depends on recon",
        to: "recon"
      }
    ]);
  });

  it("labels live Atomic, Caldera, and Metasploit pins as not live executable", () => {
    const pins = [
      {
        dependsOn: [] as string[],
        provider: "ControlPlane",
        stepKey: "marker",
        typedInputs: {},
        upstreamId: "control.detection.benign-marker"
      },
      {
        dependsOn: ["marker"],
        provider: "ControlPlane",
        stepKey: "atomic",
        typedInputs: {},
        upstreamId: "atomic.live"
      },
      {
        dependsOn: ["atomic"],
        provider: "ControlPlane",
        stepKey: "caldera",
        typedInputs: {},
        upstreamId: "caldera.live"
      },
      {
        dependsOn: ["caldera"],
        provider: "ControlPlane",
        stepKey: "metasploit",
        typedInputs: {},
        upstreamId: "metasploit.live"
      }
    ];
    const compiled = compileBasCampaignDag(pins);
    const view = presentCampaignDagView({
      graph: compiled.graph,
      pins,
      startable: false
    });

    expect(view.steps.map((step) => [step.stepKey, step.label])).toEqual([
      ["marker", "not startable"],
      ["atomic", "not live executable"],
      ["caldera", "not live executable"],
      ["metasploit", "not live executable"]
    ]);
    expect(view.executedCoverage).toBe(false);
    expect(view.honesty).toMatch(/not executed coverage/i);
  });
});
