export const LOCAL_API_URL = "http://127.0.0.1:3001";

function isProductionWebRuntime(env: NodeJS.ProcessEnv) {
  return (
    env.PERISCAN_DEPLOYMENT_ENVIRONMENT === "production" ||
    env.NODE_ENV === "production"
  );
}

export function resolvePeriscanApiUrl(env: NodeJS.ProcessEnv = process.env) {
  const configured = env.PERISCAN_API_URL?.trim().replace(/\/+$/u, "");

  if (configured) {
    const parsed = new URL(configured);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("PERISCAN_API_URL must be an HTTP(S) URL.");
    }

    return parsed.toString().replace(/\/+$/u, "");
  }

  if (isProductionWebRuntime(env)) {
    throw new Error(
      "Set PERISCAN_API_URL for production web deployments; refusing to proxy API calls to the local development API fallback."
    );
  }

  return LOCAL_API_URL;
}
