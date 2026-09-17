import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusPanel } from "./status-panel";

describe("StatusPanel", () => {
  it("names loading status panels from the visible heading", () => {
    render(
      <StatusPanel
        body="Loading tenant data from the API."
        kind="loading"
        title="Loading workspace."
      />
    );

    expect(
      screen.getByRole("status", { name: "Loading workspace." })
    ).toBeInTheDocument();
    expect(screen.getByText("Loading")).toBeInTheDocument();
  });

  it("names error panels from the visible heading", () => {
    render(
      <StatusPanel
        actions={<button type="button">Retry</button>}
        body="The API returned a tenant-scoped error."
        kind="error"
        title="Workspace could not be loaded."
      />
    );

    expect(
      screen.getByRole("alert", {
        name: "Workspace could not be loaded."
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
