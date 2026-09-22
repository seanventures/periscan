import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@prisma/client";

type EnterpriseSiteClient = Pick<PrismaClient, "enterpriseSite">;

export type EnterpriseSiteRecord = {
  adDomains: string[];
  cidrs: string[];
  createdAt: Date;
  name: string;
  runnerIds: string[];
  siteId: string;
  tenantId: string;
  updatedAt: Date;
};

export type CreateEnterpriseSiteRecordInput = {
  adDomains?: string[];
  cidrs?: string[];
  name: string;
  runnerIds?: string[];
  siteId?: string;
  tenantId: string;
};

export type UpdateEnterpriseSiteRecordInput = {
  adDomains?: string[];
  cidrs?: string[];
  name?: string;
  runnerIds?: string[];
  siteId: string;
  tenantId: string;
};

export type GetEnterpriseSiteRecordInput = {
  siteId: string;
  tenantId: string;
};

export async function listEnterpriseSiteRecords(
  prisma: EnterpriseSiteClient,
  tenantId: string
): Promise<EnterpriseSiteRecord[]> {
  return prisma.enterpriseSite.findMany({
    orderBy: { createdAt: "asc" },
    where: { tenantId }
  });
}

export async function getEnterpriseSiteRecord(
  prisma: EnterpriseSiteClient,
  input: GetEnterpriseSiteRecordInput
): Promise<EnterpriseSiteRecord | null> {
  return prisma.enterpriseSite.findFirst({
    where: {
      siteId: input.siteId,
      tenantId: input.tenantId
    }
  });
}

export async function createEnterpriseSiteRecord(
  prisma: EnterpriseSiteClient,
  input: CreateEnterpriseSiteRecordInput
): Promise<EnterpriseSiteRecord> {
  return prisma.enterpriseSite.create({
    data: {
      adDomains: input.adDomains ?? [],
      cidrs: input.cidrs ?? [],
      name: input.name,
      runnerIds: input.runnerIds ?? [],
      siteId: input.siteId ?? randomUUID(),
      tenantId: input.tenantId
    }
  });
}

export async function updateEnterpriseSiteRecord(
  prisma: EnterpriseSiteClient,
  input: UpdateEnterpriseSiteRecordInput
): Promise<EnterpriseSiteRecord | null> {
  const current = await getEnterpriseSiteRecord(prisma, {
    siteId: input.siteId,
    tenantId: input.tenantId
  });
  if (!current) {
    return null;
  }

  return prisma.enterpriseSite.update({
    data: {
      ...(input.adDomains !== undefined ? { adDomains: input.adDomains } : {}),
      ...(input.cidrs !== undefined ? { cidrs: input.cidrs } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.runnerIds !== undefined ? { runnerIds: input.runnerIds } : {})
    },
    where: { siteId: input.siteId }
  });
}
