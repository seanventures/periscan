import argon2 from "argon2";
import { MembershipRole, TenantType, UserStatus } from "@prisma/client";
import { pathToFileURL } from "node:url";

import { createPrismaClient } from "./client.js";
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  DEMO_TENANT_ID,
  DEMO_TENANT_NAME,
  DEMO_USER_ID
} from "./demo.js";

export async function ensureDemoIdentity() {
  const prisma = createPrismaClient();

  try {
    const passwordHash = await argon2.hash(DEMO_PASSWORD);

    const tenant = await prisma.tenant.upsert({
      where: {
        tenantId: DEMO_TENANT_ID
      },
      update: {
        billingAccountId: "demo-billing-account",
        dataRegion: "us-east-1",
        name: DEMO_TENANT_NAME,
        type: TenantType.Organization
      },
      create: {
        billingAccountId: "demo-billing-account",
        dataRegion: "us-east-1",
        name: DEMO_TENANT_NAME,
        tenantId: DEMO_TENANT_ID,
        type: TenantType.Organization
      }
    });

    const user = await prisma.user.upsert({
      where: {
        email: DEMO_EMAIL
      },
      update: {
        name: "Periscan Demo User",
        passwordHash,
        status: UserStatus.Active
      },
      create: {
        email: DEMO_EMAIL,
        name: "Periscan Demo User",
        passwordHash,
        status: UserStatus.Active,
        userId: DEMO_USER_ID
      }
    });

    const membership = await prisma.membership.upsert({
      where: {
        tenantId_userId: {
          tenantId: tenant.tenantId,
          userId: user.userId
        }
      },
      update: {
        role: MembershipRole.Owner
      },
      create: {
        role: MembershipRole.Owner,
        tenantId: tenant.tenantId,
        userId: user.userId
      }
    });

    return {
      membership,
      tenant,
      user
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const { tenant, user } = await ensureDemoIdentity();

  console.log(
    JSON.stringify(
      {
        demoTenantId: tenant.tenantId,
        demoUserEmail: user.email,
        demoUserPassword: DEMO_PASSWORD
      },
      null,
      2
    )
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
