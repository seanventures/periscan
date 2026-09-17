import { describe, expect, it } from "vitest";

import { WEBHOOK_EVENT_TYPES } from "@periscan/shared";

import {
  listWebhookEventDataSummaries,
  parseWebhookEventData,
  webhookEventCatalogDescription,
  WEBHOOK_EVENT_DATA_SCHEMAS
} from "./event-payloads.js";

describe("webhook event data payloads (ICP-P1-8)", () => {
  it("covers every WebhookEventType with a data schema", () => {
    expect(Object.keys(WEBHOOK_EVENT_DATA_SCHEMAS).sort()).toEqual(
      [...WEBHOOK_EVENT_TYPES].sort()
    );
    expect(listWebhookEventDataSummaries()).toHaveLength(
      WEBHOOK_EVENT_TYPES.length
    );
    expect(WEBHOOK_EVENT_TYPES).toHaveLength(9);
  });

  it("lists all nine events in the OpenAPI catalog description string", () => {
    const desc = webhookEventCatalogDescription();
    for (const eventType of WEBHOOK_EVENT_TYPES) {
      expect(desc).toContain(`\`${eventType}\``);
    }
  });

  it("parses known mission.completed and remediation.verified payloads", () => {
    expect(
      parseWebhookEventData("mission.completed", {
        missionId: "m1",
        status: "Completed"
      }).success
    ).toBe(true);

    expect(
      parseWebhookEventData("remediation.verified", {
        outcome: "Fixed",
        remediationId: "r1",
        measuredRevalidation: true
      }).success
    ).toBe(true);
  });

  it("rejects mission.completed without missionId", () => {
    const result = parseWebhookEventData("mission.completed", {
      status: "Completed"
    });
    expect(result.success).toBe(false);
  });

  it("exposes data field summaries for receivers", () => {
    const mission = listWebhookEventDataSummaries().find(
      (entry) => entry.eventType === "mission.started"
    );
    expect(mission?.dataFields).toEqual(
      expect.arrayContaining(["missionId", "jobsQueued"])
    );
    expect(mission?.description.toLowerCase()).toMatch(/queued|startmission/);
  });
});
