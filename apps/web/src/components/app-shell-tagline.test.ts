import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * P3 (docs/qa/ux-validation-2026-08-15.md): 236px rail clipped the brand
 * line to "chee On Your Side" / "Never On Your Side". Stack the lockup so
 * the full phrase stays visible.
 */
describe("rail brand tagline (236px)", () => {
  const source = readFileSync(path.join(__dirname, "app-shell.tsx"), "utf8");

  const footer =
    source.match(
      /data-testid="rail-tagline"[\s\S]{0,800}Prove your defenses work\./
    )?.[0] ?? "";

  it("keeps the full brand phrase and stacks it for the 236px rail", () => {
    expect(source).toMatch(/md:grid-cols-\[236px_1fr\]/);
    expect(source).toContain('data-testid="rail-tagline"');
    expect(source).toContain("Prove your defenses work.");
    // Single-line lockup overflow-clipped the start of the phrase.
    expect(source).not.toMatch(
      /<span className="text-success">The Hacker On Your Side<\/span>/
    );
    expect(footer).toMatch(/<span>The Hacker<\/span>/);
    expect(footer).toMatch(/<span>On Your Side<\/span>/);
    expect(footer).toMatch(/flex-col/);
    expect(footer).toMatch(/whitespace-normal/);
    expect(footer).toMatch(/break-words/);
    expect(footer).not.toMatch(/whitespace-nowrap/);
  });
});
