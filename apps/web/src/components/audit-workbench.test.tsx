import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AuditEvent } from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { AuditWorkbench } from "./audit-workbench";

describe("AuditWorkbench", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses server-side filters, offset pagination, and matching export scope", async () => {
    const event: AuditEvent = {
      action: "policy.decision",
      actorType: "User",
      auditEventId: "11111111-1111-4111-8111-111111111111",
      createdAt: "2026-07-14T14:00:00.000Z",
      entityId: "22222222-2222-4222-8222-222222222222",
      entityType: "Scope",
      metadata: {},
      tenantId: "33333333-3333-4333-8333-333333333333",
      userId: "44444444-4444-4444-8444-444444444444"
    };
    const listPage = vi.spyOn(api, "listAuditEventPage").mockResolvedValue({
      items: [event],
      page: { hasMore: true, limit: 50, offset: 0 }
    });
    const createExport = vi.spyOn(api, "createAuditExport").mockResolvedValue({
      downloadPath: "/api/v1/audit-events/export/example",
      eventCount: 1,
      exportId: "55555555-5555-4555-8555-555555555555",
      format: "csv",
      generatedAt: "2026-07-14T14:01:00.000Z",
      totalEventCount: 1,
      truncated: false
    });
    vi.spyOn(window, "open").mockImplementation(() => null);

    render(<AuditWorkbench />);

    expect(await screen.findByText("Events 1–1 · Page 1")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter by Area"), {
      target: { value: "Policy" }
    });
    fireEvent.change(screen.getByLabelText("Filter by Actor"), {
      target: { value: "User" }
    });
    fireEvent.change(screen.getByLabelText("Audit events from date"), {
      target: { value: "2026-07-01" }
    });
    fireEvent.change(screen.getByLabelText("Audit events to date"), {
      target: { value: "2026-07-14" }
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Search" }), {
      target: { value: "decision" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() =>
      expect(listPage).toHaveBeenLastCalledWith({
        actorType: "User",
        category: "Policy",
        from: "2026-07-01T00:00:00.000Z",
        limit: 50,
        offset: 0,
        search: "decision",
        to: "2026-07-14T23:59:59.999Z"
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() =>
      expect(listPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ offset: 50 })
      )
    );

    fireEvent.click(screen.getByRole("button", { name: "CSV" }));
    await waitFor(() =>
      expect(createExport).toHaveBeenCalledWith("csv", {
        actorType: "User",
        category: "Policy",
        from: "2026-07-01T00:00:00.000Z",
        search: "decision",
        to: "2026-07-14T23:59:59.999Z"
      })
    );
    expect(
      await screen.findByText("1 filtered events exported.")
    ).toBeInTheDocument();
  });
});
