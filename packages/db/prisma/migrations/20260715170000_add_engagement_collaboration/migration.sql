ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'engagement_workspace_created';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'engagement_collaborator_updated';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'engagement_collaboration_event_added';

CREATE TABLE "engagement_workspaces" (
  "engagement_workspace_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "engagement_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "objective" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Open',
  "lead_user_id" UUID,
  "last_event_sequence" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "engagement_workspaces_pkey" PRIMARY KEY ("engagement_workspace_id")
);

CREATE TABLE "engagement_collaborators" (
  "collaborator_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "engagement_workspace_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role" TEXT NOT NULL,
  "added_by_user_id" UUID NOT NULL,
  "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "engagement_collaborators_pkey" PRIMARY KEY ("collaborator_id")
);

CREATE TABLE "engagement_collaboration_events" (
  "engagement_collaboration_event_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "engagement_workspace_id" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "event_type" TEXT NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "body" TEXT,
  "assigned_to_user_id" UUID,
  "status" TEXT,
  "evidence_ids" UUID[] DEFAULT ARRAY[]::UUID[],
  "previous_event_hash" TEXT,
  "event_hash" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "engagement_collaboration_events_pkey" PRIMARY KEY ("engagement_collaboration_event_id")
);

CREATE UNIQUE INDEX "engagement_workspaces_engagement_id_key" ON "engagement_workspaces"("engagement_id");
CREATE INDEX "engagement_workspaces_tenant_id_updated_at_idx" ON "engagement_workspaces"("tenant_id", "updated_at");
CREATE INDEX "engagement_workspaces_tenant_id_status_idx" ON "engagement_workspaces"("tenant_id", "status");
CREATE UNIQUE INDEX "engagement_collaborators_engagement_workspace_id_user_id_key" ON "engagement_collaborators"("engagement_workspace_id", "user_id");
CREATE INDEX "engagement_collaborators_tenant_id_added_at_idx" ON "engagement_collaborators"("tenant_id", "added_at");
CREATE INDEX "engagement_collaborators_user_id_added_at_idx" ON "engagement_collaborators"("user_id", "added_at");
CREATE UNIQUE INDEX "engagement_collaboration_events_engagement_workspace_id_sequence_key" ON "engagement_collaboration_events"("engagement_workspace_id", "sequence");
CREATE INDEX "engagement_collaboration_events_tenant_id_created_at_idx" ON "engagement_collaboration_events"("tenant_id", "created_at");
CREATE INDEX "engagement_collaboration_events_engagement_workspace_id_created_at_idx" ON "engagement_collaboration_events"("engagement_workspace_id", "created_at");
CREATE INDEX "engagement_collaboration_events_assigned_to_user_id_created_at_idx" ON "engagement_collaboration_events"("assigned_to_user_id", "created_at");

ALTER TABLE "engagement_workspaces" ADD CONSTRAINT "engagement_workspaces_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "engagement_workspaces" ADD CONSTRAINT "engagement_workspaces_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "engagements"("engagement_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "engagement_workspaces" ADD CONSTRAINT "engagement_workspaces_lead_user_id_fkey" FOREIGN KEY ("lead_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "engagement_collaborators" ADD CONSTRAINT "engagement_collaborators_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "engagement_collaborators" ADD CONSTRAINT "engagement_collaborators_engagement_workspace_id_fkey" FOREIGN KEY ("engagement_workspace_id") REFERENCES "engagement_workspaces"("engagement_workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "engagement_collaborators" ADD CONSTRAINT "engagement_collaborators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "engagement_collaborators" ADD CONSTRAINT "engagement_collaborators_added_by_user_id_fkey" FOREIGN KEY ("added_by_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "engagement_collaboration_events" ADD CONSTRAINT "engagement_collaboration_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "engagement_collaboration_events" ADD CONSTRAINT "engagement_collaboration_events_engagement_workspace_id_fkey" FOREIGN KEY ("engagement_workspace_id") REFERENCES "engagement_workspaces"("engagement_workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "engagement_collaboration_events" ADD CONSTRAINT "engagement_collaboration_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "engagement_collaboration_events" ADD CONSTRAINT "engagement_collaboration_events_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "engagement_workspaces" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "engagement_workspaces" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_engagement_workspaces ON "engagement_workspaces"
  USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE "engagement_collaborators" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "engagement_collaborators" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_engagement_collaborators ON "engagement_collaborators"
  USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE "engagement_collaboration_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "engagement_collaboration_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_engagement_collaboration_events ON "engagement_collaboration_events"
  USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);
