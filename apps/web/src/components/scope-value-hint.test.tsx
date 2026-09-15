import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ScopeValueHint } from "./scope-value-hint";

describe("ScopeValueHint", () => {
  it("warns that a hosted GitHub URL is not a control-plane local path", () => {
    render(<ScopeValueHint value="https://github.com/acme/payments-api" />);

    expect(screen.getByRole("note")).toHaveTextContent(
      "The control plane verifies a local clone path it can read, not github.com/org/repo. Paste an absolute path such as /opt/customer/repo. Hosted GitHub URLs cannot be added or verified here. Attest is runner-only, not a skip."
    );
    expect(screen.getByRole("note")).not.toHaveTextContent(/stay pending/i);
  });

  it("treats scheme-less github.com/org/repo pastes the same as https", () => {
    render(<ScopeValueHint value="github.com/acme/payments-api" />);

    expect(screen.getByRole("note")).toHaveTextContent(
      /control plane verifies a local clone/i
    );
  });

  it("stays silent for local paths, ordinary domains, and empty paste", () => {
    const { rerender } = render(<ScopeValueHint value="/opt/customer/repo" />);
    expect(screen.queryByRole("note")).not.toBeInTheDocument();

    rerender(<ScopeValueHint value="https://app.example.com/login" />);
    expect(screen.queryByRole("note")).not.toBeInTheDocument();

    rerender(<ScopeValueHint value="https://gitlab.com/acme/payments-api" />);
    expect(screen.queryByRole("note")).not.toBeInTheDocument();

    rerender(<ScopeValueHint value="https://github.com/acme" />);
    expect(screen.queryByRole("note")).not.toBeInTheDocument();

    rerender(<ScopeValueHint value="" />);
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });
});
