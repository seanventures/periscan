import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useWithBusy } from "./use-with-busy";

describe("useWithBusy", () => {
  it("returns true and stays error-free on success", async () => {
    const { result } = renderHook(() => useWithBusy());
    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.run(async () => undefined);
    });
    expect(outcome).toBe(true);
    expect(result.current.busy).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("captures the error message and returns false on failure", async () => {
    const { result } = renderHook(() => useWithBusy());
    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.run(async () => {
        throw new Error("boom");
      });
    });
    expect(outcome).toBe(false);
    expect(result.current.error).toBe("boom");
  });

  it("uses the fallback message for non-Error throws and clears on demand", async () => {
    const { result } = renderHook(() => useWithBusy());
    await act(async () => {
      await result.current.run(async () => {
        throw "weird";
      }, "Save failed.");
    });
    expect(result.current.error).toBe("Save failed.");
    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
  });
});
