import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

/** Optional ~/.periscan/tui-session.json. Stores apiUrl only — never passwords or JWTs. */

export const DEFAULT_API_URL = "http://127.0.0.1:3001";

export type TuiSession = {
  apiUrl: string;
};

export type TuiSessionOptions = {
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
};

function sessionFilePath(homeDir = homedir()): string {
  return path.join(homeDir, ".periscan", "tui-session.json");
}

function normalizeApiUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString().replace(/\/$/u, "");
  } catch {
    return null;
  }
}

export function loadSession(
  options: TuiSessionOptions = {}
): TuiSession | null {
  const filePath = sessionFilePath(options.homeDir);
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const raw: unknown = JSON.parse(readFileSync(filePath, "utf8"));
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      return null;
    }

    const apiUrl = normalizeApiUrl((raw as { apiUrl?: unknown }).apiUrl);
    if (!apiUrl) {
      return null;
    }

    return { apiUrl };
  } catch {
    return null;
  }
}

export function saveSession(
  session: TuiSession,
  options: TuiSessionOptions = {}
): void {
  const apiUrl = normalizeApiUrl(session.apiUrl);
  if (!apiUrl) {
    throw new Error("TUI session apiUrl must be an HTTP(S) URL.");
  }

  const homeDir = options.homeDir ?? homedir();
  mkdirSync(path.join(homeDir, ".periscan"), { recursive: true });
  writeFileSync(sessionFilePath(homeDir), `${JSON.stringify({ apiUrl })}\n`, {
    encoding: "utf8",
    mode: 0o600
  });
}

export function resolveApiUrl(options: TuiSessionOptions = {}): string {
  const fromEnv = normalizeApiUrl(
    (options.env ?? process.env).PERISCAN_API_URL
  );
  if (fromEnv) {
    return fromEnv;
  }

  return loadSession(options)?.apiUrl ?? DEFAULT_API_URL;
}
