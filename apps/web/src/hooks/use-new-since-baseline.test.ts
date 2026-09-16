import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useNewSinceBaseline } from "./use-new-since-baseline";

describe("useNewSinceBaseline", () => {
  it("treats the first non-empty id set as baseline with zero new", () => {
    const { result, rerender } = renderHook(
      ({ ids }) => useNewSinceBaseline(ids),
      { initialProps: { ids: ["a", "b"] } }
    );
    expect(result.current.newCount).toBe(0);
    expect(result.current.baselineAt).not.toBeNull();

    rerender({ ids: ["a", "b", "c"] });
    expect(result.current.newCount).toBe(1);

    act(() => {
      result.current.acknowledge();
    });
    expect(result.current.newCount).toBe(0);
  });
});
