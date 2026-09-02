ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'model_provider_created';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'model_provider_updated';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'model_provider_deleted';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'model_session_created';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'model_session_terminated';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'model_tool_requested';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'model_tool_allowed';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'model_tool_denied';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'model_tool_executed';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'model_kill_switch_activated';

ALTER TYPE "RelatedEntityType" ADD VALUE IF NOT EXISTS 'ModelProvider';
ALTER TYPE "RelatedEntityType" ADD VALUE IF NOT EXISTS 'ModelPolicyProfile';
ALTER TYPE "RelatedEntityType" ADD VALUE IF NOT EXISTS 'ModelSession';
ALTER TYPE "RelatedEntityType" ADD VALUE IF NOT EXISTS 'ModelToolRequest';

CREATE TYPE "ModelProviderType" AS ENUM ('AnthropicCompatible', 'OpenAICompatible', 'GoogleCompatible', 'MicrosoftCompatible', 'AWSBedrockCompatible', 'LocalOpenAICompatible', 'CustomerPrivateEndpoint', 'SpecializedCyberModel', 'Other');

CREATE TYPE "ModelDeploymentType" AS ENUM ('Cloud', 'CustomerVPC', 'OnPrem', 'LocalRunner', 'AirGappedFuture');

CREATE TYPE "ModelProviderStatus" AS ENUM ('Active', 'Disabled', 'Error');

CREATE TYPE "ModelSessionMode" AS ENUM ('PlanOnly', 'ReadOnlyEvidence', 'SafeValidation', 'GuidedRemediation', 'HighAssurance');

CREATE TYPE "ModelSessionStatus" AS ENUM ('Created', 'Active', 'Paused', 'Terminated', 'Blocked', 'Expired', 'Archived');

CREATE TYPE "ModelToolRequestStatus" AS ENUM ('Requested', 'Allowed', 'Denied', 'RequiresApproval', 'Approved', 'Running', 'Completed', 'Failed', 'Cancelled', 'Expired');

CREATE TYPE "ModelGatewayEventType" AS ENUM ('SessionCreated', 'SessionStarted', 'ContextBundleCreated', 'ToolRequested', 'ToolAllowed', 'ToolDenied', 'ApprovalRequested', 'ToolExecuted', 'ToolFailed', 'ToolResultReturned', 'RedactionApplied', 'SensitiveDataBlocked', 'SessionPaused', 'SessionTerminated', 'KillSwitchActivated');

CREATE TABLE "model_providers" (
  "model_provider_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "provider_type" "ModelProviderType" NOT NULL,
  "provider_name" TEXT NOT NULL,
  "endpoint_url" TEXT NOT NULL,
  "auth_method" TEXT NOT NULL,
  "credential_ref" TEXT,
  "deployment_type" "ModelDeploymentType" NOT NULL,
  "status" "ModelProviderStatus" NOT NULL DEFAULT 'Active',
  "allowed_use_cases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "data_residency" TEXT,
  "last_tested_at" TIMESTAMP(3),
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "model_providers_pkey" PRIMARY KEY ("model_provider_id"),
  CONSTRAINT "model_providers_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "model_providers_tenant_id_created_at_idx"
  ON "model_providers"("tenant_id", "created_at");

CREATE TABLE "model_policy_profiles" (
  "model_policy_profile_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "allowed_modes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "allowed_tools" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "blocked_tools" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "max_safety_level" "SafetyLevel" NOT NULL DEFAULT 'ActiveNonInvasive',
  "approval_required_above_level" "SafetyLevel" NOT NULL DEFAULT 'ActiveNonInvasive',
  "allow_raw_evidence" BOOLEAN NOT NULL DEFAULT false,
  "allow_sensitive_context" BOOLEAN NOT NULL DEFAULT false,
  "allow_ticket_creation" BOOLEAN NOT NULL DEFAULT false,
  "allow_runner_tasks" BOOLEAN NOT NULL DEFAULT false,
  "allow_external_validation" BOOLEAN NOT NULL DEFAULT false,
  "allow_internal_validation" BOOLEAN NOT NULL DEFAULT false,
  "allowed_data_classes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "redaction_policy" TEXT NOT NULL DEFAULT 'default',
  "session_timeout_minutes" INTEGER NOT NULL DEFAULT 60,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "model_policy_profiles_pkey" PRIMARY KEY ("model_policy_profile_id"),
  CONSTRAINT "model_policy_profiles_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "model_policy_profiles_tenant_id_created_at_idx"
  ON "model_policy_profiles"("tenant_id", "created_at");

CREATE TABLE "model_sessions" (
  "model_session_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "model_provider_id" UUID NOT NULL,
  "model_policy_profile_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "purpose" TEXT NOT NULL,
  "scope_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  "mode" "ModelSessionMode" NOT NULL,
  "status" "ModelSessionStatus" NOT NULL DEFAULT 'Created',
  "started_at" TIMESTAMP(3),
  "ended_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "model_sessions_pkey" PRIMARY KEY ("model_session_id"),
  CONSTRAINT "model_sessions_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "model_sessions_model_provider_id_fkey"
    FOREIGN KEY ("model_provider_id") REFERENCES "model_providers"("model_provider_id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "model_sessions_model_policy_profile_id_fkey"
    FOREIGN KEY ("model_policy_profile_id") REFERENCES "model_policy_profiles"("model_policy_profile_id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "model_sessions_tenant_id_created_at_idx"
  ON "model_sessions"("tenant_id", "created_at");

CREATE INDEX "model_sessions_tenant_id_status_idx"
  ON "model_sessions"("tenant_id", "status");

CREATE INDEX "model_sessions_model_provider_id_idx"
  ON "model_sessions"("model_provider_id");

CREATE TABLE "model_tools" (
  "model_tool_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "tool_name" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "approval_required" BOOLEAN NOT NULL DEFAULT false,
  "allowed_session_modes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "model_tools_pkey" PRIMARY KEY ("model_tool_id"),
  CONSTRAINT "model_tools_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "model_tools_tenant_id_tool_name_key"
  ON "model_tools"("tenant_id", "tool_name");

CREATE INDEX "model_tools_tenant_id_idx"
  ON "model_tools"("tenant_id");

CREATE TABLE "context_bundles" (
  "context_bundle_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "model_session_id" UUID NOT NULL,
  "scope_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  "redaction_policy" TEXT NOT NULL DEFAULT 'default',
  "sensitivity_level" "SensitivityLevel" NOT NULL,
  "token_estimate" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3),

  CONSTRAINT "context_bundles_pkey" PRIMARY KEY ("context_bundle_id"),
  CONSTRAINT "context_bundles_model_session_id_fkey"
    FOREIGN KEY ("model_session_id") REFERENCES "model_sessions"("model_session_id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "context_bundles_tenant_id_created_at_idx"
  ON "context_bundles"("tenant_id", "created_at");

CREATE INDEX "context_bundles_model_session_id_created_at_idx"
  ON "context_bundles"("model_session_id", "created_at");

CREATE TABLE "context_bundle_items" (
  "context_bundle_item_id" UUID NOT NULL,
  "context_bundle_id" UUID NOT NULL,
  "entity_type" "RelatedEntityType" NOT NULL,
  "entity_id" UUID NOT NULL,
  "evidence_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  "redaction_status" "RedactionStatus" NOT NULL,
  "included_reason" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "context_bundle_items_pkey" PRIMARY KEY ("context_bundle_item_id"),
  CONSTRAINT "context_bundle_items_context_bundle_id_fkey"
    FOREIGN KEY ("context_bundle_id") REFERENCES "context_bundles"("context_bundle_id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "context_bundle_items_context_bundle_id_idx"
  ON "context_bundle_items"("context_bundle_id");

CREATE TABLE "model_tool_requests" (
  "tool_request_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "model_session_id" UUID NOT NULL,
  "tool_name" TEXT NOT NULL,
  "requested_by_model" BOOLEAN NOT NULL DEFAULT true,
  "request_reason" TEXT NOT NULL,
  "input_payload_hash" TEXT NOT NULL,
  "input_payload_redacted" JSONB NOT NULL,
  "scope_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  "policy_decision_id" UUID,
  "status" "ModelToolRequestStatus" NOT NULL DEFAULT 'Requested',
  "denial_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approved_at" TIMESTAMP(3),
  "approved_by" UUID,
  "completed_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "model_tool_requests_pkey" PRIMARY KEY ("tool_request_id"),
  CONSTRAINT "model_tool_requests_model_session_id_fkey"
    FOREIGN KEY ("model_session_id") REFERENCES "model_sessions"("model_session_id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "model_tool_requests_tenant_id_created_at_idx"
  ON "model_tool_requests"("tenant_id", "created_at");

CREATE INDEX "model_tool_requests_tenant_id_status_idx"
  ON "model_tool_requests"("tenant_id", "status");

CREATE INDEX "model_tool_requests_model_session_id_created_at_idx"
  ON "model_tool_requests"("model_session_id", "created_at");

CREATE TABLE "model_tool_results" (
  "tool_result_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "tool_request_id" UUID NOT NULL,
  "validation_run_id" UUID,
  "evidence_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  "output_payload_redacted" JSONB NOT NULL,
  "sensitivity_level" "SensitivityLevel" NOT NULL,
  "returned_to_model" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "model_tool_results_pkey" PRIMARY KEY ("tool_result_id"),
  CONSTRAINT "model_tool_results_tool_request_id_fkey"
    FOREIGN KEY ("tool_request_id") REFERENCES "model_tool_requests"("tool_request_id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "model_tool_results_tool_request_id_key"
  ON "model_tool_results"("tool_request_id");

CREATE INDEX "model_tool_results_tenant_id_created_at_idx"
  ON "model_tool_results"("tenant_id", "created_at");

CREATE TABLE "model_gateway_audit_events" (
  "event_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "model_session_id" UUID,
  "event_type" "ModelGatewayEventType" NOT NULL,
  "user_id" UUID,
  "model_provider_id" UUID,
  "tool_name" TEXT,
  "tool_request_id" UUID,
  "policy_decision_id" UUID,
  "evidence_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  "metadata" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "model_gateway_audit_events_pkey" PRIMARY KEY ("event_id"),
  CONSTRAINT "model_gateway_audit_events_model_session_id_fkey"
    FOREIGN KEY ("model_session_id") REFERENCES "model_sessions"("model_session_id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "model_gateway_audit_events_tenant_id_created_at_idx"
  ON "model_gateway_audit_events"("tenant_id", "created_at");

CREATE INDEX "model_gateway_audit_events_model_session_id_created_at_idx"
  ON "model_gateway_audit_events"("model_session_id", "created_at");

CREATE INDEX "model_gateway_audit_events_tenant_id_event_type_idx"
  ON "model_gateway_audit_events"("tenant_id", "event_type");
