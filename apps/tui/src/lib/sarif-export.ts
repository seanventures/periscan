import { writeFile } from "node:fs/promises";
import path from "node:path";

/** Evidence-backed Community SARIF 2.1.0. Not a certification or pentest. */
export const FINDINGS_SARIF_PATH = "/api/v1/findings.sarif";
export const SARIF_EXPORT_FILENAME = "periscan-findings.sarif";
export const SARIF_EXPORT_HONESTY = "Not a certification or pentest.";
export const SESSION_COOKIE_NAME = "periscan_session";

export type ExportFindingsSarifInput = {
  apiUrl: string;
  /** Cookie header, e.g. `periscan_session=…`. Session token alone is wrapped. */
  sessionCookies: string;
  missionId?: string;
  fetchImpl?: typeof fetch;
};

export type ExportFindingsSarifResult = {
  filename: string;
  honesty: string;
  path: string;
};

function cookieHeader(sessionCookies: string): string {
  if (sessionCookies.includes("=")) {
    return sessionCookies;
  }
  return `${SESSION_COOKIE_NAME}=${sessionCookies}`;
}

function findingsSarifUrl(apiUrl: string, missionId?: string): string {
  const base = apiUrl.endsWith("/") ? apiUrl : `${apiUrl}/`;
  const url = new URL(FINDINGS_SARIF_PATH.replace(/^\//u, ""), base);
  if (missionId) {
    url.searchParams.set("missionId", missionId);
  }
  return url.toString();
}

/**
 * GET /api/v1/findings.sarif with the operator session cookie and write
 * periscan-findings.sarif in cwd. Empty-evidence rows are omitted by the API.
 */
export async function exportFindingsSarif(
  input: ExportFindingsSarifInput
): Promise<ExportFindingsSarifResult> {
  const fetcher = input.fetchImpl ?? fetch;
  const response = await fetcher(
    findingsSarifUrl(input.apiUrl, input.missionId),
    {
      credentials: "include",
      headers: {
        Accept: "application/sarif+json, application/json",
        Cookie: cookieHeader(input.sessionCookies)
      },
      method: "GET"
    }
  );

  if (!response.ok) {
    throw new Error(
      `Unable to export findings SARIF (${response.status}). ${SARIF_EXPORT_HONESTY}`
    );
  }

  const outPath = path.join(process.cwd(), SARIF_EXPORT_FILENAME);
  await writeFile(outPath, await response.text(), "utf8");

  return {
    filename: SARIF_EXPORT_FILENAME,
    honesty: SARIF_EXPORT_HONESTY,
    path: outPath
  };
}
