import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { RemediationWorkbench } from "./remediation-workbench";

describe("RemediationWorkbench empty (P09)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a single primary CTA on empty list", async () => {
    vi.spyOn(api, "listRemediations").mockResolvedValue([]);

    render(<RemediationWorkbench />);

    expect(await screen.findByTestId("remediation-empty")).toBeInTheDocument();
    const primary = screen.getByTestId("remediation-empty-primary-cta");
    expect(primary).toHaveAttribute("href", "/findings");
    expect(primary).toHaveTextContent(/Review findings/i);
    // No competing secondary CTA on empty.
    expect(
      screen.queryByRole("link", { name: /Run a Validation Snapshot/i })
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByRole("link", { name: /Review findings/i })).toHaveLength(
        1
      );
    });
  });
});
