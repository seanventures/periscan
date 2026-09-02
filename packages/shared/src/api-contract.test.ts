import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  CursorPaginatedListEnvelopeSchema,
  OffsetPaginatedListEnvelopeSchema,
  UnpaginatedListEnvelopeSchema,
  cursorPaginatedListSchema,
  offsetPaginatedListSchema,
  unpaginatedListSchema
} from "./api-contract.js";

const SampleItemSchema = z.object({
  id: z.string().uuid()
});

const sampleId = "11111111-1111-4111-8111-111111111111";

describe("list pagination envelopes", () => {
  it("accepts unpaginated { items } fixtures matching most list routes", () => {
    const parsed = UnpaginatedListEnvelopeSchema.parse({
      items: [{ id: sampleId }]
    });

    expect(parsed.items).toHaveLength(1);
    expect(
      unpaginatedListSchema(SampleItemSchema).parse({
        items: [{ id: sampleId }]
      }).items[0]?.id
    ).toBe(sampleId);
  });

  it("accepts cursor fixtures matching listMissions runtime shape", () => {
    const lastPage = CursorPaginatedListEnvelopeSchema.parse({
      items: [{ missionId: sampleId }],
      nextCursor: null
    });
    const midPage = cursorPaginatedListSchema(SampleItemSchema).parse({
      items: [{ id: sampleId }],
      nextCursor: sampleId
    });

    expect(lastPage.nextCursor).toBeNull();
    expect(midPage.nextCursor).toBe(sampleId);
  });

  it("accepts offset page fixtures matching listFindings/listAuditEvents", () => {
    const parsed = OffsetPaginatedListEnvelopeSchema.parse({
      items: [{ findingId: sampleId }],
      page: { hasMore: true, limit: 25, offset: 50 }
    });

    expect(parsed.page).toEqual({ hasMore: true, limit: 25, offset: 50 });
    expect(
      offsetPaginatedListSchema(SampleItemSchema).safeParse({
        items: [{ id: sampleId }],
        page: { hasMore: false, limit: 10, offset: 0 }
      }).success
    ).toBe(true);
  });

  it("rejects mismatched pagination metadata so contracts stay honest", () => {
    expect(
      CursorPaginatedListEnvelopeSchema.safeParse({
        items: [],
        page: { hasMore: false, limit: 10, offset: 0 }
      }).success
    ).toBe(false);
    expect(
      OffsetPaginatedListEnvelopeSchema.safeParse({
        items: [],
        nextCursor: null
      }).success
    ).toBe(false);
    expect(
      UnpaginatedListEnvelopeSchema.safeParse({
        items: [],
        nextCursor: null
      }).success
    ).toBe(false);
  });
});
