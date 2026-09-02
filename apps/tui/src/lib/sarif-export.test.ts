import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SARIF_EXPORT_FILENAME,
  SARIF_EXPORT_HONESTY,
  exportFindingsSarif
} from "./sarif-export.js";

const API_URL = "http://127.0.0.1:3001";
const SESSION_COOKIES = "periscan_session=tui-session";
const SARIF_BODY = JSON.stringify({ version: "2.1.0", runs: [] });

const originalCwd = process.cwd();

afterEach(() => {
  process.chdir(originalCwd);
  vi.restoreAllMocks();
});

function tempCwd(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "periscan-tui-sarif-"));
  process.chdir(dir);
  return dir;
}

function header(init: RequestInit | undefined, name: string): string | null {
  return new Headers(init?.headers).get(name);
}

describe("exportFindingsSarif", () => {
  it("GETs /api/v1/findings.sarif with session cookies and writes periscan-findings.sarif in cwd", async () => {
    const cwd = tempCwd();
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => SARIF_BODY
    } as Response);

    const result = await exportFindingsSarif({
      apiUrl: API_URL,
      fetchImpl,
      sessionCookies: SESSION_COOKIES
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(String(url)).toBe(`${API_URL}/api/v1/findings.sarif`);
    expect(init?.method ?? "GET").toBe("GET");
    expect(init?.credentials).toBe("include");
    expect(header(init, "cookie")).toBe(SESSION_COOKIES);
    expect(header(init, "accept")).toContain("application/sarif+json");

    const written = path.join(process.cwd(), SARIF_EXPORT_FILENAME);
    expect(result.path).toBe(written);
    expect(result.filename).toBe(SARIF_EXPORT_FILENAME);
    expect(existsSync(path.join(cwd, SARIF_EXPORT_FILENAME))).toBe(true);
    expect(readFileSync(written, "utf8")).toBe(SARIF_BODY);
    expect(result.honesty).toMatch(/not a certification or pentest/i);
  });

  it("does not write periscan-findings.sarif when the export is unauthorized", async () => {
    const cwd = tempCwd();
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: "Session expired" })
    } as Response);

    await expect(
      exportFindingsSarif({
        apiUrl: API_URL,
        fetchImpl,
        sessionCookies: SESSION_COOKIES
      })
    ).rejects.toThrow(/unable to export findings sarif/i);

    expect(existsSync(path.join(cwd, SARIF_EXPORT_FILENAME))).toBe(false);
  });

  it("forwards optional missionId and does not invent certification claims", async () => {
    tempCwd();
    const missionId = "55555555-5555-4555-8555-555555555555";
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => SARIF_BODY
    } as Response);

    const result = await exportFindingsSarif({
      apiUrl: `${API_URL}/`,
      fetchImpl,
      missionId,
      sessionCookies: SESSION_COOKIES
    });

    const [url] = fetchImpl.mock.calls[0] ?? [];
    expect(String(url)).toBe(
      `${API_URL}/api/v1/findings.sarif?missionId=${missionId}`
    );
    expect(SARIF_EXPORT_HONESTY).toBe("Not a certification or pentest.");
    expect(result.honesty).toBe(SARIF_EXPORT_HONESTY);
  });
});
