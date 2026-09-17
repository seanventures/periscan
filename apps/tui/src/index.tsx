#!/usr/bin/env npx tsx
import { render } from "ink";
import React from "react";

import { TuiApp } from "./app.js";
import { isCliArgv, parseCli, printUsage, runCli } from "./cli.js";
import { resolveApiUrl } from "./lib/session.js";

export async function main(
  argv: string[] = process.argv.slice(2)
): Promise<number | null> {
  let parsed;
  try {
    parsed = parseCli(argv, process.env, resolveApiUrl());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    printUsage((chunk) => {
      process.stderr.write(chunk);
    });
    return 1;
  }

  if (parsed.help) {
    printUsage((chunk) => {
      process.stdout.write(chunk);
    });
    return 0;
  }

  if (isCliArgv(argv) || parsed.command !== "tui") {
    return runCli(parsed, { env: process.env });
  }

  render(<TuiApp apiUrl={parsed.apiUrl} />);
  return null;
}

const argv = process.argv.slice(2);
const code = await main(argv);
if (code !== null) {
  process.exit(code);
}
