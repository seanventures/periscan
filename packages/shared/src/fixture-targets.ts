export function targetIncludesFixtureHints(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((item) => targetIncludesFixtureHints(item));
  }

  return Object.entries(value as Record<string, unknown>).some(
    ([key, nestedValue]) => {
      const normalizedKey = key.toLowerCase();

      return (
        normalizedKey.startsWith("fixture") ||
        normalizedKey === "mockmode" ||
        targetIncludesFixtureHints(nestedValue)
      );
    }
  );
}
