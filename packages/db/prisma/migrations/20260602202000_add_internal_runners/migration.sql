ALTER TYPE "RelatedEntityType" ADD VALUE IF NOT EXISTS 'Runner';
ALTER TYPE "RelatedEntityType" ADD VALUE IF NOT EXISTS 'RunnerTask';

ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'runner_task_rejected';

CREATE TYPE "RunnerDeploymentMode" AS ENUM ('Docker', 'SystemdService', 'Kubernetes', 'WindowsService');
CREATE TYPE "RunnerStatus" AS ENUM ('Provisioning', 'Active', 'Degraded', 'Offline', 'Revoked');
CREATE TYPE "RunnerControlChannel" AS ENUM ('LongPollHttps', 'WebSocketHttps');
CREATE TYPE "RunnerRegistrationTokenStatus" AS ENUM ('Active', 'Used', 'Expired', 'Revoked');
CREATE TYPE "RunnerTaskStatus" AS ENUM ('Queued', 'Leased', 'Running', 'Completed', 'Failed', 'Rejected', 'Expired', 'Cancelled');

CREATE TABLE "runner_registration_tokens" (
    "registration_token_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "runner_name" TEXT NOT NULL,
    "deployment_mode" "RunnerDeploymentMode" NOT NULL,
    "labels" TEXT[] NOT NULL,
    "token_hash" TEXT NOT NULL,
    "status" "RunnerRegistrationTokenStatus" NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "runner_registration_tokens_pkey" PRIMARY KEY ("registration_token_id")
);

CREATE TABLE "runners" (
    "runner_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "created_by" UUID,
    "name" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "os" TEXT NOT NULL,
    "arch" TEXT NOT NULL,
    "deployment_mode" "RunnerDeploymentMode" NOT NULL,
    "status" "RunnerStatus" NOT NULL,
    "transport_mode" "RunnerControlChannel" NOT NULL,
    "labels" TEXT[] NOT NULL,
    "capabilities" JSONB NOT NULL,
    "network_profile" JSONB NOT NULL,
    "auth_token_hash" TEXT NOT NULL,
    "certificate_sha256" TEXT,
    "certificate_expires_at" TIMESTAMP(3),
    "last_seen_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "runners_pkey" PRIMARY KEY ("runner_id")
);

CREATE TABLE "runner_tasks" (
    "task_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "runner_id" UUID NOT NULL,
    "mission_id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "scope_id" UUID NOT NULL,
    "module_id" TEXT NOT NULL,
    "safety_level" "SafetyLevel" NOT NULL,
    "status" "RunnerTaskStatus" NOT NULL,
    "target" JSONB NOT NULL,
    "inputs" JSONB NOT NULL,
    "scope_constraints" JSONB NOT NULL,
    "envelope" JSONB NOT NULL,
    "nonce" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "leased_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "result" JSONB,
    "error_summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "runner_tasks_pkey" PRIMARY KEY ("task_id")
);

CREATE UNIQUE INDEX "runner_registration_tokens_token_hash_key" ON "runner_registration_tokens"("token_hash");
CREATE INDEX "runner_registration_tokens_tenant_id_created_at_idx" ON "runner_registration_tokens"("tenant_id", "created_at");
CREATE INDEX "runner_registration_tokens_tenant_id_status_expires_at_idx" ON "runner_registration_tokens"("tenant_id", "status", "expires_at");

CREATE INDEX "runners_tenant_id_created_at_idx" ON "runners"("tenant_id", "created_at");
CREATE INDEX "runners_tenant_id_status_idx" ON "runners"("tenant_id", "status");
CREATE INDEX "runners_tenant_id_last_seen_at_idx" ON "runners"("tenant_id", "last_seen_at");

CREATE UNIQUE INDEX "runner_tasks_runner_id_nonce_key" ON "runner_tasks"("runner_id", "nonce");
CREATE INDEX "runner_tasks_tenant_id_created_at_idx" ON "runner_tasks"("tenant_id", "created_at");
CREATE INDEX "runner_tasks_tenant_id_status_idx" ON "runner_tasks"("tenant_id", "status");
CREATE INDEX "runner_tasks_runner_id_status_expires_at_idx" ON "runner_tasks"("runner_id", "status", "expires_at");
CREATE INDEX "runner_tasks_mission_id_idx" ON "runner_tasks"("mission_id");
CREATE INDEX "runner_tasks_run_id_idx" ON "runner_tasks"("run_id");
CREATE INDEX "runner_tasks_scope_id_idx" ON "runner_tasks"("scope_id");

ALTER TABLE "runner_registration_tokens" ADD CONSTRAINT "runner_registration_tokens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "runner_registration_tokens" ADD CONSTRAINT "runner_registration_tokens_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "runners" ADD CONSTRAINT "runners_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "runner_tasks" ADD CONSTRAINT "runner_tasks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "runner_tasks" ADD CONSTRAINT "runner_tasks_runner_id_fkey" FOREIGN KEY ("runner_id") REFERENCES "runners"("runner_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "runner_tasks" ADD CONSTRAINT "runner_tasks_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "validation_missions"("mission_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "runner_tasks" ADD CONSTRAINT "runner_tasks_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "validation_runs"("run_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "runner_tasks" ADD CONSTRAINT "runner_tasks_scope_id_fkey" FOREIGN KEY ("scope_id") REFERENCES "scopes"("scope_id") ON DELETE CASCADE ON UPDATE CASCADE;
