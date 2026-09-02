import { describe, expect, it } from "vitest";

import { summarizeNeedsYou } from "./dashboard-command-center";
import { formatSlaAge } from "./remediation-lib";

describe("summarizeNeedsYou", () => {
  it("combines the distinct operator queues without double-counting governed findings", () => {
    const result = summarizeNeedsYou({
      alerts: [
        { status: "New" },
        { status: "Acknowledged" }
      ] as never,
      findings: [
        { disposition: null, status: "New", priorityScore: 40 },
        {
          disposition: { approvalState: "Pending" },
          status: "Validated",
          priorityScore: 40
        }
      ] as never,
      remediations: [
        { status: "VerificationPending" },
        { status: "Fixed" }
      ] as never
    });

    expect(result).toEqual({
      newAlerts: 1,
      newFindings: 1,
      pendingApprovals: 1,
      readyToVerify: 1,
      overdueRemediations: 0,
      priorityUnowned: 0,
      // P14-16: total = non-empty queue categories, workUnits = raw item sum
      total: 4,
      workUnits: 4
    });
  });

  it("does not inflate total when only one queue has many items", () => {
    const result = summarizeNeedsYou({
      alerts: [],
      findings: [
        { disposition: null, status: "New", priorityScore: 10 },
        { disposition: null, status: "New", priorityScore: 10 },
        { disposition: null, status: "New", priorityScore: 10 }
      ] as never,
      remediations: [] as never
    });
    expect(result.total).toBe(1);
    expect(result.workUnits).toBe(3);
    expect(result.newFindings).toBe(3);
  });

  it("counts overdue remediations and priority unowned for SLA honesty", () => {
    const result = summarizeNeedsYou({
      alerts: [],
      findings: [
        {
          disposition: null,
          status: "Validated",
          priorityScore: 80,
          ownerId: undefined,
          ownerDisplay: undefined
        },
        {
          disposition: { disposition: "AcceptedRisk", ownerId: "acceptor" },
          status: "Validated",
          priorityScore: 90,
          ownerId: undefined,
          ownerDisplay: undefined
        },
        {
          disposition: { disposition: "Escalated", ownerId: "handler" },
          status: "Validated",
          priorityScore: 85,
          ownerId: undefined,
          ownerDisplay: undefined
        },
        {
          disposition: { disposition: "FalsePositive" },
          status: "Validated",
          priorityScore: 95,
          ownerId: undefined
        }
      ] as never,
      remediations: [
        {
          status: "Open",
          dueAt: "2020-01-01T00:00:00.000Z"
        },
        {
          status: "Fixed",
          dueAt: "2020-01-01T00:00:00.000Z"
        }
      ] as never
    });
    // AcceptedRisk acceptor alone does not own; Escalated assignee does; FP noise out.
    expect(result.priorityUnowned).toBe(2);
    expect(result.overdueRemediations).toBe(1);
    expect(result.workUnits).toBe(3);
    expect(result.total).toBe(2);
  });
});

describe("formatSlaAge", () => {
  it("labels overdue, due-soon, and future targets honestly", () => {
    const now = Date.parse("2026-07-29T12:00:00.000Z");
    expect(
      formatSlaAge("2026-07-20T12:00:00.000Z", { now, prefix: "SLA" })
    ).toMatchObject({ overdue: true, tone: "missed" });
    expect(
      formatSlaAge("2026-07-30T12:00:00.000Z", { now, prefix: "SLA" })
    ).toMatchObject({ dueSoon: true, tone: "approval" });
    expect(
      formatSlaAge("2026-09-01T00:00:00.000Z", { now, prefix: "target" }).label
    ).toMatch(/target/);
  });
});
