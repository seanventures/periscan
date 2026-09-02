import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { ValidationSnapshotFlow } from "./validation-snapshot-flow";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  )
}));

describe("ValidationSnapshotFlow hosted GitHub paste", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("explains that a GitHub URL is not a control-plane local path", async () => {
    vi.spyOn(api, "listScopes").mockResolvedValue([]);
    vi.spyOn(api, "listMissions").mockResolvedValue([]);

    render(<ValidationSnapshotFlow />);

    const input = await screen.findByLabelText("Scope value");
    expect(
      screen.queryByText(/control plane verifies a local clone/i)
    ).not.toBeInTheDocument();

    fireEvent.change(input, {
      target: { value: "https://github.com/acme/payments-api" }
    });

    expect(screen.getByRole("note")).toHaveTextContent(
      "The control plane verifies a local clone it can read. Hosted GitHub URLs stay pending until a runner has the repo. Attest is runner-only, not a skip."
    );
    expect(screen.getByLabelText("Scope type")).toHaveValue("Repository");
  });
});
