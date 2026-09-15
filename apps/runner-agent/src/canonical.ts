// Canonical JSON used for runner-task signature verification. This MUST match
// the control-plane signer exactly (apps/api/src/runtime-services.ts
// canonicalizeJson/stringifyCanonicalJson) — the server signs the canonical form
// and the agent re-derives it to verify. Recursively sorts object keys
// (localeCompare, same as the server) and JSON-encodes.
export function canonicalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalizeJson);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalizeJson(child)])
    );
  }

  return value;
}

export function stringifyCanonicalJson(value: unknown): string {
  return JSON.stringify(canonicalizeJson(value));
}
