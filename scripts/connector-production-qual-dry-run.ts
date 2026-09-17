/**
 * Connector Production qualification dry-run (PERISCAN-467).
 *
 * Fail-closed probe for design-partner live keys + optional receipt JSON.
 * Never elevates the catalog. Never invents credentials.
 *
 * Usage:
 *   pnpm exec tsx scripts/connector-production-qual-dry-run.ts crowdstrike
 *   pnpm exec tsx scripts/connector-production-qual-dry-run.ts crowdstrike --receipt path/to/receipt.json
 *
 * Exit codes:
 *   0 — EligibleForElevation (keys + complete receipt; catalog still unchanged)
 *   2 — NotConfigured (missing live keys) or Blocked / InvalidReceipt
 *   1 — usage / unexpected error
 *
 * See docs/ops/CONNECTOR_PRODUCTION_QUALIFICATION.md.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  CONNECTOR_LIVE_SMOKE_ENV_KEYS,
  runConnectorProductionQualDryRun,
  summarizeCatalogProductionHonesty
} from "../packages/shared/src/connector-production-qualification.ts";

function usage(): never {
  console.error(`Usage:
  tsx scripts/connector-production-qual-dry-run.ts <connectorKey> [--receipt <path.json>]

Known priority connectors with env maps:
  ${Object.keys(CONNECTOR_LIVE_SMOKE_ENV_KEYS).sort().join(", ")}

Fails closed with decision NotConfigured when required env keys are missing.
Does not set productionCertified or contact vendor APIs.
`);
  process.exit(1);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    usage();
  }

  const connectorKey = args[0];
  if (!connectorKey || connectorKey.startsWith("-")) {
    usage();
  }

  let receipt: unknown;
  const receiptFlag = args.indexOf("--receipt");
  if (receiptFlag >= 0) {
    const pathArg = args[receiptFlag + 1];
    if (!pathArg) {
      console.error("--receipt requires a file path");
      process.exit(1);
    }
    const raw = readFileSync(resolve(pathArg), "utf8");
    receipt = JSON.parse(raw);
  }

  const result = runConnectorProductionQualDryRun({
    connectorKey,
    env: process.env,
    receipt
  });

  // Catalog honesty reminder (current shipped state is 0 Production until receipts land).
  const honesty = summarizeCatalogProductionHonesty({
    productionCertifiedCount: 0,
    betaCount: 0,
    plannedCount: 0
  });

  const payload = {
    ...result,
    catalogHonestyNote: honesty.customerFacingSummary,
    // Never echo env secret values — only key names.
    requiredEnvKeys: result.credentialStatus.requiredKeys,
    missingEnvKeys: result.credentialStatus.missingKeys
  };

  console.log(JSON.stringify(payload, null, 2));

  if (result.allowed && result.decision === "EligibleForElevation") {
    console.error(
      "\nEligible for elevation only after code + Plane evidence update. This dry-run did not modify the catalog."
    );
    process.exit(0);
  }

  console.error(`\nDry-run decision: ${result.decision} (not elevated).`);
  process.exit(2);
}

main();
