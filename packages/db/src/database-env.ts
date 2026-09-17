export const DEFAULT_DATABASE_URL =
  "postgresql://periscan:periscan@127.0.0.1:5432/periscan";

export function resolveConfiguredDatabaseUrlFromEnv(env = process.env) {
  return (
    env.DATABASE_URL ??
    env.SUPABASE_DATABASE_URL ??
    env.SUPABASE_DB_URL ??
    env.POSTGRES_URL ??
    null
  );
}

export function resolveDatabaseUrlFromEnv(env = process.env) {
  // P3 test-infra: allow explicit override for acceptance/verify in conflicting envs
  // (e.g. export PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan)
  // Takes precedence only in test contexts to avoid affecting prod/dev defaulting.
  if (
    (env.VITEST || env.NODE_ENV === "test") &&
    env.PERISCAN_TEST_DATABASE_URL
  ) {
    return env.PERISCAN_TEST_DATABASE_URL;
  }

  const configured = resolveConfiguredDatabaseUrlFromEnv(env);

  if (configured) {
    return configured;
  }

  if (env.PERISCAN_DEPLOYMENT_ENVIRONMENT === "production") {
    throw new Error(
      "Set DATABASE_URL, SUPABASE_DATABASE_URL, SUPABASE_DB_URL, or POSTGRES_URL in production; refusing to use the local development database fallback."
    );
  }

  return DEFAULT_DATABASE_URL;
}
