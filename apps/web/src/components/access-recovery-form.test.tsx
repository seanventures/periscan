import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AccessRecoveryForm } from "./access-recovery-form";

describe("AccessRecoveryForm", () => {
  afterEach(() => {
    window.history.replaceState({}, "", "/");
    vi.unstubAllGlobals();
  });

  it("requests a reset without revealing whether an account exists", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      json: async () => ({
        message: "If an account exists for that email, a password reset link has been sent."
      }),
      ok: true,
      status: 202
    });
    vi.stubGlobal("fetch", fetchImpl);

    render(<AccessRecoveryForm mode="reset" />);
    fireEvent.change(screen.getByLabelText("Work email"), {
      target: { value: "owner@example.com" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "If an account exists"
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/auth/password-reset/request",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("activates an invitation from its URL token", async () => {
    window.history.replaceState({}, "", "/accept-invite?token=invite-token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ message: "Invitation accepted." }),
        ok: true,
        status: 200
      })
    );

    render(<AccessRecoveryForm mode="invite" />);
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "a-secure-password" }
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "a-secure-password" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Activate account" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Invitation accepted"
    );
    expect(screen.getByRole("link", { name: "Continue to sign in" })).toHaveAttribute(
      "href",
      "/login"
    );
  });
});
