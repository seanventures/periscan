import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildWebhookBody, signWebhookBody } from "./signing.js";

describe("webhook signing", () => {
  it("produces a verifiable HMAC-SHA256 signature over the serialized body", () => {
    const body = buildWebhookBody({
      createdAt: "2026-06-06T00:00:00.000Z",
      deliveryId: "11111111-1111-1111-1111-111111111111",
      eventType: "mission.completed",
      payload: { missionId: "abc", status: "Completed" },
      tenantId: "22222222-2222-2222-2222-222222222222"
    });
    const serialized = JSON.stringify(body);
    const signature = signWebhookBody("whsec_example", serialized);

    const expected = `sha256=${createHmac("sha256", "whsec_example")
      .update(serialized)
      .digest("hex")}`;

    expect(signature).toBe(expected);
    expect(signature).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it("changes signature when the secret changes", () => {
    const serialized = JSON.stringify({ a: 1 });

    expect(signWebhookBody("secret-a", serialized)).not.toBe(
      signWebhookBody("secret-b", serialized)
    );
  });
});
