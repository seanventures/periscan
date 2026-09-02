import { randomUUID } from "node:crypto";

import { expect, type APIRequestContext, type BrowserContext } from "@playwright/test";

/**
 * Signup once for a suite, retrying on 429 (per-IP rate limit when many e2e
 * files share a host). Returns cookies for `context.addCookies`.
 */
export async function signupOnceWithRetry(
  request: APIRequestContext,
  options: {
    emailPrefix: string;
    name: string;
    password: string;
    tenantNamePrefix: string;
    attempts?: number;
  }
): Promise<Parameters<BrowserContext["addCookies"]>[0]> {
  const attempts = options.attempts ?? 12;
  let lastStatus = 0;
  let lastBody = "";

  for (let i = 0; i < attempts; i += 1) {
    const response = await request.post("/api/v1/auth/signup", {
      data: {
        email: `${options.emailPrefix}-${randomUUID()}@periscan.test`,
        name: options.name,
        password: options.password,
        tenantName: `${options.tenantNamePrefix} ${randomUUID()}`
      }
    });
    lastStatus = response.status();
    if (lastStatus === 201) {
      const cookies = (await request.storageState()).cookies;
      expect(cookies).not.toHaveLength(0);
      return cookies;
    }
    lastBody = await response.text();
    if (lastStatus === 429 && i < attempts - 1) {
      // Rate window is often 60s; wait 5s then 10s, 15s, …
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(60_000, 5_000 * (i + 1)))
      );
      continue;
    }
    if (lastStatus !== 429) {
      break;
    }
  }

  expect(
    lastStatus,
    `signup failed after retries: ${lastStatus} ${lastBody.slice(0, 200)}`
  ).toBe(201);
  return [];
}
