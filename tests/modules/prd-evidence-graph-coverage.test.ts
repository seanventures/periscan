import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { createInMemoryEvidenceGraphService } from "../../packages/evidence/src/graph.js";
import {
  EdgeRelationshipSchema,
  GraphNodeSchema
} from "../../packages/shared/src/domain.js";

async function readRepoFile(path: string) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

function sectionBetween(
  source: string,
  startHeader: string,
  nextHeader: string
) {
  const start = source.indexOf(startHeader);

  if (start === -1) {
    throw new Error(`Unable to find section header: ${startHeader}`);
  }

  const end = source.indexOf(nextHeader, start + startHeader.length);

  if (end === -1) {
    throw new Error(`Unable to find next section header: ${nextHeader}`);
  }

  return source.slice(start, end);
}

function parseBulletsBetween(
  source: string,
  startHeader: string,
  nextHeader: string
) {
  return sectionBetween(source, startHeader, nextHeader)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2));
}

function graphNodeTypeFor(prdNodeName: string) {
  return `PRD.${prdNodeName}`;
}

describe("PRD section 12 Evidence Graph coverage", () => {
  it("keeps PRD graph nodes representable in shared contracts and Postgres graph tables", async () => {
    const [prd, prismaSchema] = await Promise.all([
      readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md"),
      readRepoFile("packages/db/prisma/schema.prisma")
    ]);
    const evidenceGraphSection = sectionBetween(
      prd,
      "## 12. Evidence Graph",
      "## 13. Risk Scoring"
    );
    const prdNodes = parseBulletsBetween(
      evidenceGraphSection,
      "### 12.1 Nodes",
      "### 12.2 Edges"
    );

    expect(prdNodes).toEqual([
      "Asset",
      "Identity",
      "Permission",
      "CloudResource",
      "Repository",
      "Secret",
      "Exposure",
      "Vulnerability",
      "ControlSource",
      "AIApplication",
      "ValidationRun",
      "EvidenceArtifact",
      "AttackPath",
      "RemediationTask",
      "VerificationEvent"
    ]);
    expect(prismaSchema).toContain("model GraphNode");
    expect(prismaSchema).toContain("nodeType          String");
    expect(prismaSchema).toContain("nodeKey           String");
    expect(prismaSchema).toContain("properties        Json");
    expect(prismaSchema).toContain("@@unique([tenantId, nodeType, nodeKey])");

    for (const prdNodeName of prdNodes) {
      const parsedNode = GraphNodeSchema.parse({
        createdAt: "2026-06-28T00:00:00.000Z",
        evidenceIds: [],
        graphNodeId: randomUUID(),
        label: prdNodeName,
        nodeKey: `prd:${prdNodeName.toLowerCase()}`,
        nodeType: graphNodeTypeFor(prdNodeName),
        properties: {
          source: "prd-section-12"
        },
        relatedEntityId: null,
        relatedEntityType: null,
        tenantId: randomUUID(),
        updatedAt: "2026-06-28T00:00:00.000Z"
      });

      expect(parsedNode.nodeType).toBe(graphNodeTypeFor(prdNodeName));
    }
  });

  it("keeps PRD graph edges aligned with shared and Prisma relationship enums", async () => {
    const [prd, prismaSchema] = await Promise.all([
      readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md"),
      readRepoFile("packages/db/prisma/schema.prisma")
    ]);
    const evidenceGraphSection = sectionBetween(
      prd,
      "## 12. Evidence Graph",
      "## 13. Risk Scoring"
    );
    const prdEdges = parseBulletsBetween(
      evidenceGraphSection,
      "### 12.2 Edges",
      "### 12.3 Required Questions"
    );
    const sharedEdges = new Set(EdgeRelationshipSchema.options);

    expect(prdEdges).toEqual([
      "RELATES_TO",
      "CAN_ACCESS",
      "EXPOSES",
      "DETECTED_BY",
      "BLOCKED_BY",
      "MISSED_BY",
      "VALIDATED_BY",
      "FIXED_BY",
      "REOPENED_BY",
      "LEADS_TO",
      "OBSERVED_BY",
      "REMEDIATED_BY"
    ]);

    for (const relationship of prdEdges) {
      expect(sharedEdges.has(relationship), relationship).toBe(true);
      expect(
        prismaSchema,
        `${relationship} should exist in Prisma EdgeRelationship`
      ).toContain(`  ${relationship}`);
    }
  });

  it("answers PRD graph questions through evidence-linked nodes, edges, paths, breakers, and state changes", async () => {
    const prd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const questions = parseBulletsBetween(
      prd,
      "### 12.3 Required Questions",
      "## 13. Risk Scoring"
    );
    const graph = createInMemoryEvidenceGraphService();
    const tenantId = randomUUID();
    const evidenceId = randomUUID();

    expect(questions).toEqual([
      "What can reach what?",
      "Which identity can access which resource?",
      "Which secret leads to which cloud role?",
      "Which control should have detected this?",
      "Did the control work?",
      "Which path has highest impact?",
      "Which fix breaks the most paths?",
      "Which risks were closed without proof?",
      "Which risks came back?"
    ]);

    const identity = await graph.upsertNode({
      evidenceIds: [evidenceId],
      label: "Privileged identity",
      nodeKey: "identity:admin",
      nodeType: "Identity.Privileged",
      properties: {},
      relatedEntityId: randomUUID(),
      relatedEntityType: "Identity",
      tenantId
    });
    const secret = await graph.upsertNode({
      evidenceIds: [evidenceId],
      label: "Repository secret",
      nodeKey: "secret:repo",
      nodeType: "Secret.RepositoryCredential",
      properties: {},
      relatedEntityId: randomUUID(),
      relatedEntityType: "Exposure",
      tenantId
    });
    const cloudRole = await graph.upsertNode({
      evidenceIds: [evidenceId],
      label: "Production cloud role",
      nodeKey: "cloud-role:prod",
      nodeType: "CloudResource.Role",
      properties: {},
      relatedEntityId: randomUUID(),
      relatedEntityType: "Asset",
      tenantId
    });
    const exposure = await graph.upsertNode({
      evidenceIds: [evidenceId],
      label: "Validated exposure",
      nodeKey: "exposure:public-admin",
      nodeType: "Exposure.PublicAdmin",
      properties: {},
      relatedEntityId: randomUUID(),
      relatedEntityType: "Exposure",
      tenantId
    });
    const control = await graph.upsertNode({
      evidenceIds: [evidenceId],
      label: "SIEM control",
      nodeKey: "control:siem",
      nodeType: "ControlSource.SIEM",
      properties: {},
      relatedEntityId: randomUUID(),
      relatedEntityType: "ControlSource",
      tenantId
    });

    const identityAccess = await graph.upsertEdge({
      evidenceIds: [evidenceId],
      properties: {},
      rationale: "Identity has effective access to the resource.",
      relationship: "CAN_ACCESS",
      sourceNodeId: identity.graphNodeId,
      targetNodeId: cloudRole.graphNodeId,
      tenantId
    });
    const secretToRole = await graph.upsertEdge({
      evidenceIds: [evidenceId],
      properties: {},
      rationale: "Repository secret leads to a cloud role.",
      relationship: "LEADS_TO",
      sourceNodeId: secret.graphNodeId,
      targetNodeId: cloudRole.graphNodeId,
      tenantId
    });
    await graph.upsertEdge({
      evidenceIds: [evidenceId],
      properties: {},
      rationale: "The SIEM should have detected the exposure scenario.",
      relationship: "MISSED_BY",
      sourceNodeId: exposure.graphNodeId,
      targetNodeId: control.graphNodeId,
      tenantId
    });

    const identityPaths = await graph.findPaths({
      maxDepth: 2,
      sourceNodeId: identity.graphNodeId,
      targetNodeId: cloudRole.graphNodeId,
      tenantId
    });
    const secretPaths = await graph.findPaths({
      maxDepth: 2,
      sourceNodeId: secret.graphNodeId,
      targetNodeId: cloudRole.graphNodeId,
      tenantId
    });
    const controlNeighbors = await graph.getNeighbors(
      tenantId,
      exposure.graphNodeId
    );

    expect(identityPaths[0]?.edgeIds).toEqual([identityAccess.graphEdgeId]);
    expect(secretPaths[0]?.edgeIds).toEqual([secretToRole.graphEdgeId]);
    expect(controlNeighbors.edges.map((edge) => edge.relationship)).toContain(
      "MISSED_BY"
    );

    const highImpactPath = await graph.createAttackPath({
      confidence: 0.91,
      edgeIds: [secretToRole.graphEdgeId],
      evidenceBasis: "Measured",
      evidenceIds: [evidenceId],
      impactScore: 95,
      name: "Secret to production role",
      nodeIds: [secret.graphNodeId, cloudRole.graphNodeId],
      pathBreakers: [
        {
          description:
            "Rotate the secret and revoke the attached role session.",
          evidenceIds: [evidenceId],
          priority: 1,
          relatedNodeId: secret.graphNodeId,
          title: "Rotate exposed credential"
        }
      ],
      tenantId,
      validationState: "Validated"
    });
    const lowerImpactPath = await graph.createAttackPath({
      confidence: 0.75,
      edgeIds: [identityAccess.graphEdgeId],
      evidenceBasis: "Measured",
      evidenceIds: [evidenceId],
      impactScore: 55,
      name: "Admin identity to production role",
      nodeIds: [identity.graphNodeId, cloudRole.graphNodeId],
      pathBreakers: [
        {
          description: "Reduce identity privileges on the production role.",
          evidenceIds: [evidenceId],
          priority: 2,
          relatedNodeId: identity.graphNodeId,
          title: "Reduce identity privilege"
        }
      ],
      tenantId,
      validationState: "Validated"
    });

    const highestImpactPath = [lowerImpactPath, highImpactPath].sort(
      (left, right) => right.impactScore - left.impactScore
    )[0];
    const breakerCoverage = [highImpactPath, lowerImpactPath].reduce<
      Record<string, number>
    >((counts, path) => {
      for (const breaker of path.pathBreakers) {
        counts[breaker.title] = (counts[breaker.title] ?? 0) + 1;
      }
      return counts;
    }, {});

    expect(highestImpactPath?.pathId).toBe(highImpactPath.pathId);
    expect(breakerCoverage["Rotate exposed credential"]).toBe(1);

    const closedWithoutProof = await graph.updatePathState(
      highImpactPath.pathId,
      "ClosedWithoutEvidence"
    );
    const reopened = await graph.updatePathState(
      highImpactPath.pathId,
      "Reopened"
    );

    expect(closedWithoutProof.validationState).toBe("ClosedWithoutEvidence");
    expect(reopened.validationState).toBe("Reopened");
  });
});
