-- CreateTable
CREATE TABLE "graph_nodes" (
    "graph_node_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "node_type" TEXT NOT NULL,
    "node_key" TEXT NOT NULL,
    "related_entity_type" "RelatedEntityType",
    "related_entity_id" UUID,
    "label" TEXT NOT NULL,
    "properties" JSONB NOT NULL,
    "evidence_ids" UUID[] NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "graph_nodes_pkey" PRIMARY KEY ("graph_node_id")
);

-- CreateTable
CREATE TABLE "graph_edges" (
    "graph_edge_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "source_node_id" UUID NOT NULL,
    "target_node_id" UUID NOT NULL,
    "relationship" "EdgeRelationship" NOT NULL,
    "rationale" TEXT,
    "properties" JSONB NOT NULL,
    "evidence_ids" UUID[] NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "graph_edges_pkey" PRIMARY KEY ("graph_edge_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "graph_nodes_tenant_id_node_type_node_key_key" ON "graph_nodes"("tenant_id", "node_type", "node_key");

-- CreateIndex
CREATE INDEX "graph_nodes_tenant_id_created_at_idx" ON "graph_nodes"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "graph_nodes_tenant_id_related_entity_type_related_entity_id_idx" ON "graph_nodes"("tenant_id", "related_entity_type", "related_entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "graph_edges_tenant_source_target_rel_key" ON "graph_edges"("tenant_id", "source_node_id", "target_node_id", "relationship");

-- CreateIndex
CREATE INDEX "graph_edges_tenant_id_created_at_idx" ON "graph_edges"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "graph_edges_tenant_id_source_node_id_idx" ON "graph_edges"("tenant_id", "source_node_id");

-- CreateIndex
CREATE INDEX "graph_edges_tenant_id_target_node_id_idx" ON "graph_edges"("tenant_id", "target_node_id");

-- AddForeignKey
ALTER TABLE "graph_nodes" ADD CONSTRAINT "graph_nodes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graph_edges" ADD CONSTRAINT "graph_edges_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graph_edges" ADD CONSTRAINT "graph_edges_source_node_id_fkey" FOREIGN KEY ("source_node_id") REFERENCES "graph_nodes"("graph_node_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graph_edges" ADD CONSTRAINT "graph_edges_target_node_id_fkey" FOREIGN KEY ("target_node_id") REFERENCES "graph_nodes"("graph_node_id") ON DELETE CASCADE ON UPDATE CASCADE;
