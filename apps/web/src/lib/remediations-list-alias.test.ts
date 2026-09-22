import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { remediationsListAliasTarget } from "./remediations-list-alias";

const webRoot = join(__dirname, "../..");
const DETAIL_ID = "080a115c-1111-4111-8111-111111111111";

describe("P3-REMALIAS /remediations list alias", () => {
  it("maps the plural list URL to the /remediation index and preserves query", () => {
    expect(remediationsListAliasTarget("/remediations")).toBe("/remediation");
    expect(remediationsListAliasTarget("/remediations/")).toBe("/remediation");
    expect(remediationsListAliasTarget("/remediations", "?status=Open")).toBe(
      "/remediation?status=Open"
    );
    expect(remediationsListAliasTarget("/remediations", "view=overdue")).toBe(
      "/remediation?view=overdue"
    );
  });

  it("does not steal /remediation/:id or invent a plural detail route", () => {
    expect(remediationsListAliasTarget("/remediation")).toBeNull();
    expect(remediationsListAliasTarget(`/remediation/${DETAIL_ID}`)).toBeNull();
    expect(remediationsListAliasTarget(`/remediations/${DETAIL_ID}`)).toBeNull();
    expect(remediationsListAliasTarget("/findings")).toBeNull();
    expect(remediationsListAliasTarget("/dashboard")).toBeNull();
  });

  it("ships a /remediations page that redirects to the list, not RemediationDetail", () => {
    const aliasPage = join(webRoot, "app/remediations/page.tsx");
    const listPage = join(webRoot, "app/remediation/page.tsx");
    const detailPage = join(webRoot, "app/remediation/[id]/page.tsx");
    const stolenDetail = join(webRoot, "app/remediations/[id]/page.tsx");

    expect(existsSync(aliasPage), "app/remediations/page.tsx must exist").toBe(
      true
    );
    expect(existsSync(stolenDetail)).toBe(false);

    const aliasSource = readFileSync(aliasPage, "utf8");
    expect(aliasSource).toMatch(/redirect\(/);
    expect(aliasSource).toMatch(/remediationsListAliasTarget/);
    expect(aliasSource).not.toMatch(/RemediationDetail/);
    expect(aliasSource).not.toMatch(/Mark Fixed/);

    const listSource = readFileSync(listPage, "utf8");
    expect(listSource).toMatch(/RemediationWorkbench/);
    expect(listSource).not.toMatch(/redirect\(/);

    const detailSource = readFileSync(detailPage, "utf8");
    expect(detailSource).toMatch(/RemediationDetail/);
    expect(detailSource).not.toMatch(/redirect\(/);
  });
});
