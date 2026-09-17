import { NextResponse, type NextRequest } from "next/server";

// Server-side auth gate. Without this, an unauthenticated visitor to any app
// route was served the full authenticated shell — every panel rendering
// "Authentication required" — which reads as a broken product. The session is an
// httpOnly cookie set by the API through the same-origin proxy, so middleware can
// see its presence (not its value) and redirect before any shell renders.
const SESSION_COOKIE = "periscan_session";

// Routes reachable without a session: auth screens, token-based recovery
// (reset password, accept invite, verify email), the public sample, the API
// proxy (login itself POSTs here), health, and brand/static assets.
// Tokenized recovery links must stay public — otherwise middleware redirects
// to /login and drops the token query string.
const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/reset-password",
  "/accept-invite",
  "/verify-email",
  "/demo",
  "/api",
  "/brand",
  "/_next",
  "/favicon"
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Lightweight session-cookie sanity check (P03-11).
 *
 * Middleware does not hold the JWT signing secret, so it cannot verify the
 * signature. It *can* base64url-decode the payload and reject clearly expired
 * or structurally invalid cookies before rendering the authenticated shell.
 * API still performs full HS256 + sessionVersion verification.
 *
 * Returns true when the cookie looks like a non-expired session JWT.
 */
export function isSessionCookieStructurallyValid(
  raw: string | undefined
): boolean {
  if (!raw || raw.length < 16) {
    return false;
  }

  const parts = raw.split(".");
  if (parts.length !== 3) {
    return false;
  }

  const [, payloadB64] = parts;
  if (!payloadB64) {
    return false;
  }

  try {
    // JWT uses base64url; Node/Edge atob needs standard base64 padding.
    const normalized = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    const pad =
      normalized.length % 4 === 0
        ? ""
        : "=".repeat(4 - (normalized.length % 4));
    const json =
      typeof atob === "function"
        ? atob(normalized + pad)
        : Buffer.from(normalized + pad, "base64").toString("utf8");
    const payload = JSON.parse(json) as { exp?: unknown; userId?: unknown };

    if (typeof payload.userId !== "string" || payload.userId.length === 0) {
      return false;
    }

    if (typeof payload.exp === "number") {
      // Allow a small clock skew; reject clearly expired tokens.
      if (payload.exp * 1000 < Date.now() - 30_000) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

function clearSessionAndRedirect(request: NextRequest, loginPath: string) {
  const response = NextResponse.redirect(new URL(loginPath, request.url));
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax"
  });
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const rawSession = request.cookies.get(SESSION_COOKIE)?.value;
  const hasSession = Boolean(rawSession);
  const sessionLooksValid =
    hasSession && isSessionCookieStructurallyValid(rawSession);

  // Signed-in users have no reason to see the auth screens — send them home.
  // Only treat structurally valid cookies as signed-in so expired/malformed
  // tokens do not bounce recovery flows or lock users out of login.
  if (sessionLooksValid && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  if (sessionLooksValid) {
    return NextResponse.next();
  }

  // Expired/malformed cookie on a protected route: clear it and send to login
  // so the shell never renders under a fake "authenticated" cookie presence.
  if (hasSession && !sessionLooksValid) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/" && pathname !== "/dashboard") {
      loginUrl.searchParams.set("next", pathname);
    }
    return clearSessionAndRedirect(
      request,
      `${loginUrl.pathname}${loginUrl.search}`
    );
  }

  // Unauthenticated request for a protected route → the sign-in screen, with a
  // return path so the user lands back where they were headed.
  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/" && pathname !== "/dashboard") {
    loginUrl.searchParams.set("next", pathname);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Run on everything except Next internals and static files (which are public
  // anyway); the allow-list above still governs what needs a session.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand).*)"]
};
