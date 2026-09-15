import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SchedulesWorkbench } from "./schedules-workbench";

const timestamp = "2026-07-14T12:00:00.000Z";

describe("SchedulesWorkbench", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("exposes timezone, blackout, edit, and delete lifecycle controls", async () => {
    const scheduleId = "33333333-3333-4333-8333-333333333333";
    const scopeId = "44444444-4444-4444-8444-444444444444";
    const otherScopeId = "55555555-5555-4555-8555-555555555555";
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const route = String(input).split("?")[0] ?? "";
      if (route === "/api/v1/scopes") {
        const baseScope = {
          createdAt: timestamp,
          createdBy: "22222222-2222-4222-8222-222222222222",
          scopeType: "Domain",
          tenantId: "11111111-1111-4111-8111-111111111111",
          updatedAt: timestamp,
          verificationMethod: "DNS_TXT",
          verificationStatus: "Verified",
          verificationToken: "periscan-token",
          verifiedAt: timestamp,
          verifiedBy: "22222222-2222-4222-8222-222222222222"
        };
        return {
          json: async () => ({
            items: [
              { ...baseScope, scopeId, value: "lab.example" },
              { ...baseScope, scopeId: otherScopeId, value: "app.example" }
            ]
          }),
          ok: true,
          status: 200
        };
      }
      if (route === "/api/v1/schedules") {
        return {
          json: async () => ({
            items: [
              {
                config: {
                  scheduleTiming: {
                    blackoutWindows: [
                      {
                        daysOfWeek: [0, 6],
                        endTime: "06:00",
                        startTime: "22:00"
                      }
                    ],
                    dayOfWeek: 1,
                    runAtLocalTime: "09:30",
                    timeZone: "America/New_York"
                  }
                },
                createdAt: timestamp,
                createdBy: "22222222-2222-4222-8222-222222222222",
                frequency: "Weekly",
                lastDiff: null,
                lastMissionId: null,
                lastRunAt: null,
                lastSnapshotId: null,
                missionType: "ValidationSnapshot",
                nextRunAt: "2026-07-20T13:30:00.000Z",
                scheduleId,
                scopeIds: [scopeId],
                status: "Active",
                tenantId: "11111111-1111-4111-8111-111111111111",
                updatedAt: timestamp
              }
            ]
          }),
          ok: true,
          status: 200
        };
      }
      if (route === `/api/v1/schedules/${scheduleId}` && init?.method === "PATCH") {
        return {
          json: async () => ({ scheduleId, status: "Active" }),
          ok: true,
          status: 200
        };
      }
      throw new Error(`Unhandled route ${route}`);
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<SchedulesWorkbench />);

    // ICP-P2-1: list-first when schedules exist; create form behind New schedule.
    expect(await screen.findByText("09:30 America/New_York · 1 blackout")).toBeInTheDocument();
    expect(screen.getByTestId("schedules-list")).toBeInTheDocument();
    expect(screen.queryByTestId("schedules-create-form")).not.toBeInTheDocument();
    expect(screen.getByTestId("continuous-health-strip")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Continuous hub/i })
    ).toHaveAttribute("href", "/continuous");

    fireEvent.click(screen.getByTestId("schedules-new-toggle"));
    expect(await screen.findByTestId("schedules-create-form")).toBeInTheDocument();
    expect(screen.getByLabelText("Run time")).toBeInTheDocument();
    expect(screen.getByLabelText("Schedule timezone")).toBeInTheDocument();
    // Row shows scope value (not only count) with a deep link.
    expect(screen.getByRole("link", { name: "lab.example" })).toHaveAttribute(
      "href",
      `/scopes?scopeId=${scopeId}`
    );

    fireEvent.click(screen.getByLabelText("Recurring blackout window"));
    expect(screen.getByLabelText("Blackout starts")).toBeInTheDocument();
    expect(screen.getByText(/Policy is re-evaluated before every run/)).toBeInTheDocument();

    expect(screen.getByTestId("next-run-preview")).toBeInTheDocument();
    expect(screen.getByText("Next runs (estimate)")).toBeInTheDocument();
    expect(screen.getByText(/Client-side preview from weekly cadence/)).toBeInTheDocument();
    // Three numbered fire estimates before submit
    const preview = screen.getByTestId("next-run-preview");
    expect(preview.querySelectorAll("li")).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Edit run time")).toHaveValue("09:30");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
    // P14-5: edit multi-select shows scopes and saveEdit includes scopeIds.
    const editScopes = screen.getByRole("group", { name: "Edit schedule scopes" });
    const appScopeToggle = Array.from(editScopes.querySelectorAll("button")).find(
      (button) => button.textContent === "app.example"
    );
    expect(appScopeToggle).toBeDefined();
    fireEvent.click(appScopeToggle!);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(
        ([url, init]) =>
          String(url).includes(`/api/v1/schedules/${scheduleId}`) &&
          (init as RequestInit | undefined)?.method === "PATCH"
      );
      expect(patchCall).toBeDefined();
      const body = JSON.parse(String((patchCall![1] as RequestInit).body));
      expect(body.scopeIds).toEqual(
        expect.arrayContaining([scopeId, otherScopeId])
      );
      expect(body.scopeIds).toHaveLength(2);
      expect(body.config).toEqual(
        expect.objectContaining({ communityValidation: false })
      );
    });
    // Wait for async saveEdit finally + refetch so row actions re-enable.
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Save changes" })
      ).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("dialog", { name: "Delete this schedule?" })).toBeInTheDocument();
  });

  it("states continuous EASM honesty: verified scopes only, not a living map", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const route = String(input).split("?")[0] ?? "";
        if (route === "/api/v1/scopes") {
          return { json: async () => ({ items: [] }), ok: true, status: 200 };
        }
        if (route === "/api/v1/schedules") {
          return { json: async () => ({ items: [] }), ok: true, status: 200 };
        }
        throw new Error(`Unhandled route ${route}`);
      }) as unknown as typeof fetch
    );

    render(<SchedulesWorkbench />);

    // Page chrome always denies living-map claim for continuous schedules.
    expect(
      await screen.findByText(/not an autonomous living map/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/verified scope/i)).toBeInTheDocument();
    // Empty program seeds create form open (ICP-P2-1).
    expect(await screen.findByTestId("schedules-create-form")).toBeInTheDocument();
    expect(screen.queryByTestId("continuous-easm-schedule-note")).toBeNull();

    // Selecting ContinuousValidation surfaces the Wave C allowlist honesty callout.
    const missionSelect = screen.getByDisplayValue("ValidationSnapshot");
    fireEvent.change(missionSelect, {
      target: { value: "ContinuousValidation" }
    });
    const note = await screen.findByTestId("continuous-easm-schedule-note");
    expect(note).toHaveTextContent(/allowlisted safe/i);
    expect(note).toHaveTextContent(/verified Domain\/Subdomain/i);
    expect(note).toHaveTextContent(/not a living external map/i);
    expect(note).not.toHaveTextContent(/autonomous living map swarm/i);
  });

  it("lets operators opt a ValidationSnapshot schedule into the Community pack", async () => {
    const createdBodies: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const route = String(input).split("?")[0] ?? "";
        if (route === "/api/v1/scopes") {
          return { json: async () => ({ items: [] }), ok: true, status: 200 };
        }
        if (route === "/api/v1/schedules" && init?.method === "POST") {
          createdBodies.push(JSON.parse(String(init.body)));
          return {
            json: async () => ({
              scheduleId: "33333333-3333-4333-8333-333333333333",
              status: "Active"
            }),
            ok: true,
            status: 201
          };
        }
        if (route === "/api/v1/schedules") {
          return { json: async () => ({ items: [] }), ok: true, status: 200 };
        }
        throw new Error(`Unhandled route ${route}`);
      }) as unknown as typeof fetch
    );

    render(<SchedulesWorkbench />);

    expect(await screen.findByTestId("schedules-create-form")).toBeInTheDocument();
    const communityToggle = screen.getByLabelText("Run Community validation pack");
    expect(communityToggle).not.toBeChecked();
    expect(
      screen.getByText(/Starts engines; snapshot report is separate/i)
    ).toBeInTheDocument();

    fireEvent.click(communityToggle);
    fireEvent.click(screen.getByRole("button", { name: "Create schedule" }));

    await waitFor(() => {
      expect(createdBodies).toHaveLength(1);
    });
    expect(createdBodies[0]).toEqual(
      expect.objectContaining({
        missionType: "ValidationSnapshot",
        config: expect.objectContaining({ communityValidation: true })
      })
    );

    fireEvent.change(screen.getByDisplayValue("ValidationSnapshot"), {
      target: { value: "ContinuousValidation" }
    });
    expect(
      screen.queryByLabelText("Run Community validation pack")
    ).not.toBeInTheDocument();
  });

  it("lets operators turn Community pack on or off when editing a ValidationSnapshot schedule", async () => {
    const scheduleId = "33333333-3333-4333-8333-333333333333";
    const scopeId = "44444444-4444-4444-8444-444444444444";
    const patchedBodies: unknown[] = [];
    const schedule = {
      config: {
        communityValidation: true,
        scheduleTiming: {
          blackoutWindows: [],
          runAtLocalTime: "09:30",
          timeZone: "UTC"
        }
      },
      createdAt: timestamp,
      createdBy: "22222222-2222-4222-8222-222222222222",
      frequency: "Weekly",
      lastDiff: null,
      lastMissionId: null,
      lastRunAt: null,
      lastSnapshotId: null,
      missionType: "ValidationSnapshot",
      nextRunAt: "2026-07-20T13:30:00.000Z",
      scheduleId,
      scopeIds: [scopeId],
      status: "Active",
      tenantId: "11111111-1111-4111-8111-111111111111",
      updatedAt: timestamp
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const route = String(input).split("?")[0] ?? "";
        if (route === "/api/v1/scopes") {
          return { json: async () => ({ items: [] }), ok: true, status: 200 };
        }
        if (route === `/api/v1/schedules/${scheduleId}` && init?.method === "PATCH") {
          patchedBodies.push(JSON.parse(String(init.body)));
          return {
            json: async () => ({ scheduleId, status: "Active" }),
            ok: true,
            status: 200
          };
        }
        if (route === "/api/v1/schedules") {
          return { json: async () => ({ items: [schedule] }), ok: true, status: 200 };
        }
        throw new Error(`Unhandled route ${route}`);
      }) as unknown as typeof fetch
    );

    render(<SchedulesWorkbench />);

    expect(await screen.findByText("Community pack")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const communityToggle = screen.getByLabelText("Run Community validation pack");
    expect(communityToggle).toBeChecked();
    expect(
      screen.getByText(/Starts engines; snapshot report is separate/i)
    ).toBeInTheDocument();

    fireEvent.click(communityToggle);
    expect(communityToggle).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(patchedBodies).toHaveLength(1);
    });
    expect(patchedBodies[0]).toEqual(
      expect.objectContaining({
        config: expect.objectContaining({ communityValidation: false })
      })
    );
  });

  it("sends communityValidation true when an edit turns the Community pack on", async () => {
    const scheduleId = "33333333-3333-4333-8333-333333333333";
    const patchedBodies: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const route = String(input).split("?")[0] ?? "";
        if (route === "/api/v1/scopes") {
          return { json: async () => ({ items: [] }), ok: true, status: 200 };
        }
        if (route === `/api/v1/schedules/${scheduleId}` && init?.method === "PATCH") {
          patchedBodies.push(JSON.parse(String(init.body)));
          return {
            json: async () => ({ scheduleId, status: "Active" }),
            ok: true,
            status: 200
          };
        }
        if (route === "/api/v1/schedules") {
          return {
            json: async () => ({
              items: [
                {
                  config: {
                    scheduleTiming: {
                      blackoutWindows: [],
                      runAtLocalTime: "09:30",
                      timeZone: "UTC"
                    }
                  },
                  createdAt: timestamp,
                  createdBy: "22222222-2222-4222-8222-222222222222",
                  frequency: "Daily",
                  lastDiff: null,
                  lastMissionId: null,
                  lastRunAt: null,
                  lastSnapshotId: null,
                  missionType: "ValidationSnapshot",
                  nextRunAt: "2026-07-20T13:30:00.000Z",
                  scheduleId,
                  scopeIds: ["44444444-4444-4444-8444-444444444444"],
                  status: "Active",
                  tenantId: "11111111-1111-4111-8111-111111111111",
                  updatedAt: timestamp
                }
              ]
            }),
            ok: true,
            status: 200
          };
        }
        throw new Error(`Unhandled route ${route}`);
      }) as unknown as typeof fetch
    );

    render(<SchedulesWorkbench />);

    expect(await screen.findByText("ValidationSnapshot")).toBeInTheDocument();
    expect(screen.queryByText("Community pack")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const communityToggle = screen.getByLabelText("Run Community validation pack");
    expect(communityToggle).not.toBeChecked();
    fireEvent.click(communityToggle);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(patchedBodies).toHaveLength(1);
    });
    expect(patchedBodies[0]).toEqual(
      expect.objectContaining({
        config: expect.objectContaining({ communityValidation: true })
      })
    );
  });

  it("hides the Community pack checkbox when editing a non-snapshot schedule", async () => {
    const scheduleId = "33333333-3333-4333-8333-333333333333";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const route = String(input).split("?")[0] ?? "";
        if (route === "/api/v1/scopes") {
          return { json: async () => ({ items: [] }), ok: true, status: 200 };
        }
        if (route === "/api/v1/schedules") {
          return {
            json: async () => ({
              items: [
                {
                  config: {
                    scheduleTiming: {
                      blackoutWindows: [],
                      runAtLocalTime: "09:30",
                      timeZone: "UTC"
                    }
                  },
                  createdAt: timestamp,
                  createdBy: "22222222-2222-4222-8222-222222222222",
                  frequency: "Daily",
                  lastDiff: null,
                  lastMissionId: null,
                  lastRunAt: null,
                  lastSnapshotId: null,
                  missionType: "ContinuousValidation",
                  nextRunAt: "2026-07-20T13:30:00.000Z",
                  scheduleId,
                  scopeIds: ["44444444-4444-4444-8444-444444444444"],
                  status: "Active",
                  tenantId: "11111111-1111-4111-8111-111111111111",
                  updatedAt: timestamp
                }
              ]
            }),
            ok: true,
            status: 200
          };
        }
        throw new Error(`Unhandled route ${route}`);
      }) as unknown as typeof fetch
    );

    render(<SchedulesWorkbench />);

    expect(await screen.findByText("ContinuousValidation")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Run Community validation pack")
    ).not.toBeInTheDocument();
  });

  it("loads schedule run history and shows owner + recovery notes", async () => {
    const scheduleId = "33333333-3333-4333-8333-333333333333";
    const createdBy = "22222222-2222-4222-8222-222222222222";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const route = String(input).split("?")[0] ?? "";
        if (route === "/api/v1/scopes") {
          return { json: async () => ({ items: [] }), ok: true, status: 200 };
        }
        if (route === "/api/v1/schedules") {
          return {
            json: async () => ({
              items: [
                {
                  config: { scheduleTiming: { blackoutWindows: [], runAtLocalTime: "09:30", timeZone: "UTC" } },
                  createdAt: timestamp,
                  createdBy,
                  frequency: "Daily",
                  lastDiff: { verificationOutcome: "Still Exposed", packType: "ControlValidation" },
                  lastMissionId: null,
                  lastRunAt: timestamp,
                  lastSnapshotId: null,
                  missionType: "ControlValidation",
                  nextRunAt: "2026-07-20T13:30:00.000Z",
                  scheduleId,
                  scopeIds: ["44444444-4444-4444-8444-444444444444"],
                  status: "Active",
                  tenantId: "11111111-1111-4111-8111-111111111111",
                  updatedAt: timestamp
                }
              ]
            }),
            ok: true,
            status: 200
          };
        }
        if (route === `/api/v1/schedules/${scheduleId}`) {
          return {
            json: async () => ({
              scheduleId,
              priorDiffs: [
                {
                  at: timestamp,
                  outcome: "Still Exposed",
                  packId: "55555555-5555-4555-8555-555555555555",
                  packType: "ControlValidation",
                  runId: "66666666-6666-4666-8666-666666666666"
                }
              ]
            }),
            ok: true,
            status: 200
          };
        }
        throw new Error(`Unhandled route ${route}`);
      }) as unknown as typeof fetch
    );

    render(<SchedulesWorkbench />);

    expect(await screen.findByText(/owner 22222222/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    const history = await screen.findByRole("region", {
      name: "Schedule run history"
    });
    expect(history).toBeInTheDocument();
    expect(history).toHaveTextContent("Still Exposed");
    expect(history).toHaveTextContent(
      /Denied or stale work is never silently replayed/i
    );
  });
});
