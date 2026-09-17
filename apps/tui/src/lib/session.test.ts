import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  DEFAULT_API_URL,
  loadSession,
  resolveApiUrl,
  saveSession
} from "./session.js";

const homes: string[] = [];

async function tempHome(): Promise<string> {
  const homeDir = await mkdtemp(path.join(tmpdir(), "periscan-tui-session-"));
  homes.push(homeDir);
  return homeDir;
}

function sessionFile(homeDir: string): string {
  return path.join(homeDir, ".periscan", "tui-session.json");
}

afterEach(async () => {
  await Promise.all(
    homes.splice(0).map((dir) => rm(dir, { force: true, recursive: true }))
  );
});

describe("TUI session file", () => {
  it("returns null when ~/.periscan/tui-session.json is missing", async () => {
    const homeDir = await tempHome();

    expect(loadSession({ homeDir })).toBeNull();
  });

  it("loads apiUrl from ~/.periscan/tui-session.json", async () => {
    const homeDir = await tempHome();
    await mkdir(path.join(homeDir, ".periscan"), { recursive: true });
    await writeFile(
      sessionFile(homeDir),
      `${JSON.stringify({ apiUrl: "https://api.periscan.test/" })}\n`,
      "utf8"
    );

    expect(loadSession({ homeDir })).toEqual({
      apiUrl: "https://api.periscan.test"
    });
  });

  it("ignores passwords, JWTs, and other secrets when loading", async () => {
    const homeDir = await tempHome();
    await mkdir(path.join(homeDir, ".periscan"), { recursive: true });
    await writeFile(
      sessionFile(homeDir),
      JSON.stringify({
        apiUrl: "https://api.periscan.test",
        authorization: "Bearer test.jwt.token",
        cookie: "sid=test-cookie",
        jwt: "test.jwt.token",
        password: "test-password",
        token: "test-token"
      }),
      "utf8"
    );

    const session = loadSession({ homeDir });

    expect(session).toEqual({ apiUrl: "https://api.periscan.test" });
    expect(session && Object.keys(session)).toEqual(["apiUrl"]);
  });

  it("returns null for invalid JSON, missing apiUrl, or non-HTTP(S) apiUrl", async () => {
    const homeDir = await tempHome();
    const dir = path.join(homeDir, ".periscan");
    await mkdir(dir, { recursive: true });

    await writeFile(sessionFile(homeDir), "{not-json", "utf8");
    expect(loadSession({ homeDir })).toBeNull();

    await writeFile(sessionFile(homeDir), JSON.stringify({}), "utf8");
    expect(loadSession({ homeDir })).toBeNull();

    await writeFile(
      sessionFile(homeDir),
      JSON.stringify({ apiUrl: "ftp://api.periscan.test" }),
      "utf8"
    );
    expect(loadSession({ homeDir })).toBeNull();
  });

  it("saves only apiUrl and never writes secrets", async () => {
    const homeDir = await tempHome();
    const dirty = {
      apiUrl: "https://api.periscan.test/",
      jwt: "test.jwt.token",
      password: "test-password",
      token: "test-token"
    };

    saveSession(dirty, { homeDir });

    const raw = await readFile(sessionFile(homeDir), "utf8");
    const parsed: unknown = JSON.parse(raw);

    expect(parsed).toEqual({ apiUrl: "https://api.periscan.test" });
    expect(Object.keys(parsed as object).sort()).toEqual(["apiUrl"]);
    expect(raw).not.toMatch(/password|jwt|token/iu);
  });

  it("prefers PERISCAN_API_URL, then the session file, then the local default", async () => {
    const homeDir = await tempHome();
    saveSession({ apiUrl: "https://session.periscan.test" }, { homeDir });

    expect(
      resolveApiUrl({
        env: { PERISCAN_API_URL: "https://env.periscan.test/" },
        homeDir
      })
    ).toBe("https://env.periscan.test");

    expect(resolveApiUrl({ env: {}, homeDir })).toBe(
      "https://session.periscan.test"
    );

    expect(resolveApiUrl({ env: {}, homeDir: await tempHome() })).toBe(
      DEFAULT_API_URL
    );
    expect(DEFAULT_API_URL).toBe("http://127.0.0.1:3001");
  });
});
