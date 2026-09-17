export function resolveWorkerFixtureTargetAllowance(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const devMode = env.PERISCAN_DEV_MODE === "true";

  if (env.PERISCAN_DEPLOYMENT_ENVIRONMENT === "production" && devMode) {
    throw new Error(
      "PERISCAN_DEV_MODE must be false when PERISCAN_DEPLOYMENT_ENVIRONMENT=production."
    );
  }

  return devMode;
}
