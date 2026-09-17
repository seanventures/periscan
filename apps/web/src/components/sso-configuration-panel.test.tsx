import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SsoConfigurationPanel } from "./sso-configuration-panel";

describe("SsoConfigurationPanel", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("offers complete OIDC and SAML setup instead of an API placeholder", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ config: null }),
        ok: true,
        status: 200
      })
    );

    render(<SsoConfigurationPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Configure" }));

    expect(screen.getByLabelText("Issuer URL")).toBeInTheDocument();
    expect(screen.getByLabelText("Client secret")).toBeRequired();
    expect(screen.getByLabelText("Callback URL")).toHaveValue(
      "http://localhost:3000/api/v1/auth/sso/callback"
    );
    expect(screen.getByLabelText("Role claim / attribute name")).toHaveValue(
      "groups"
    );
    expect(
      screen.getByLabelText("Group to role mappings")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "SAML" }));
    expect(screen.getByLabelText("IdP X.509 certificate")).toBeRequired();
    expect(
      screen.getByLabelText("Assertion consumer service (ACS) URL")
    ).toBeInTheDocument();
  });
});
