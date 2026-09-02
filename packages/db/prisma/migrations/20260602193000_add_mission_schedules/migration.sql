CREATE TYPE "ScheduleFrequency" AS ENUM ('Daily', 'Weekly', 'Monthly');

CREATE TYPE "ScheduleStatus" AS ENUM ('Active', 'Paused');

CREATE TABLE "mission_schedules" (
    "schedule_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "mission_type" "MissionType" NOT NULL,
    "created_by" UUID NOT NULL,
    "frequency" "ScheduleFrequency" NOT NULL,
    "status" "ScheduleStatus" NOT NULL,
    "next_run_at" TIMESTAMP(3) NOT NULL,
    "last_run_at" TIMESTAMP(3),
    "last_snapshot_id" UUID,
    "last_mission_id" UUID,
    "scope_ids" UUID[],
    "config" JSONB NOT NULL,
    "last_diff" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mission_schedules_pkey" PRIMARY KEY ("schedule_id")
);

CREATE INDEX "mission_schedules_tenant_id_created_at_idx" ON "mission_schedules"("tenant_id", "created_at");
CREATE INDEX "mission_schedules_tenant_id_status_next_run_at_idx" ON "mission_schedules"("tenant_id", "status", "next_run_at");
CREATE INDEX "mission_schedules_tenant_id_mission_type_idx" ON "mission_schedules"("tenant_id", "mission_type");

ALTER TABLE "mission_schedules" ADD CONSTRAINT "mission_schedules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
