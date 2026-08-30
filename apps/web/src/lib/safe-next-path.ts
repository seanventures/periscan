/**
 * Returns a same-origin relative path suitable for post-login navigation,
 * or null when missing/unsafe (open-redirect candidates).
 *
 * Accepts path-absolute values only (`/findings`, `/missions/abc?tab=1`).
 * Rejects protocol-relative (`//evil.com`), absolute URLs, backslash tricks,
 * and encoded variants that resolve outside the app origin.
 */
export function safeInternalNextPath(
  next: string | null | undefined
): string | null {
  if (typeof next !== "string") return null;
  const trimmed = next.trim();
  if (!trimmed) return null;

  // Path-absolute only — never protocol-relative.
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;

  // Reject scheme and backslash smuggling before decode.
  if (trimmed.includes("://") || trimmed.includes("\\")) return null;

  let decoded = trimmed;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    return null;
  }
  if (
    decoded.startsWith("//") ||
    decoded.includes("://") ||
    decoded.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(decoded)
  ) {
    return null;
  }

  try {
    const base = "https://periscan.invalid";
    const url = new URL(trimmed, base);
    if (url.origin !== base) return null;
    // Drop auth-screen loops; those are not useful post-login destinations.
    if (
      url.pathname === "/login" ||
      url.pathname === "/signup" ||
      url.pathname.startsWith("/login/") ||
      url.pathname.startsWith("/signup/")
    ) {
      return null;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/** Read `?next=` from the current browser location (client-only). */
export function readNextQueryParam(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("next");
}
