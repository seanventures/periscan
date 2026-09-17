import { describe, expect, it, vi } from "vitest";

import { ConnectorHttpError, connectorFetch, type FetchImpl } from "./http.js";

/** A `sleep` spy that resolves immediately so tests never wait on real timers. */
function makeSleepSpy() {
  return vi.fn((ms: number): Promise<void> => {
    void ms;
    return Promise.resolve();
  });
}

/** Build a minimal `Response` with optional headers. */
function makeResponse(
  status: number,
  headers?: Record<string, string>
): Response {
  return new Response(status === 204 ? null : "body", {
    headers,
    status
  });
}

describe("connectorFetch", () => {
  it("passes a successful response straight through", async () => {
    const expected = makeResponse(200);
    const fetchImpl = vi.fn<FetchImpl>(async () => expected);
    const sleep = makeSleepSpy();

    const response = await connectorFetch(
      "https://example.test/ok",
      undefined,
      { fetchImpl, sleep }
    );

    expect(response).toBe(expected);
    expect(response.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("returns non-retryable 4xx responses for the caller to inspect", async () => {
    const fetchImpl = vi.fn<FetchImpl>(async () => makeResponse(404));
    const sleep = makeSleepSpy();

    const response = await connectorFetch(
      "https://example.test/missing",
      undefined,
      { fetchImpl, sleep }
    );

    expect(response.status).toBe(404);
    expect(response.ok).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("retries on HTTP 5xx and then succeeds", async () => {
    const ok = makeResponse(200);
    const fetchImpl = vi
      .fn<FetchImpl>()
      .mockResolvedValueOnce(makeResponse(503))
      .mockResolvedValueOnce(makeResponse(500))
      .mockResolvedValueOnce(ok);
    const sleep = makeSleepSpy();

    const response = await connectorFetch(
      "https://example.test/flaky",
      undefined,
      { fetchImpl, retries: 2, sleep }
    );

    expect(response).toBe(ok);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    // Two backoff sleeps, exponential: 250ms then 500ms.
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenNthCalledWith(1, 250);
    expect(sleep).toHaveBeenNthCalledWith(2, 500);
  });

  it("throws a server ConnectorHttpError when 5xx retries are exhausted", async () => {
    const fetchImpl = vi.fn<FetchImpl>(async () => makeResponse(502));
    const sleep = makeSleepSpy();

    await expect(
      connectorFetch("https://example.test/down", undefined, {
        fetchImpl,
        retries: 1,
        sleep
      })
    ).rejects.toMatchObject({
      kind: "server",
      status: 502
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not retry on HTTP 400", async () => {
    const fetchImpl = vi.fn<FetchImpl>(async () => makeResponse(400));
    const sleep = makeSleepSpy();

    const response = await connectorFetch(
      "https://example.test/bad",
      undefined,
      { fetchImpl, retries: 3, sleep }
    );

    expect(response.status).toBe(400);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("honors Retry-After (seconds) on HTTP 429 and retries", async () => {
    const ok = makeResponse(200);
    const fetchImpl = vi
      .fn<FetchImpl>()
      .mockResolvedValueOnce(makeResponse(429, { "retry-after": "2" }))
      .mockResolvedValueOnce(ok);
    const sleep = makeSleepSpy();

    const response = await connectorFetch(
      "https://example.test/limited",
      undefined,
      { fetchImpl, retries: 2, sleep }
    );

    expect(response).toBe(ok);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    // 2 seconds from Retry-After, not the exponential backoff value.
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("caps an oversized Retry-After at 30s", async () => {
    const ok = makeResponse(200);
    const fetchImpl = vi
      .fn<FetchImpl>()
      .mockResolvedValueOnce(makeResponse(429, { "retry-after": "120" }))
      .mockResolvedValueOnce(ok);
    const sleep = makeSleepSpy();

    await connectorFetch("https://example.test/limited", undefined, {
      fetchImpl,
      sleep
    });

    expect(sleep).toHaveBeenCalledWith(30000);
  });

  it("throws a rate_limited error when 429 persists past the budget", async () => {
    const fetchImpl = vi.fn<FetchImpl>(async () =>
      makeResponse(429, { "retry-after": "1" })
    );
    const sleep = makeSleepSpy();

    await expect(
      connectorFetch("https://example.test/limited", undefined, {
        fetchImpl,
        retries: 1,
        sleep
      })
    ).rejects.toMatchObject({
      kind: "rate_limited",
      status: 429
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("retries on network errors and then succeeds", async () => {
    const ok = makeResponse(200);
    const fetchImpl = vi
      .fn<FetchImpl>()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(ok);
    const sleep = makeSleepSpy();

    const response = await connectorFetch(
      "https://example.test/glitch",
      undefined,
      { fetchImpl, retries: 1, sleep }
    );

    expect(response).toBe(ok);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("throws a timeout error and does not retry when the request aborts", async () => {
    // Simulate a slow request that rejects with AbortError once aborted.
    const fetchImpl = vi.fn<FetchImpl>((_, init) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        const fail = () => {
          const abortError = new Error("aborted");
          abortError.name = "AbortError";
          reject(abortError);
        };
        if (signal?.aborted) {
          fail();
        } else {
          signal?.addEventListener("abort", fail);
        }
      });
    });
    const sleep = makeSleepSpy();

    await expect(
      connectorFetch("https://example.test/slow", undefined, {
        fetchImpl,
        retries: 2,
        sleep,
        timeoutMs: 5
      })
    ).rejects.toMatchObject({
      kind: "timeout"
    });
    // Timeouts are surfaced immediately; no retries, no backoff sleeps.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("exposes ConnectorHttpError with a usable detail and kind", async () => {
    const fetchImpl = vi.fn<FetchImpl>(async () => makeResponse(500));
    const sleep = makeSleepSpy();

    const error = await connectorFetch("https://example.test/err", undefined, {
      fetchImpl,
      retries: 0,
      sleep
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ConnectorHttpError);
    expect((error as ConnectorHttpError).kind).toBe("server");
    expect((error as ConnectorHttpError).detail).toContain("500");
  });
  it("does not retry a non-idempotent POST on 5xx by default", async () => {
    const fetchImpl = vi.fn<FetchImpl>(async () => makeResponse(500));
    const sleep = makeSleepSpy();

    await expect(
      connectorFetch(
        "https://example.test/send",
        { method: "POST" },
        { fetchImpl, retries: 2, sleep }
      )
    ).rejects.toBeInstanceOf(ConnectorHttpError);
    // No double-send: the POST is attempted exactly once.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("retries a POST only when retryNonIdempotent is opted in", async () => {
    const fetchImpl = vi
      .fn<FetchImpl>()
      .mockResolvedValueOnce(makeResponse(503))
      .mockResolvedValueOnce(makeResponse(200));
    const sleep = makeSleepSpy();

    const response = await connectorFetch(
      "https://example.test/send",
      { method: "POST" },
      { fetchImpl, retries: 2, retryNonIdempotent: true, sleep }
    );

    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
