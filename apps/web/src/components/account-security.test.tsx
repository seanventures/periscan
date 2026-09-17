import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AccountSecurity } from "./account-security";

const timestamp = "2026-06-01T00:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

function authPayload(
  mfaEnabledAt: string | null,
  options?: { mfaEnrollmentRequired?: boolean; requireMfa?: boolean }
) {
  return {
    membership: {
      createdAt: timestamp,
      membershipId: "33333333-3333-4333-8333-333333333333",
      role: "Owner",
      tenantId,
      updatedAt: timestamp,
      userId
    },
    ...(options?.mfaEnrollmentRequired
      ? { mfaEnrollmentRequired: true as const }
      : {}),
    tenant: {
      billingAccountId: null,
      createdAt: timestamp,
      dataRegion: "us-east-1",
      name: "Demo Security",
      parentTenantId: null,
      requireMfa: options?.requireMfa ?? false,
      tenantId,
      type: "Organization",
      updatedAt: timestamp
    },
    user: {
      createdAt: timestamp,
      email: "owner@example.com",
      mfaEnabledAt,
      name: "Owner User",
      status: "Active",
      updatedAt: timestamp,
      userId
    }
  };
}

function requireMfaResponse(effective: boolean) {
  return {
    effectiveRequireMfa: effective,
    envRequireMfa: false,
    requireMfa: effective
  };
}

function jsonResponse(payload: unknown, status = 200) {
  return { json: async () => payload, ok: status < 400, status };
}

describe("AccountSecurity", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("enrolls and activates MFA, then shows recovery codes once", async () => {
    let mfaEnabledAt: string | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string, init?: RequestInit) => {
        if (input === "/api/v1/me") {
          return jsonResponse(authPayload(mfaEnabledAt));
        }
        if (input.endsWith("/tenants/current/security-settings/require-mfa")) {
          return jsonResponse(requireMfaResponse(false));
        }
        if (input === "/api/v1/auth/mfa/enroll" && init?.method === "POST") {
          return jsonResponse({
            otpauthUri: "otpauth://totp/Periscan:owner?secret=JBSWY3DPEHPK3PXP",
            secret: "JBSWY3DPEHPK3PXP"
          });
        }
        if (input === "/api/v1/auth/mfa/verify" && init?.method === "POST") {
          mfaEnabledAt = timestamp;
          return jsonResponse({
            activated: true,
            mfaEnabledAt: timestamp,
            recoveryCodes: ["AAAA-BBBB-CCCC-DDDD", "EEEE-FFFF-GGGG-HHHH"]
          });
        }
        return jsonResponse({ error: `Unhandled ${input}` }, 404);
      }) as unknown as typeof fetch
    );

    render(<AccountSecurity />);

    await waitFor(() => {
      expect(
        screen.getByRole("status", { name: "MFA status: Disabled" })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Enable MFA" }));

    await waitFor(() => {
      expect(screen.getByText("JBSWY3DPEHPK3PXP")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("img", {
        name: "QR code for Periscan MFA enrollment"
      })
    ).toBeInTheDocument();
    expect(screen.queryByText(/otpauth:\/\/totp\//u)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Authenticator code"), {
      target: { value: "123456" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify & activate" }));

    await waitFor(() => {
      expect(
        screen.getByRole("status", { name: "Recovery codes" })
      ).toBeInTheDocument();
    });
    const codes = screen.getByRole("status", { name: "Recovery codes" });
    expect(within(codes).getByText("AAAA-BBBB-CCCC-DDDD")).toBeInTheDocument();
  });

  it("shows the disable + regenerate controls when MFA is already enabled", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input === "/api/v1/me") {
          return jsonResponse(authPayload(timestamp));
        }
        if (input.endsWith("/tenants/current/security-settings/require-mfa")) {
          return jsonResponse(requireMfaResponse(false));
        }
        return jsonResponse({ error: `Unhandled ${input}` }, 404);
      }) as unknown as typeof fetch
    );

    render(<AccountSecurity />);

    await waitFor(() => {
      expect(
        screen.getByRole("status", { name: "MFA status: Enabled" })
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: "Disable MFA" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Regenerate recovery codes" })
    ).toBeInTheDocument();
  });

  it("blocks disable MFA when force-MFA policy is on", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input === "/api/v1/me") {
          return jsonResponse(authPayload(timestamp, { requireMfa: true }));
        }
        if (input.endsWith("/tenants/current/security-settings/require-mfa")) {
          return jsonResponse(requireMfaResponse(true));
        }
        return jsonResponse({ error: `Unhandled ${input}` }, 404);
      }) as unknown as typeof fetch
    );

    render(<AccountSecurity />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Disable MFA" })
      ).toBeDisabled();
    });
    expect(
      screen.getByText(/required by workspace or deployment policy/i)
    ).toBeInTheDocument();
  });

  it("prompts for enrollment when mfaEnrollmentRequired is set", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input === "/api/v1/me") {
          return jsonResponse(
            authPayload(null, { mfaEnrollmentRequired: true, requireMfa: true })
          );
        }
        if (input.endsWith("/tenants/current/security-settings/require-mfa")) {
          return jsonResponse(requireMfaResponse(true));
        }
        return jsonResponse({ error: `Unhandled ${input}` }, 404);
      }) as unknown as typeof fetch
    );

    render(<AccountSecurity />);

    expect(
      await screen.findByText(/MFA enrollment required/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "MFA status: Required" })
    ).toBeInTheDocument();
  });

  it("changes the password and revokes older sessions without signing out this browser", async () => {
    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      if (input === "/api/v1/me") {
        return jsonResponse(authPayload(null));
      }
      if (input.endsWith("/tenants/current/security-settings/require-mfa")) {
        return jsonResponse(requireMfaResponse(false));
      }
      if (input === "/api/v1/auth/password/change" && init?.method === "POST") {
        return jsonResponse({
          message: "Your password was updated and older sessions were revoked."
        });
      }
      if (
        input === "/api/v1/auth/sessions/revoke-others" &&
        init?.method === "POST"
      ) {
        return jsonResponse({
          message: "Other signed-in browsers and devices were signed out."
        });
      }
      return jsonResponse({ error: `Unhandled ${input}` }, 404);
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<AccountSecurity />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Password" })
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "current-password" }
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "new-password-strong" }
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "new-password-strong" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "Your password was updated and older sessions were revoked."
        )
      ).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/password/change",
      expect.objectContaining({ method: "POST" })
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Sign out other sessions" })
    );
    await waitFor(() => {
      expect(
        screen.getByText(
          "Other signed-in browsers and devices were signed out."
        )
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Current browser")).toBeInTheDocument();
  });
});
