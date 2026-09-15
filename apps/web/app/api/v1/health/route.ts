import { NextResponse } from "next/server";

import { ApiErrorSchema, HEALTH_ROUTE } from "@periscan/shared";

import { resolvePeriscanApiUrl } from "../upstream";

export async function GET() {
  try {
    const apiUrl = resolvePeriscanApiUrl();
    const response = await fetch(`${apiUrl}${HEALTH_ROUTE}`, {
      cache: "no-store"
    });

    const payload = await response.json();

    if (!response.ok) {
      const parsedError = ApiErrorSchema.safeParse(payload);

      return NextResponse.json(
        parsedError.success
          ? parsedError.data
          : {
              error: `Upstream API health failed with status ${response.status}`
            },
        {
          status: response.status
        }
      );
    }

    return NextResponse.json(payload, {
      status: response.status
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unable to reach Periscan API";

    return NextResponse.json(
      {
        code: "api_proxy_unavailable",
        error: message
      },
      {
        status: 503
      }
    );
  }
}
