import { describe, expect, it } from "vitest";

import { pathEdgeReceiptLockKey } from "./path-receipt-lock.js";

describe("pathEdgeReceiptLockKey", () => {
  it("scopes the advisory lock key to the attack path id", () => {
    expect(pathEdgeReceiptLockKey("path-1")).toBe("path-edge-receipts:path-1");
    expect(pathEdgeReceiptLockKey("path-1")).not.toBe(
      pathEdgeReceiptLockKey("path-2")
    );
  });
});
