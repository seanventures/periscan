import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import {
  isSessionCookieStructurallyValid,
  middleware
} from "./middleware";

const SESSION_COOKIE = "periscan_session";

/** Minimal unsigned JWT-shaped cookie for middleware structural checks. */
function mintFakeSessionCookie(claims: {
  exp?: number;
  userId?: string;
}): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" })
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      userId: claims.userId ?? "user-1",
      defaultTenantId: "tenant-1",
      exp: claims.exp ?? Math.floor(Date.now() / 1000) + 3600
    })
  ).toString("base64url");
  return `${header}.${payload}.fakesig`;
}

function makeRequest(
  path: string,
  options: { session?: boolean; sessionValue?: string } = {}
): NextRequest {
  const url = new URL(path, "http://localhost:3000");
  const headers = new Headers();
  if (options.sessionValue) {
    headers.set("cookie", `${SESSION_COOKIE}=${options.sessionValue}`);
  } else if (options.session) {
    headers.set(
      "cookie",
      `${SESSION_COOKIE}=${mintFakeSessionCookie({})}`
    );
  }
  return new NextRequest(url, { headers });
}

function locationPath(response: Response): string {
  const location = response.headers.get("location");
  expect(location).toBeTruthy();
  return new URL(location!).pathname + new URL(location!).search;
}

describe("web auth middleware", () => {
  it("allows unauthenticated access to auth recovery routes (with or without token)", () => {
    const recoveryPaths = [
      "/reset-password",
      "/reset-password?token=abc123",
      "/accept-invite",
      "/accept-invite?token=invite-token",
      "/verify-email",
      "/verify-email?token=verify-token"
    ];

    for (const path of recoveryPaths) {
      const response = middleware(makeRequest(path));
      expect(response.status, `expected pass-through for ${path}`).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    }
  });

  it("allows unauthenticated access to existing public auth and infrastructure prefixes", () => {
    const publicPaths = [
      "/login",
      "/signup",
      "/demo",
      "/demo/workspace",
      "/api/v1/health",
      "/brand/periscan-logo-light.svg"
    ];

    for (const path of publicPaths) {
      const response = middleware(makeRequest(path));
      expect(response.status, `expected pass-through for ${path}`).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    }
  });

  it("redirects unauthenticated users away from protected routes", () => {
    const response = middleware(makeRequest("/dashboard"));
    expect(response.status).toBe(307);
    expect(locationPath(response)).toBe("/login");

    const withNext = middleware(makeRequest("/missions"));
    expect(withNext.status).toBe(307);
    expect(locationPath(withNext)).toBe("/login?next=%2Fmissions");
  });

  it("sends unsigned visitors on /welcome to login (not a public first-run wizard)", () => {
    // P02-1 residual: Welcome is not a competing public spine.
    const response = middleware(makeRequest("/welcome"));
    expect(response.status).toBe(307);
    expect(locationPath(response)).toBe("/login?next=%2Fwelcome");
  });

  it("does not treat protected lookalikes of recovery prefixes as public", () => {
    // Prefix matching is path-segment based (prefix or prefix/); a longer
    // sibling name must still require a session.
    const protectedLookalikes = [
      "/reset-password-admin",
      "/accept-invite-extra",
      "/verify-email-settings"
    ];

    for (const path of protectedLookalikes) {
      const response = middleware(makeRequest(path));
      expect(response.status, `expected redirect for ${path}`).toBe(307);
      expect(locationPath(response)).toContain("/login");
    }
  });

  it("allows authenticated users through protected routes", () => {
    const response = middleware(makeRequest("/dashboard", { session: true }));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects authenticated users away from login and signup only", () => {
    for (const path of ["/login", "/signup"]) {
      const response = middleware(makeRequest(path, { session: true }));
      expect(response.status).toBe(307);
      expect(locationPath(response)).toBe("/dashboard");
    }

    // Recovery flows remain reachable while signed in (e.g. verify email).
    for (const path of ["/reset-password", "/accept-invite", "/verify-email"]) {
      const response = middleware(makeRequest(path, { session: true }));
      expect(response.status, `expected pass-through for ${path}`).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    }
  });

  it("rejects expired or malformed session cookies on protected routes (P03-11)", () => {
    const expired = mintFakeSessionCookie({
      exp: Math.floor(Date.now() / 1000) - 120
    });
    const expiredResponse = middleware(
      makeRequest("/dashboard", { sessionValue: expired })
    );
    expect(expiredResponse.status).toBe(307);
    expect(locationPath(expiredResponse)).toBe("/login");
    // Clears the bad cookie so the shell is not sticky-auth'd.
    const setCookie = expiredResponse.headers.get("set-cookie") ?? "";
    expect(setCookie.toLowerCase()).toContain(SESSION_COOKIE);

    const malformed = middleware(
      makeRequest("/missions", { sessionValue: "not-a-jwt" })
    );
    expect(malformed.status).toBe(307);
    expect(locationPath(malformed)).toBe("/login?next=%2Fmissions");
  });

  it("does not treat expired cookies as signed-in on login (P03-11)", () => {
    const expired = mintFakeSessionCookie({
      exp: Math.floor(Date.now() / 1000) - 120
    });
    const response = middleware(
      makeRequest("/login", { sessionValue: expired })
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});

describe("isSessionCookieStructurallyValid", () => {
  it("accepts a non-expired JWT-shaped cookie with userId", () => {
    expect(isSessionCookieStructurallyValid(mintFakeSessionCookie({}))).toBe(
      true
    );
  });

  it("rejects empty, non-JWT, or expired cookies", () => {
    expect(isSessionCookieStructurallyValid(undefined)).toBe(false);
    expect(isSessionCookieStructurallyValid("")).toBe(false);
    expect(isSessionCookieStructurallyValid("abc.def")).toBe(false);
    expect(
      isSessionCookieStructurallyValid(
        mintFakeSessionCookie({ exp: Math.floor(Date.now() / 1000) - 60 })
      )
    ).toBe(false);
  });
});

