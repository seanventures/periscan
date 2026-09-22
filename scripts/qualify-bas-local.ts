import { readFile, open, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { listAtomicLabAdapterBindings } from "../packages/modules/src/atomic-bas-catalog.js";
import {
  ATOMIC_HOSTNAME_LAB,
  atomicHostnameLabPlanSha256,
  qualifyAtomicHostnameLab
} from "../packages/modules/src/bas-local-lab.js";

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help")) {
    console.log(
      "Usage: pnpm bas:qualify:local -- --run --approve-plan <sha256> --output <receipt.json>\nPreview the exact plan: pnpm bas:qualify:local\nPrepare the pinned image separately with docker pull <plan.image>."
    );
    console.log(
      JSON.stringify(
        {
          plan: ATOMIC_HOSTNAME_LAB,
          planSha256: atomicHostnameLabPlanSha256(),
          adapterBindings: listAtomicLabAdapterBindings(),
          customerLiveSupported: false
        },
        null,
        2
      )
    );
    return;
  }
  const options: Record<string, string> = {};
  const seen = new Set<string>();
  for (let index = 0; index < args.length; index++) {
    const flag = args[index]!;
    if (flag === "--") continue;
    if (seen.has(flag)) throw new Error(`Duplicate option: ${flag}`);
    seen.add(flag);
    if (flag === "--run") continue;
    if (
      !["--approve-plan", "--output"].includes(flag) ||
      !args[index + 1] ||
      args[index + 1]!.startsWith("--")
    ) {
      throw new Error(
        "Only --run, --approve-plan <sha256> and --output <path> are accepted."
      );
    }
    options[flag] = args[++index]!;
  }
  if (!seen.has("--run") || !options["--approve-plan"] || !options["--output"])
    throw new Error("Execution requires --run, --approve-plan and --output.");
  // Vendored upstream source is fixture/content data. The harness verifies the
  // pinned whole-file digest and selected definition before invoking Docker.
  const sourceContent = await readFile(
    new URL(
      "../packages/modules/src/fixtures/atomic/T1082.yaml",
      import.meta.url
    ),
    "utf8"
  );
  const controller = new AbortController();
  const cancel = () => controller.abort();
  const output = resolve(options["--output"]);
  await mkdir(dirname(output), { recursive: true });
  const report = await open(output, "wx", 0o600);
  process.once("SIGINT", cancel);
  process.once("SIGTERM", cancel);
  try {
    const receipt = await qualifyAtomicHostnameLab({
      sourceContent,
      approvedPlanSha256: options["--approve-plan"],
      signal: controller.signal
    });
    await report.writeFile(
      JSON.stringify({ plan: ATOMIC_HOSTNAME_LAB, receipt }, null, 2) + "\n"
    );
    await report.sync();
    console.log(
      JSON.stringify(
        {
          qualification: receipt.qualification,
          execution: receipt.execution.status,
          cleanup: receipt.cleanup,
          detection: receipt.detection,
          output
        },
        null,
        2
      )
    );
    if (receipt.qualification !== "Passed") process.exitCode = 1;
  } finally {
    await report.close();
    process.off("SIGINT", cancel);
    process.off("SIGTERM", cancel);
  }
}
main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Local BAS qualification failed."
  );
  process.exitCode = 1;
});
