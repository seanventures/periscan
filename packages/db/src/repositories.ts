import type {
  Membership,
  MembershipRole,
  PrismaClient,
  Tenant,
  TenantType,
  User,
  UserStatus
} from "@prisma/client";

type CoreRepositoryClient = Pick<
  PrismaClient,
  "membership" | "tenant" | "user"
>;

export interface CreateTenantInput {
  tenantId?: string;
  name: string;
  type: TenantType;
  parentTenantId?: string | null;
  billingAccountId?: string | null;
  dataRegion: string;
}

export interface CreateUserInput {
  userId?: string;
  email: string;
  name: string;
  status?: UserStatus;
}

export interface CreateMembershipInput {
  membershipId?: string;
  tenantId: string;
  userId: string;
  role: MembershipRole;
}

export function createCoreRepositories(prisma: CoreRepositoryClient) {
  return {
    async createTenant(input: CreateTenantInput): Promise<Tenant> {
      return prisma.tenant.create({
        data: {
          billingAccountId: input.billingAccountId ?? null,
          dataRegion: input.dataRegion,
          name: input.name,
          parentTenantId: input.parentTenantId ?? null,
          tenantId: input.tenantId,
          type: input.type
        }
      });
    },

    async findTenantById(tenantId: string): Promise<Tenant | null> {
      return prisma.tenant.findUnique({
        where: {
          tenantId
        }
      });
    },

    async createUser(input: CreateUserInput): Promise<User> {
      return prisma.user.create({
        data: {
          email: input.email,
          name: input.name,
          status: input.status ?? "Active",
          userId: input.userId
        }
      });
    },

    async findUserByEmail(email: string): Promise<User | null> {
      return prisma.user.findUnique({
        where: {
          email
        }
      });
    },

    async createMembership(input: CreateMembershipInput): Promise<Membership> {
      return prisma.membership.create({
        data: {
          membershipId: input.membershipId,
          role: input.role,
          tenantId: input.tenantId,
          userId: input.userId
        }
      });
    },

    async listMembershipsByTenant(tenantId: string): Promise<Membership[]> {
      return prisma.membership.findMany({
        orderBy: {
          createdAt: "asc"
        },
        where: {
          tenantId
        }
      });
    }
  };
}
