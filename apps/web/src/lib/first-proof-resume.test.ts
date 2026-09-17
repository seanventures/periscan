import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  FIRST_PROOF_RESUME_KEY,
  clearFirstProofResume,
  readFirstProofResume,
  writeFirstProofResume
} from "./first-proof-resume";

describe("first-proof-resume", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-31T12:00:00.000Z"));
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it("writes and reads {step, href, updatedAt}", () => {
    writeFirstProofResume("Connect a source", "/integrations");

    expect(readFirstProofResume()).toEqual({
      step: "Connect a source",
      href: "/integrations",
      updatedAt: "2026-07-31T12:00:00.000Z"
    });
    expect(localStorage.getItem(FIRST_PROOF_RESUME_KEY)).toContain(
      "Connect a source"
    );
  });

  it("overwrites prior resume on a later primary CTA", () => {
    writeFirstProofResume("Connect a source", "/integrations");
    vi.setSystemTime(new Date("2026-07-31T12:05:00.000Z"));
    writeFirstProofResume("Authorize scope", "/scopes");

    expect(readFirstProofResume()).toEqual({
      step: "Authorize scope",
      href: "/scopes",
      updatedAt: "2026-07-31T12:05:00.000Z"
    });
  });

  it("clears resume storage", () => {
    writeFirstProofResume("Run a validation", "/missions");
    clearFirstProofResume();
    expect(readFirstProofResume()).toBeNull();
    expect(localStorage.getItem(FIRST_PROOF_RESUME_KEY)).toBeNull();
  });

  it("rejects external or protocol-relative hrefs", () => {
    writeFirstProofResume("Phish", "https://evil.example/x");
    expect(readFirstProofResume()).toBeNull();

    writeFirstProofResume("Phish", "//evil.example/x");
    expect(readFirstProofResume()).toBeNull();
  });

  it("ignores corrupt or incomplete payloads", () => {
    localStorage.setItem(FIRST_PROOF_RESUME_KEY, "{not-json");
    expect(readFirstProofResume()).toBeNull();

    localStorage.setItem(
      FIRST_PROOF_RESUME_KEY,
      JSON.stringify({ step: "Only step" })
    );
    expect(readFirstProofResume()).toBeNull();
  });
});
