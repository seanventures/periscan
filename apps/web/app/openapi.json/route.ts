import { NextResponse } from "next/server";

import { OPENAPI_ROUTE } from "@periscan/shared";

import { resolvePeriscanApiUrl } from "../api/v1/upstream";

export async function GET() {
  try {
    const upstream = await fetch(`${resolvePeriscanApiUrl()}${OPENAPI_ROUTE}`, {
      cache: "no-store"
    });
    const headers = new Headers(upstream.headers);
    headers.delete("connection");
    headers.delete("content-length");

    return new NextResponse(upstream.body, {
      headers,
      status: upstream.status
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        code: "api_proxy_unavailable",
        error:
          error instanceof Error
            ? error.message
            : "Unable to reach Periscan API"
      },
      { status: 503 }
    );
  }
}
