-- CreateEnum
CREATE TYPE "TenantType" AS ENUM ('Organization', 'MSSP', 'Client');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('Invited', 'Active', 'Disabled');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('Owner', 'Admin', 'SecurityEngineer', 'Viewer', 'MSSPOwner', 'ClientAdmin');

-- CreateEnum
CREATE TYPE "ScopeType" AS ENUM ('Domain', 'Subdomain', 'IPRange', 'CloudAccount', 'Repository', 'AIApplicationEndpoint', 'InternalNetwork', 'ControlSource');

-- CreateEnum
CREATE TYPE "ScopeVerificationStatus" AS ENUM ('Pending', 'Verified', 'Rejected');

-- CreateEnum
CREATE TYPE "IntegrationCategory" AS ENUM ('Cloud', 'Identity', 'Code', 'SecurityControl', 'Ticketing', 'AIStack', 'MSSP', 'Other');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('Created', 'Connected', 'Disconnected', 'Error');

-- CreateEnum
CREATE TYPE "IntegrationHealthStatus" AS ENUM ('Healthy', 'Degraded', 'Unhealthy', 'Unknown');

-- CreateEnum
CREATE TYPE "ValidationState" AS ENUM ('Discovered', 'Reachable', 'Validated', 'Exploitable', 'Detected', 'Blocked', 'Logged', 'Alerted', 'Missed', 'Mitigated', 'Inconclusive', 'Fixed', 'Reopened', 'ClosedWithoutEvidence');

-- CreateEnum
CREATE TYPE "SafetyLevel" AS ENUM ('PassiveReadOnly', 'ActiveNonInvasive', 'ControlledValidation', 'BASLite', 'AdvancedAdversarial', 'Disallowed');

-- CreateEnum
CREATE TYPE "SignalCategory" AS ENUM ('Asset', 'Identity', 'Exposure', 'ControlObservation', 'Repository', 'Cloud', 'AIApplication', 'Remediation', 'Evidence', 'Audit');

-- CreateEnum
CREATE TYPE "SensitivityLevel" AS ENUM ('Low', 'Moderate', 'High', 'Restricted');

-- CreateEnum
CREATE TYPE "RedactionStatus" AS ENUM ('NotRequired', 'Redacted', 'Blocked');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('Repository', 'Service', 'Host', 'Container', 'Kubernetes', 'CloudResource', 'Domain', 'Application', 'IdentityStore', 'Other');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('Active', 'Inactive', 'Archived');

-- CreateEnum
CREATE TYPE "BusinessCriticality" AS ENUM ('Low', 'Moderate', 'High', 'Critical');

-- CreateEnum
CREATE TYPE "IdentityType" AS ENUM ('Human', 'ServiceAccount', 'Role', 'Group', 'APIKey', 'Other');

-- CreateEnum
CREATE TYPE "MFAStatus" AS ENUM ('Enabled', 'Disabled', 'Unknown');

-- CreateEnum
CREATE TYPE "PrivilegeLevel" AS ENUM ('Standard', 'Privileged', 'Administrator', 'Unknown');

-- CreateEnum
CREATE TYPE "ControlSourceType" AS ENUM ('EDR', 'XDR', 'SIEM', 'SOAR', 'MDR', 'WAF', 'Firewall', 'MFA', 'EmailSecurity', 'CloudGuardrail', 'AIGuardrail');

-- CreateEnum
CREATE TYPE "AIApplicationType" AS ENUM ('Chatbot', 'Copilot', 'Agent', 'RAG', 'Workflow', 'Other');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('Critical', 'High', 'Medium', 'Low', 'Informational');

-- CreateEnum
CREATE TYPE "ExposureStatus" AS ENUM ('Open', 'Accepted', 'Mitigated', 'Fixed', 'Archived');

-- CreateEnum
CREATE TYPE "MissionType" AS ENUM ('ValidationSnapshot', 'ExposureValidation', 'ControlValidation', 'AIAppValidation', 'FixVerification', 'ContinuousValidation');

-- CreateEnum
CREATE TYPE "MissionStatus" AS ENUM ('Draft', 'Queued', 'Running', 'Completed', 'Failed', 'DeniedByPolicy', 'RequiresApproval', 'Cancelled');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('Queued', 'Running', 'Completed', 'Failed', 'DeniedByPolicy', 'RequiresApproval', 'Cancelled');

-- CreateEnum
CREATE TYPE "EvidenceArtifactType" AS ENUM ('RawModuleOutput', 'NormalizedEvidence', 'ReportExport', 'Screenshot', 'Transcript', 'Attachment');

-- CreateEnum
CREATE TYPE "RelatedEntityType" AS ENUM ('Tenant', 'Scope', 'Integration', 'Asset', 'Identity', 'ControlSource', 'AIApplication', 'Exposure', 'ValidationMission', 'ValidationRun', 'AttackPath', 'RemediationTask', 'VerificationEvent', 'EvidencePack', 'AuditEvent');

-- CreateEnum
CREATE TYPE "EdgeRelationship" AS ENUM ('RELATES_TO', 'CAN_ACCESS', 'EXPOSES', 'DETECTED_BY', 'BLOCKED_BY', 'MISSED_BY', 'VALIDATED_BY', 'FIXED_BY', 'REOPENED_BY', 'LEADS_TO', 'OBSERVED_BY', 'REMEDIATED_BY');

-- CreateEnum
CREATE TYPE "RemediationStatus" AS ENUM ('Open', 'InProgress', 'VerificationPending', 'Fixed', 'PartiallyFixed', 'StillExposed', 'Mitigated', 'Inconclusive', 'Reopened', 'ClosedWithoutEvidence');

-- CreateEnum
CREATE TYPE "VerificationOutcome" AS ENUM ('Fixed', 'PartiallyFixed', 'StillExposed', 'Mitigated', 'Inconclusive', 'Reopened', 'ClosedWithoutEvidence');

-- CreateEnum
CREATE TYPE "EvidencePackType" AS ENUM ('ExecutiveRiskSummary', 'CustomerSecurityReview', 'CyberInsuranceEvidence', 'SOC2Support', 'ISOSupport', 'PCISupport', 'ControlValidationReport', 'AIAppValidationReport', 'CTEMProgramSummary', 'MSSPClientQBR', 'TechnicalAppendix', 'RemediationClosurePack', 'ValidationSnapshotReport');

-- CreateEnum
CREATE TYPE "EvidencePackStatus" AS ENUM ('Draft', 'Ready', 'Exported');

-- CreateEnum
CREATE TYPE "AuditEventAction" AS ENUM ('login', 'tenant_created', 'integration_connected', 'integration_disconnected', 'scope_created', 'scope_verified', 'policy_decision', 'mission_created', 'mission_started', 'mission_cancelled', 'module_executed', 'evidence_created', 'report_generated', 'remediation_created', 'verification_run', 'runner_registered', 'runner_task_executed', 'user_invited', 'role_changed');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('Queued', 'Running', 'Completed', 'Failed', 'DeniedByPolicy', 'RequiresApproval', 'Cancelled');

-- CreateTable
CREATE TABLE "tenants" (
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TenantType" NOT NULL,
    "parent_tenant_id" UUID,
    "billing_account_id" TEXT,
    "data_region" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateTable
CREATE TABLE "users" (
    "user_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "membership_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("membership_id")
);

-- CreateTable
CREATE TABLE "scopes" (
    "scope_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "scope_type" "ScopeType" NOT NULL,
    "value" TEXT NOT NULL,
    "verification_method" TEXT,
    "verification_status" "ScopeVerificationStatus" NOT NULL DEFAULT 'Pending',
    "verification_token" TEXT,
    "verified_at" TIMESTAMP(3),
    "verified_by" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scopes_pkey" PRIMARY KEY ("scope_id")
);

-- CreateTable
CREATE TABLE "integrations" (
    "integration_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "vendor" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "category" "IntegrationCategory" NOT NULL,
    "auth_type" TEXT NOT NULL,
    "status" "IntegrationStatus" NOT NULL,
    "health_status" "IntegrationHealthStatus" NOT NULL DEFAULT 'Unknown',
    "last_sync_at" TIMESTAMP(3),
    "permissions_summary" JSONB NOT NULL,
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("integration_id")
);

-- CreateTable
CREATE TABLE "assets" (
    "asset_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "asset_type" "AssetType" NOT NULL,
    "name" TEXT NOT NULL,
    "identifiers" JSONB NOT NULL,
    "environment" TEXT,
    "owner" TEXT,
    "business_criticality" "BusinessCriticality" NOT NULL,
    "internet_exposed" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[],
    "first_seen_at" TIMESTAMP(3),
    "last_seen_at" TIMESTAMP(3),
    "status" "AssetStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("asset_id")
);

-- CreateTable
CREATE TABLE "identities" (
    "identity_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "identity_type" "IdentityType" NOT NULL,
    "username" TEXT,
    "email" TEXT,
    "privilege_level" "PrivilegeLevel" NOT NULL,
    "mfa_status" "MFAStatus" NOT NULL,
    "groups" TEXT[],
    "roles" TEXT[],
    "risk_flags" TEXT[],
    "first_seen_at" TIMESTAMP(3),
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "identities_pkey" PRIMARY KEY ("identity_id")
);

-- CreateTable
CREATE TABLE "control_sources" (
    "control_source_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "control_type" "ControlSourceType" NOT NULL,
    "provider" TEXT NOT NULL,
    "integration_id" UUID NOT NULL,
    "expected_behaviors" TEXT[],
    "telemetry_status" "IntegrationHealthStatus" NOT NULL DEFAULT 'Unknown',
    "last_validated_at" TIMESTAMP(3),
    "health_status" "IntegrationHealthStatus" NOT NULL DEFAULT 'Unknown',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "control_sources_pkey" PRIMARY KEY ("control_source_id")
);

-- CreateTable
CREATE TABLE "ai_applications" (
    "ai_app_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "app_type" "AIApplicationType" NOT NULL,
    "endpoint_url" TEXT NOT NULL,
    "auth_method" TEXT NOT NULL,
    "rag_enabled" BOOLEAN NOT NULL DEFAULT false,
    "tools_enabled" BOOLEAN NOT NULL DEFAULT false,
    "data_sources_description" TEXT NOT NULL,
    "guardrails_description" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "scope_id" UUID NOT NULL,
    "last_validated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_applications_pkey" PRIMARY KEY ("ai_app_id")
);

-- CreateTable
CREATE TABLE "exposures" (
    "exposure_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "asset_id" UUID,
    "exposure_type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "validation_state" "ValidationState" NOT NULL,
    "first_seen_at" TIMESTAMP(3),
    "last_seen_at" TIMESTAMP(3),
    "status" "ExposureStatus" NOT NULL,
    "evidence_ids" UUID[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exposures_pkey" PRIMARY KEY ("exposure_id")
);

-- CreateTable
CREATE TABLE "validation_missions" (
    "mission_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "mission_type" "MissionType" NOT NULL,
    "requested_by" UUID NOT NULL,
    "scope_id" UUID NOT NULL,
    "scope_ids" UUID[],
    "policy_decision_id" UUID,
    "policy_profile" TEXT,
    "safety_level" "SafetyLevel" NOT NULL,
    "status" "MissionStatus" NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "evidence_ids" UUID[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "validation_missions_pkey" PRIMARY KEY ("mission_id")
);

-- CreateTable
CREATE TABLE "validation_runs" (
    "run_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "mission_id" UUID NOT NULL,
    "module_id" TEXT NOT NULL,
    "runner_id" TEXT,
    "scope_id" UUID NOT NULL,
    "policy_decision_id" UUID,
    "safety_level" "SafetyLevel" NOT NULL,
    "target" JSONB NOT NULL,
    "status" "RunStatus" NOT NULL,
    "outcome" TEXT,
    "validation_state" "ValidationState",
    "evidence_ids" UUID[],
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "error_summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "validation_runs_pkey" PRIMARY KEY ("run_id")
);

-- CreateTable
CREATE TABLE "signals" (
    "signal_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "source_integration_id" UUID,
    "source_type" TEXT NOT NULL,
    "source_vendor" TEXT NOT NULL,
    "signal_category" "SignalCategory" NOT NULL,
    "signal_subcategory" TEXT,
    "timestamp_observed" TIMESTAMP(3) NOT NULL,
    "timestamp_ingested" TIMESTAMP(3) NOT NULL,
    "confidence" DOUBLE PRECISION,
    "freshness" TEXT,
    "sensitivity_level" "SensitivityLevel" NOT NULL,
    "related_asset_ids" UUID[],
    "related_identity_ids" UUID[],
    "related_control_ids" UUID[],
    "related_path_ids" UUID[],
    "related_evidence_ids" UUID[],
    "raw_payload_pointer" TEXT,
    "redaction_status" "RedactionStatus" NOT NULL,
    "evidence_ids" UUID[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signals_pkey" PRIMARY KEY ("signal_id")
);

-- CreateTable
CREATE TABLE "evidence_artifacts" (
    "evidence_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "artifact_type" "EvidenceArtifactType" NOT NULL,
    "storage_uri" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "sensitivity_level" "SensitivityLevel" NOT NULL,
    "redaction_status" "RedactionStatus" NOT NULL,
    "related_entity_type" "RelatedEntityType" NOT NULL,
    "related_entity_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evidence_artifacts_pkey" PRIMARY KEY ("evidence_id")
);

-- CreateTable
CREATE TABLE "attack_paths" (
    "path_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "entry_node_id" UUID NOT NULL,
    "impact_node_id" UUID NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "impact_score" DOUBLE PRECISION NOT NULL,
    "validation_state" "ValidationState" NOT NULL,
    "evidence_ids" UUID[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attack_paths_pkey" PRIMARY KEY ("path_id")
);

-- CreateTable
CREATE TABLE "path_nodes" (
    "path_node_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "path_id" UUID NOT NULL,
    "entity_type" "RelatedEntityType" NOT NULL,
    "entity_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "evidence_ids" UUID[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "path_nodes_pkey" PRIMARY KEY ("path_node_id")
);

-- CreateTable
CREATE TABLE "path_edges" (
    "path_edge_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "path_id" UUID NOT NULL,
    "source_node_id" UUID NOT NULL,
    "target_node_id" UUID NOT NULL,
    "relationship" "EdgeRelationship" NOT NULL,
    "rationale" TEXT,
    "evidence_ids" UUID[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "path_edges_pkey" PRIMARY KEY ("path_edge_id")
);

-- CreateTable
CREATE TABLE "path_breakers" (
    "path_breaker_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "path_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "related_node_id" UUID,
    "evidence_ids" UUID[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "path_breakers_pkey" PRIMARY KEY ("path_breaker_id")
);

-- CreateTable
CREATE TABLE "remediation_tasks" (
    "remediation_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "related_path_id" UUID,
    "related_exposure_id" UUID,
    "owner" TEXT,
    "recommended_action" TEXT NOT NULL,
    "technical_steps" TEXT[],
    "verification_method" TEXT NOT NULL,
    "ticket_system" TEXT,
    "ticket_id" TEXT,
    "status" "RemediationStatus" NOT NULL,
    "verification_required" BOOLEAN NOT NULL DEFAULT true,
    "evidence_ids" UUID[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "remediation_tasks_pkey" PRIMARY KEY ("remediation_id")
);

-- CreateTable
CREATE TABLE "verification_events" (
    "verification_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "remediation_id" UUID NOT NULL,
    "validation_run_id" UUID,
    "previous_state" "ValidationState",
    "new_state" "ValidationState" NOT NULL,
    "outcome" "VerificationOutcome" NOT NULL,
    "evidence_ids" UUID[],
    "verified_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_events_pkey" PRIMARY KEY ("verification_id")
);

-- CreateTable
CREATE TABLE "evidence_packs" (
    "evidence_pack_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "pack_type" "EvidencePackType" NOT NULL,
    "title" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "redaction_level" "SensitivityLevel" NOT NULL,
    "status" "EvidencePackStatus" NOT NULL,
    "storage_uri" TEXT,
    "evidence_ids" UUID[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evidence_packs_pkey" PRIMARY KEY ("evidence_pack_id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "audit_event_id" UUID NOT NULL,
    "tenant_id" UUID,
    "user_id" UUID,
    "action" "AuditEventAction" NOT NULL,
    "actor_type" TEXT NOT NULL,
    "entity_type" "RelatedEntityType" NOT NULL,
    "entity_id" UUID,
    "metadata" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("audit_event_id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "job_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "mission_id" UUID,
    "validation_run_id" UUID,
    "queue_name" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,
    "dedupe_key" TEXT,
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("job_id")
);

-- CreateIndex
CREATE INDEX "tenants_created_at_idx" ON "tenants"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE INDEX "memberships_tenant_id_created_at_idx" ON "memberships"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "memberships_tenant_id_role_idx" ON "memberships"("tenant_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_tenant_id_user_id_key" ON "memberships"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "scopes_tenant_id_created_at_idx" ON "scopes"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "scopes_tenant_id_verification_status_idx" ON "scopes"("tenant_id", "verification_status");

-- CreateIndex
CREATE INDEX "scopes_tenant_id_scope_type_idx" ON "scopes"("tenant_id", "scope_type");

-- CreateIndex
CREATE INDEX "integrations_tenant_id_created_at_idx" ON "integrations"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "integrations_tenant_id_status_idx" ON "integrations"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "integrations_tenant_id_category_idx" ON "integrations"("tenant_id", "category");

-- CreateIndex
CREATE INDEX "assets_tenant_id_created_at_idx" ON "assets"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "assets_tenant_id_asset_type_idx" ON "assets"("tenant_id", "asset_type");

-- CreateIndex
CREATE INDEX "assets_tenant_id_status_idx" ON "assets"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "identities_tenant_id_created_at_idx" ON "identities"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "identities_tenant_id_identity_type_idx" ON "identities"("tenant_id", "identity_type");

-- CreateIndex
CREATE INDEX "identities_tenant_id_privilege_level_idx" ON "identities"("tenant_id", "privilege_level");

-- CreateIndex
CREATE INDEX "control_sources_tenant_id_created_at_idx" ON "control_sources"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "control_sources_tenant_id_control_type_idx" ON "control_sources"("tenant_id", "control_type");

-- CreateIndex
CREATE INDEX "control_sources_integration_id_idx" ON "control_sources"("integration_id");

-- CreateIndex
CREATE INDEX "ai_applications_tenant_id_created_at_idx" ON "ai_applications"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_applications_tenant_id_app_type_idx" ON "ai_applications"("tenant_id", "app_type");

-- CreateIndex
CREATE INDEX "ai_applications_scope_id_idx" ON "ai_applications"("scope_id");

-- CreateIndex
CREATE INDEX "exposures_tenant_id_created_at_idx" ON "exposures"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "exposures_tenant_id_validation_state_idx" ON "exposures"("tenant_id", "validation_state");

-- CreateIndex
CREATE INDEX "exposures_tenant_id_status_idx" ON "exposures"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "exposures_asset_id_idx" ON "exposures"("asset_id");

-- CreateIndex
CREATE INDEX "validation_missions_tenant_id_created_at_idx" ON "validation_missions"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "validation_missions_tenant_id_status_idx" ON "validation_missions"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "validation_missions_tenant_id_mission_type_idx" ON "validation_missions"("tenant_id", "mission_type");

-- CreateIndex
CREATE INDEX "validation_missions_scope_id_idx" ON "validation_missions"("scope_id");

-- CreateIndex
CREATE INDEX "validation_runs_tenant_id_created_at_idx" ON "validation_runs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "validation_runs_tenant_id_status_idx" ON "validation_runs"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "validation_runs_tenant_id_validation_state_idx" ON "validation_runs"("tenant_id", "validation_state");

-- CreateIndex
CREATE INDEX "validation_runs_mission_id_idx" ON "validation_runs"("mission_id");

-- CreateIndex
CREATE INDEX "signals_tenant_id_created_at_idx" ON "signals"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "signals_tenant_id_signal_category_idx" ON "signals"("tenant_id", "signal_category");

-- CreateIndex
CREATE INDEX "signals_source_integration_id_idx" ON "signals"("source_integration_id");

-- CreateIndex
CREATE INDEX "evidence_artifacts_tenant_id_created_at_idx" ON "evidence_artifacts"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "evidence_artifacts_tenant_id_related_entity_type_related_en_idx" ON "evidence_artifacts"("tenant_id", "related_entity_type", "related_entity_id");

-- CreateIndex
CREATE INDEX "attack_paths_tenant_id_created_at_idx" ON "attack_paths"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "attack_paths_tenant_id_validation_state_idx" ON "attack_paths"("tenant_id", "validation_state");

-- CreateIndex
CREATE INDEX "path_nodes_tenant_id_created_at_idx" ON "path_nodes"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "path_nodes_path_id_idx" ON "path_nodes"("path_id");

-- CreateIndex
CREATE UNIQUE INDEX "path_nodes_path_id_sequence_key" ON "path_nodes"("path_id", "sequence");

-- CreateIndex
CREATE INDEX "path_edges_tenant_id_created_at_idx" ON "path_edges"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "path_edges_path_id_idx" ON "path_edges"("path_id");

-- CreateIndex
CREATE INDEX "path_breakers_tenant_id_created_at_idx" ON "path_breakers"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "path_breakers_path_id_idx" ON "path_breakers"("path_id");

-- CreateIndex
CREATE INDEX "remediation_tasks_tenant_id_created_at_idx" ON "remediation_tasks"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "remediation_tasks_tenant_id_status_idx" ON "remediation_tasks"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "remediation_tasks_related_path_id_idx" ON "remediation_tasks"("related_path_id");

-- CreateIndex
CREATE INDEX "remediation_tasks_related_exposure_id_idx" ON "remediation_tasks"("related_exposure_id");

-- CreateIndex
CREATE INDEX "verification_events_tenant_id_created_at_idx" ON "verification_events"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "verification_events_tenant_id_outcome_idx" ON "verification_events"("tenant_id", "outcome");

-- CreateIndex
CREATE INDEX "verification_events_remediation_id_idx" ON "verification_events"("remediation_id");

-- CreateIndex
CREATE INDEX "evidence_packs_tenant_id_created_at_idx" ON "evidence_packs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "evidence_packs_tenant_id_status_idx" ON "evidence_packs"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "evidence_packs_tenant_id_pack_type_idx" ON "evidence_packs"("tenant_id", "pack_type");

-- CreateIndex
CREATE INDEX "audit_events_created_at_idx" ON "audit_events"("created_at");

-- CreateIndex
CREATE INDEX "audit_events_tenant_id_created_at_idx" ON "audit_events"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_events_action_idx" ON "audit_events"("action");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_dedupe_key_key" ON "jobs"("dedupe_key");

-- CreateIndex
CREATE INDEX "jobs_tenant_id_created_at_idx" ON "jobs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "jobs_tenant_id_status_idx" ON "jobs"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "jobs_mission_id_idx" ON "jobs"("mission_id");

-- CreateIndex
CREATE INDEX "jobs_validation_run_id_idx" ON "jobs"("validation_run_id");

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_parent_tenant_id_fkey" FOREIGN KEY ("parent_tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scopes" ADD CONSTRAINT "scopes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identities" ADD CONSTRAINT "identities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_sources" ADD CONSTRAINT "control_sources_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_sources" ADD CONSTRAINT "control_sources_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "integrations"("integration_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_applications" ADD CONSTRAINT "ai_applications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_applications" ADD CONSTRAINT "ai_applications_scope_id_fkey" FOREIGN KEY ("scope_id") REFERENCES "scopes"("scope_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exposures" ADD CONSTRAINT "exposures_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exposures" ADD CONSTRAINT "exposures_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("asset_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_missions" ADD CONSTRAINT "validation_missions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_runs" ADD CONSTRAINT "validation_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_runs" ADD CONSTRAINT "validation_runs_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "validation_missions"("mission_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signals" ADD CONSTRAINT "signals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signals" ADD CONSTRAINT "signals_source_integration_id_fkey" FOREIGN KEY ("source_integration_id") REFERENCES "integrations"("integration_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_artifacts" ADD CONSTRAINT "evidence_artifacts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attack_paths" ADD CONSTRAINT "attack_paths_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "path_nodes" ADD CONSTRAINT "path_nodes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "path_nodes" ADD CONSTRAINT "path_nodes_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "attack_paths"("path_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "path_edges" ADD CONSTRAINT "path_edges_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "path_edges" ADD CONSTRAINT "path_edges_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "attack_paths"("path_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "path_breakers" ADD CONSTRAINT "path_breakers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "path_breakers" ADD CONSTRAINT "path_breakers_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "attack_paths"("path_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remediation_tasks" ADD CONSTRAINT "remediation_tasks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remediation_tasks" ADD CONSTRAINT "remediation_tasks_related_path_id_fkey" FOREIGN KEY ("related_path_id") REFERENCES "attack_paths"("path_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remediation_tasks" ADD CONSTRAINT "remediation_tasks_related_exposure_id_fkey" FOREIGN KEY ("related_exposure_id") REFERENCES "exposures"("exposure_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_events" ADD CONSTRAINT "verification_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_events" ADD CONSTRAINT "verification_events_remediation_id_fkey" FOREIGN KEY ("remediation_id") REFERENCES "remediation_tasks"("remediation_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_events" ADD CONSTRAINT "verification_events_validation_run_id_fkey" FOREIGN KEY ("validation_run_id") REFERENCES "validation_runs"("run_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_packs" ADD CONSTRAINT "evidence_packs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "validation_missions"("mission_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_validation_run_id_fkey" FOREIGN KEY ("validation_run_id") REFERENCES "validation_runs"("run_id") ON DELETE SET NULL ON UPDATE CASCADE;
