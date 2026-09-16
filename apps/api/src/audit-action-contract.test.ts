import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { AuditEventActionSchema } from "@periscan/shared";

import { AUDIT_ACTION_TO_DB } from "./runtime-services.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

function listPrismaAuditEventActions() {
  const schema = readFileSync(
    path.join(repoRoot, "packages/db/prisma/schema.prisma"),
    "utf8"
  );
  const match = schema.match(/enum AuditEventAction \{([\s\S]*?)\n\}/u);
  if (!match) {
    throw new Error("Prisma AuditEventAction enum not found.");
  }

  return match[1]!
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("//"))
    .sort();
}

describe("audit action contract", () => {
  it("keeps shared actions, API mapping, and Prisma enum in sync", () => {
    const sharedActions = [...AuditEventActionSchema.options].sort();
    const mappedActions = Object.keys(AUDIT_ACTION_TO_DB).sort();
    const mappedDbValues = Object.values(AUDIT_ACTION_TO_DB).sort();
    const prismaActions = listPrismaAuditEventActions();

    expect(mappedActions).toEqual(sharedActions);
    expect(mappedDbValues).toEqual(prismaActions);
  });
});
