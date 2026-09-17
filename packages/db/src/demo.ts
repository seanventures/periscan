import type { PrismaClient } from "@prisma/client";

export const DEMO_TENANT_ID = "11111111-1111-4111-8111-111111111111";
export const DEMO_USER_ID = "22222222-2222-4222-8222-222222222222";
export const DEMO_EMAIL = "demo@periscan.local";
export const DEMO_PASSWORD = "periscan-demo-password";
export const DEMO_TENANT_NAME = "Periscan Demo Tenant";
export const DEMO_SCOPE_VALUE = "demo.example.com";

export const DEMO_CONNECTOR_BLUEPRINTS = [
  {
    config: {},
    connectorKey: "github",
    mockMode: true
  },
  {
    config: {},
    connectorKey: "aws",
    mockMode: true
  },
  {
    config: {
      autoCloseTickets: true
    },
    connectorKey: "jira",
    mockMode: true
  },
  {
    config: {},
    connectorKey: "splunk",
    mockMode: true
  }
] as const;

export const DEMO_RESET_OPERATIONS = [
  {
    clientKey: "teeAssuranceDecision",
    label: "teeAssuranceDecision"
  },
  {
    clientKey: "teeAssuranceRequirement",
    label: "teeAssuranceRequirement"
  },
  {
    clientKey: "confidentialAttestation",
    label: "confidentialAttestation"
  },
  {
    clientKey: "veraisonAttestationSession",
    label: "veraisonAttestationSession"
  },
  {
    clientKey: "confidentialAttestationChallenge",
    label: "confidentialAttestationChallenge"
  },
  {
    clientKey: "agentWorkflowCheckpoint",
    label: "agentWorkflowCheckpoint"
  },
  {
    clientKey: "agentWorkflowEvent",
    label: "agentWorkflowEvent"
  },
  {
    clientKey: "agentWorkflowRun",
    label: "agentWorkflowRun"
  },
  {
    clientKey: "agentWorkflowDefinition",
    label: "agentWorkflowDefinition"
  },
  {
    clientKey: "modelGatewayAuditEvent",
    label: "modelGatewayAuditEvent"
  },
  {
    clientKey: "modelToolIntervention",
    label: "modelToolIntervention"
  },
  {
    clientKey: "modelSession",
    label: "modelSession"
  },
  {
    clientKey: "modelPolicyProfile",
    label: "modelPolicyProfile"
  },
  {
    clientKey: "modelProvider",
    label: "modelProvider"
  },
  {
    clientKey: "asyncOperationsEvent",
    label: "asyncOperationsEvent"
  },
  {
    clientKey: "asyncOperationsPolicy",
    label: "asyncOperationsPolicy"
  },
  {
    clientKey: "verificationEvent",
    label: "verificationEvent"
  },
  {
    clientKey: "job",
    label: "job"
  },
  {
    clientKey: "runnerTask",
    label: "runnerTask"
  },
  {
    clientKey: "runnerHeartbeatSample",
    label: "runnerHeartbeatSample"
  },
  {
    clientKey: "runner",
    label: "runner"
  },
  {
    clientKey: "runnerFleetPolicy",
    label: "runnerFleetPolicy"
  },
  {
    clientKey: "runnerRegistrationToken",
    label: "runnerRegistrationToken"
  },
  {
    clientKey: "missionSchedule",
    label: "missionSchedule"
  },
  {
    clientKey: "remediationTask",
    label: "remediationTask"
  },
  {
    clientKey: "pathBreaker",
    label: "pathBreaker"
  },
  {
    clientKey: "pathEdge",
    label: "pathEdge"
  },
  {
    clientKey: "pathNode",
    label: "pathNode"
  },
  {
    clientKey: "attackPath",
    label: "attackPath"
  },
  {
    clientKey: "graphEdge",
    label: "graphEdge"
  },
  {
    clientKey: "graphNode",
    label: "graphNode"
  },
  {
    clientKey: "evidenceArtifact",
    label: "evidenceArtifact"
  },
  {
    clientKey: "evidencePack",
    label: "evidencePack"
  },
  {
    clientKey: "validationRun",
    label: "validationRun"
  },
  {
    clientKey: "validationMission",
    label: "validationMission"
  },
  {
    clientKey: "policyDecision",
    label: "policyDecision"
  },
  {
    clientKey: "signalEnvelope",
    label: "signalEnvelope"
  },
  {
    clientKey: "exposure",
    label: "exposure"
  },
  {
    clientKey: "controlSource",
    label: "controlSource"
  },
  {
    clientKey: "aIApplication",
    label: "aiApplication"
  },
  {
    clientKey: "identity",
    label: "identity"
  },
  {
    clientKey: "asset",
    label: "asset"
  },
  {
    clientKey: "integration",
    label: "integration"
  },
  {
    clientKey: "scope",
    label: "scope"
  },
  {
    clientKey: "auditEvent",
    label: "auditEvent"
  }
] as const;

export type DemoResetOperation = (typeof DEMO_RESET_OPERATIONS)[number];

interface DeleteManyModel {
  deleteMany(args: { where: { tenantId: string } }): Promise<unknown>;
}

type DemoResetClientKey = DemoResetOperation["clientKey"];

export interface DemoResetPrismaClient {
  teeAssuranceDecision: DeleteManyModel;
  teeAssuranceRequirement: DeleteManyModel;
  confidentialAttestation: DeleteManyModel;
  veraisonAttestationSession: DeleteManyModel;
  confidentialAttestationChallenge: DeleteManyModel;
  agentWorkflowCheckpoint: DeleteManyModel;
  agentWorkflowEvent: DeleteManyModel;
  agentWorkflowRun: DeleteManyModel;
  agentWorkflowDefinition: DeleteManyModel;
  modelGatewayAuditEvent: DeleteManyModel;
  modelToolIntervention: DeleteManyModel;
  modelSession: DeleteManyModel;
  modelPolicyProfile: DeleteManyModel;
  modelProvider: DeleteManyModel;
  asyncOperationsEvent: DeleteManyModel;
  asyncOperationsPolicy: DeleteManyModel;
  verificationEvent: DeleteManyModel;
  job: DeleteManyModel;
  runnerTask: DeleteManyModel;
  runnerHeartbeatSample: DeleteManyModel;
  runner: DeleteManyModel;
  runnerFleetPolicy: DeleteManyModel;
  runnerRegistrationToken: DeleteManyModel;
  missionSchedule: DeleteManyModel;
  remediationTask: DeleteManyModel;
  pathBreaker: DeleteManyModel;
  pathEdge: DeleteManyModel;
  pathNode: DeleteManyModel;
  attackPath: DeleteManyModel;
  graphEdge: DeleteManyModel;
  graphNode: DeleteManyModel;
  evidenceArtifact: DeleteManyModel;
  evidencePack: DeleteManyModel;
  validationRun: DeleteManyModel;
  validationMission: DeleteManyModel;
  policyDecision: DeleteManyModel;
  signalEnvelope: DeleteManyModel;
  exposure: DeleteManyModel;
  controlSource: DeleteManyModel;
  aIApplication: DeleteManyModel;
  identity: DeleteManyModel;
  asset: DeleteManyModel;
  integration: DeleteManyModel;
  scope: DeleteManyModel;
  auditEvent: DeleteManyModel;
}

export async function resetDemoTenantScenario(
  prisma: Pick<PrismaClient, DemoResetClientKey> & DemoResetPrismaClient,
  tenantId: string
) {
  for (const operation of DEMO_RESET_OPERATIONS) {
    await prisma[operation.clientKey].deleteMany({
      where: {
        tenantId
      }
    });
  }
}

export function getDemoBootstrapDefinition() {
  return {
    connectors: DEMO_CONNECTOR_BLUEPRINTS.map((connector) => ({
      ...connector,
      config: {
        ...connector.config
      }
    })),
    credentials: {
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD
    },
    scope: {
      externalValidationProfileId: "safe-baseline",
      scopeType: "Domain" as const,
      value: DEMO_SCOPE_VALUE
    },
    tenant: {
      tenantId: DEMO_TENANT_ID,
      tenantName: DEMO_TENANT_NAME
    },
    user: {
      userId: DEMO_USER_ID
    }
  };
}
