import { renderHook, waitFor, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useApiResource } from "./use-api-resource";

describe("useApiResource", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  it("loads data and clears the loading flag", async () => {
    const loader = vi.fn(async () => ({ value: 42 }));
    const { result } = renderHook(() => useApiResource(loader, []));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ value: 42 });
    expect(result.current.error).toBeNull();
    expect(loader).toHaveBeenCalledOnce();
  });

  it("captures loader errors", async () => {
    const loader = vi.fn(async () => {
      throw new Error("nope");
    });
    const { result } = renderHook(() => useApiResource(loader, []));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("nope");
    expect(result.current.data).toBeNull();
  });

  it("refetch sets refreshing (not loading) and updates data", async () => {
    let n = 1;
    const loader = vi.fn(async () => ({ n: n++ }));
    const { result } = renderHook(() => useApiResource(loader, []));
    await waitFor(() => expect(result.current.data).toEqual({ n: 1 }));

    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.data).toEqual({ n: 2 });
    expect(result.current.refreshing).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  it("polls only while the document is visible", async () => {
    vi.useFakeTimers();
    const visibility = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("visible");
    const loader = vi.fn(async () => ({ ok: true }));
    const { unmount } = renderHook(() =>
      useApiResource(loader, [], { refetchIntervalMs: 1_000 })
    );

    await act(async () => Promise.resolve());
    expect(loader).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await Promise.resolve();
    });
    expect(loader).toHaveBeenCalledTimes(2);

    visibility.mockReturnValue("hidden");
    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await Promise.resolve();
    });
    expect(loader).toHaveBeenCalledTimes(2);
    unmount();
  });
});
