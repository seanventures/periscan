import { NextResponse } from "next/server";

import { resolvePeriscanApiUrl } from "../upstream";

const FORWARDED_REQUEST_HEADERS = new Set([
  "accept",
  "content-type",
  "cookie",
  "x-periscan-tenant-id",
  // CSRF double-submit for cookie sessions (browser reads periscan_csrf).
  "x-csrf-token",
  // Proof-loop safe retries on selected POSTs.
  "idempotency-key",
  // Propagate a caller-supplied distributed-trace id to the API so a single
  // logical operation is correlated end to end. The API honors this header,
  // binds it to its per-request logger, and echoes it back (response headers
  // are passed through wholesale below).
  "x-trace-id"
]);

function getUpstreamUrl(request: Request, path: string[]) {
  const apiUrl = resolvePeriscanApiUrl();
  const url = new URL(request.url);

  return `${apiUrl}/api/v1/${path.join("/")}${url.search}`;
}

async function proxyRequest(
  request: Request,
  params: Promise<{ path: string[] }>
) {
  const { path } = await params;
  const headers = new Headers();

  for (const [key, value] of request.headers.entries()) {
    if (FORWARDED_REQUEST_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  }

  const hasBody =
    request.method !== "GET" &&
    request.method !== "HEAD" &&
    request.body !== null &&
    request.headers.get("content-length") !== "0";
  try {
    const upstream = await fetch(getUpstreamUrl(request, path), {
      body: hasBody ? await request.text() : undefined,
      cache: "no-store",
      headers,
      method: request.method,
      redirect: "manual"
    });
    const responseHeaders = new Headers(upstream.headers);

    responseHeaders.delete("content-length");
    responseHeaders.delete("connection");

    return new NextResponse(upstream.body, {
      headers: responseHeaders,
      status: upstream.status
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

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, context.params);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, context.params);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, context.params);
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, context.params);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, context.params);
}
