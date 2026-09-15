#!/usr/bin/env node
// Migration-drift gate (enum class).
//
// Prisma `validate` checks schema validity and `migrate deploy` applies
// migrations, but NEITHER detects a Prisma enum value that exists in
// schema.prisma yet was never added by any migration. On a database migrated
// from scratch that value is absent, so any query/write touching it fails at
// runtime with Postgres 22P02 (invalid input value for enum) — a bug that only
// surfaces if an acceptance test happens to exercise that exact path.
//
// This gate makes the drift explicit and fast: for every enum that migrations
// actually CREATE, it asserts the schema's values are a subset of what the
// migrations produce. Exit non-zero (fails CI) on any drift.
//
// It deliberately ignores non-enum drift (e.g. cosmetic index renames) to stay
// a precise, low-noise signal on the one class that causes 22P02 outages.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA = join(ROOT, "packages/db/prisma/schema.prisma");
const MIGRATIONS_DIR = join(ROOT, "packages/db/prisma/migrations");

// --- Parse enums declared in the Prisma schema ---
function parseSchemaEnums(text) {
  const enums = new Map();
  const re = /enum\s+(\w+)\s*\{([^}]*)\}/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    const name = match[1];
    const values = match[2]
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("//"))
      .map((line) => line.split(/\s+/)[0])
      .filter(Boolean);
    enums.set(name, new Set(values));
  }
  return enums;
}

// --- Parse enum values produced by the migration SQL ---
function parseMigrationEnums() {
  const produced = new Map();
  let sql = "";
  for (const entry of readdirSync(MIGRATIONS_DIR)) {
    const file = join(MIGRATIONS_DIR, entry, "migration.sql");
    try {
      sql += readFileSync(file, "utf8") + "\n";
    } catch {
      // directories without a migration.sql (e.g. migration_lock.toml) are fine
    }
  }
  // CREATE TYPE "Name" AS ENUM ('a', 'b', ...)
  const createRe = /CREATE TYPE\s+"(\w+)"\s+AS ENUM\s*\(([^)]*)\)/g;
  let m;
  while ((m = createRe.exec(sql)) !== null) {
    const name = m[1];
    const values = [...m[2].matchAll(/'([^']*)'/g)].map((v) => v[1]);
    if (!produced.has(name)) produced.set(name, new Set());
    for (const v of values) produced.get(name).add(v);
  }
  // ALTER TYPE "Name" ADD VALUE [IF NOT EXISTS] 'value'
  const alterRe =
    /ALTER TYPE\s+"(\w+)"\s+ADD VALUE\s+(?:IF NOT EXISTS\s+)?'([^']*)'/g;
  while ((m = alterRe.exec(sql)) !== null) {
    const name = m[1];
    if (!produced.has(name)) produced.set(name, new Set());
    produced.get(name).add(m[2]);
  }
  return produced;
}

const schemaEnums = parseSchemaEnums(readFileSync(SCHEMA, "utf8"));
const migrationEnums = parseMigrationEnums();

const drift = [];
for (const [name, schemaValues] of schemaEnums) {
  const produced = migrationEnums.get(name);
  // Only enforce enums that migrations actually create as a Postgres type.
  // (An enum used solely inside a Json field has no CREATE TYPE and no 22P02 risk.)
  if (!produced) continue;
  const missing = [...schemaValues].filter((v) => !produced.has(v));
  if (missing.length > 0) {
    drift.push({ name, missing });
  }
}

if (drift.length === 0) {
  console.log(
    `✓ enum-drift gate: ${schemaEnums.size} schema enums checked, no migration drift.`
  );
  process.exit(0);
}

console.error("✗ enum-drift gate FAILED — schema enum values with no migration:");
for (const { name, missing } of drift) {
  console.error(`  ${name}: ${missing.join(", ")}`);
}
console.error(
  "\nEach value above exists in schema.prisma but is never added by a migration,\n" +
    "so a from-scratch database will 22P02 on code paths that use it. Add an\n" +
    "`ALTER TYPE \"<Enum>\" ADD VALUE IF NOT EXISTS '<value>';` migration under\n" +
    "packages/db/prisma/migrations/ for each."
);
process.exit(1);
