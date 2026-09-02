export const LOCAL_REDIS_URL = "redis://127.0.0.1:6379";

export interface RedisConnectionOptions {
  db: number;
  host: string;
  maxRetriesPerRequest: null;
  password?: string;
  port: number;
  username?: string;
}

export type RedisConfigEnvironment = Record<string, string | undefined>;

function isProductionRuntime(env: RedisConfigEnvironment) {
  return env.PERISCAN_DEPLOYMENT_ENVIRONMENT === "production";
}

export function resolveRedisUrlFromEnv(env: RedisConfigEnvironment = {}) {
  const configured = env.REDIS_URL?.trim();

  if (configured) {
    return configured;
  }

  if (isProductionRuntime(env)) {
    throw new Error(
      "Set REDIS_URL in production; refusing to use the local development Redis fallback."
    );
  }

  return LOCAL_REDIS_URL;
}

export function redisConnectionOptionsFromUrl(
  url: string
): RedisConnectionOptions {
  const parsedUrl =
    /^(rediss?):\/\/(?:(?<username>[^:@/?#]*)(?::(?<password>[^@/?#]*))?@)?(?<host>\[[^\]]+\]|[^:/?#]+)(?::(?<port>\d+))?(?:\/(?<db>\d+))?$/u.exec(
      url
    )?.groups;

  if (!parsedUrl?.host) {
    throw new Error("REDIS_URL must use redis:// or rediss://.");
  }

  return {
    db: parsedUrl.db ? Number(parsedUrl.db) : 0,
    host: parsedUrl.host.replace(/^\[/u, "").replace(/\]$/u, ""),
    maxRetriesPerRequest: null,
    password: parsedUrl.password || undefined,
    port: parsedUrl.port ? Number(parsedUrl.port) : 6379,
    username: parsedUrl.username || undefined
  };
}

export function resolveRedisConnectionOptionsFromEnv(
  env: RedisConfigEnvironment = {}
) {
  return redisConnectionOptionsFromUrl(resolveRedisUrlFromEnv(env));
}
