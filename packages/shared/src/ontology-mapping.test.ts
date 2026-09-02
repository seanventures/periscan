import { describe, expect, it } from "vitest";

import {
  graphNodeTypeToRelatedEntityType,
  pathEntityMatchesGraphNodeType,
  relatedEntityTypeToGraphNodeType
} from "./ontology-mapping.js";

describe("PathNode ↔ GraphNode ontology mapping (P11-11 / P11R-2)", () => {
  it("maps common path entity types to bare graph node types 1:1", () => {
    expect(relatedEntityTypeToGraphNodeType("Asset")).toBe("Asset");
    expect(relatedEntityTypeToGraphNodeType("Exposure")).toBe("Exposure");
    expect(relatedEntityTypeToGraphNodeType("ValidationRun")).toBe(
      "ValidationRun"
    );
    expect(relatedEntityTypeToGraphNodeType("AttackPath")).toBe("AttackPath");
    expect(relatedEntityTypeToGraphNodeType("RemediationTask")).toBe(
      "RemediationTask"
    );
  });

  it("does not collapse Mission→Run, Scope→Asset, Integration→ControlSource (P11R-2)", () => {
    expect(relatedEntityTypeToGraphNodeType("ValidationMission")).toBe(
      "ValidationMission"
    );
    expect(relatedEntityTypeToGraphNodeType("Scope")).toBe("Scope");
    expect(relatedEntityTypeToGraphNodeType("Integration")).toBe("Integration");
    expect(relatedEntityTypeToGraphNodeType("Runner")).toBe("Runner");
    expect(relatedEntityTypeToGraphNodeType("RunnerTask")).toBe("RunnerTask");
    expect(relatedEntityTypeToGraphNodeType("ThreatAdvisory")).toBe(
      "ThreatAdvisory"
    );
    expect(relatedEntityTypeToGraphNodeType("Scenario")).toBe("Scenario");

    expect(graphNodeTypeToRelatedEntityType("ValidationMission")).toBe(
      "ValidationMission"
    );
    expect(graphNodeTypeToRelatedEntityType("ValidationRun")).toBe(
      "ValidationRun"
    );
    expect(graphNodeTypeToRelatedEntityType("Scope")).toBe("Scope");
    expect(graphNodeTypeToRelatedEntityType("Integration")).toBe("Integration");
    expect(pathEntityMatchesGraphNodeType("ValidationMission", "ValidationRun")).toBe(
      false
    );
    expect(pathEntityMatchesGraphNodeType("Scope", "Asset")).toBe(false);
    expect(pathEntityMatchesGraphNodeType("Integration", "ControlSource")).toBe(
      false
    );
  });

  it("prefers Family.Leaf when leaf is an allowed Asset/Exposure subtype", () => {
    expect(relatedEntityTypeToGraphNodeType("Asset", "CloudResource")).toBe(
      "Asset.CloudResource"
    );
    expect(relatedEntityTypeToGraphNodeType("Exposure", "SecretExposure")).toBe(
      "Exposure.SecretExposure"
    );
  });

  it("falls back to bare type when leaf is not allowlisted (P11R-1)", () => {
    expect(
      relatedEntityTypeToGraphNodeType("Asset", "NotARealAssetType!!!")
    ).toBe("Asset");
    expect(
      relatedEntityTypeToGraphNodeType("Exposure", "AlibabaEcsPublicExposure")
    ).toBe("Exposure");
  });

  it("returns null for unmapped product entity types", () => {
    expect(relatedEntityTypeToGraphNodeType("TenantWebhook")).toBeNull();
    expect(relatedEntityTypeToGraphNodeType("AuditEvent")).toBeNull();
  });

  it("projects graph nodeType families back to RelatedEntityType", () => {
    expect(graphNodeTypeToRelatedEntityType("Asset")).toBe("Asset");
    expect(graphNodeTypeToRelatedEntityType("Asset.CloudResource")).toBe(
      "Asset"
    );
    expect(graphNodeTypeToRelatedEntityType("EvidenceArtifact")).toBe(
      "EvidencePack"
    );
    expect(graphNodeTypeToRelatedEntityType("not-a-type")).toBeNull();
  });

  it("matches path entity to graph nodeType families", () => {
    expect(pathEntityMatchesGraphNodeType("Asset", "Asset.Host")).toBe(true);
    expect(pathEntityMatchesGraphNodeType("Asset", "Exposure.Secret")).toBe(
      false
    );
    expect(pathEntityMatchesGraphNodeType("Exposure", "Exposure")).toBe(true);
  });
});
