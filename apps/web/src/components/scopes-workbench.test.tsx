import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Scope } from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { ScopesWorkbench } from "./scopes-workbench";

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

const now = "2026-07-14T14:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const scopeId = "33333333-3333-4333-8333-333333333333";

function scope(overrides: Partial<Scope> = {}): Scope {
  return {
    assetClass: "BusinessApplication",
    businessCriticality: "Moderate",
    createdAt: now,
    createdBy: userId,
    effectiveMaxSafetyLevel: "ActiveNonInvasive",
    externalValidationProfileId: null,
    isOperationalTechnology: false,
    lastPostureCheckAt: null,
    maxSafetyLevel: "ActiveNonInvasive",
    nextPostureCheckAt: null,
    purdueLevel: null,
    safetyRestrictionReason:
      "This scope permits validation through ActiveNonInvasive.",
    scopeId,
    scopeType: "Domain",
    segmentName: null,
    sensitivity: "Moderate",
    tags: [],
    tenantId,
    updatedAt: now,
    value: "app.example.com",
    verificationExpiresAt: null,
    verificationMethod: "DNS_TXT",
    verificationStale: false,
    verificationStatus: "Pending",
    verificationToken: "periscan-token",
    verifiedAt: null,
    verifiedBy: null,
    ...overrides
  };
}

describe("ScopesWorkbench", () => {
  beforeEach(() => {
    vi.spyOn(api, "listExternalValidationProfiles").mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows one add form with Domain, Repository, CloudAccount, and CIDR", async () => {
    vi.spyOn(api, "listScopes").mockResolvedValue([]);

    render(<ScopesWorkbench />);

    expect(
      await screen.findByText("Nothing runs until a scope is verified.")
    ).toBeInTheDocument();

    const type = screen.getByLabelText("Scope type");
    expect(type).toHaveValue("Domain");
    expect(
      [...type.querySelectorAll("option")].map((option) => option.value)
    ).toEqual(["Domain", "Repository", "CloudAccount", "IPRange"]);
    expect(
      [...type.querySelectorAll("option")].map((option) => option.textContent)
    ).toEqual(["Domain", "Repository", "AWS account", "CIDR"]);
    expect(screen.getByLabelText("Scope value")).toHaveAttribute(
      "placeholder",
      "example.com"
    );

    expect(
      screen.getAllByRole("button", { name: /^add scope$/i })
    ).toHaveLength(1);

    expect(screen.queryByText(/assets & ownership/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/inventory/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Subdomain/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/No authorized scopes yet/i)
    ).not.toBeInTheDocument();
  });

  it("uses an AWS account id placeholder when CloudAccount is selected", async () => {
    vi.spyOn(api, "listScopes").mockResolvedValue([]);

    render(<ScopesWorkbench />);
    await screen.findByLabelText("Scope type");

    fireEvent.change(screen.getByLabelText("Scope type"), {
      target: { value: "CloudAccount" }
    });
    expect(screen.getByLabelText("Scope value")).toHaveAttribute(
      "placeholder",
      "123456789012"
    );

    fireEvent.change(screen.getByLabelText("Scope type"), {
      target: { value: "IPRange" }
    });
    expect(screen.getByLabelText("Scope value")).toHaveAttribute(
      "placeholder",
      "10.0.0.0/24"
    );
  });

  it("adds a Domain scope from the default Community-verifiable type", async () => {
    const created = scope();
    vi.spyOn(api, "listScopes")
      .mockResolvedValueOnce([])
      .mockResolvedValue([created]);
    const createScope = vi.spyOn(api, "createScope").mockResolvedValue(created);

    render(<ScopesWorkbench />);
    await screen.findByText("Nothing runs until a scope is verified.");

    fireEvent.change(screen.getByLabelText("Scope value"), {
      target: { value: "app.example.com" }
    });
    fireEvent.click(screen.getByRole("button", { name: /^add scope$/i }));

    await waitFor(() => {
      expect(createScope).toHaveBeenCalledWith({
        assetClass: "BusinessApplication",
        scopeType: "Domain",
        value: "app.example.com"
      });
    });
    expect(
      await screen.findAllByText("app.example.com")
    ).not.toHaveLength(0);
  });

  it("adds a Repository scope when the operator picks that type", async () => {
    const created = scope({
      assetClass: "Code",
      scopeId: "44444444-4444-4444-8444-444444444444",
      scopeType: "Repository",
      value: "/opt/customer/repo",
      verificationMethod: "FILE"
    });
    vi.spyOn(api, "listScopes")
      .mockResolvedValueOnce([])
      .mockResolvedValue([created]);
    const createScope = vi.spyOn(api, "createScope").mockResolvedValue(created);

    render(<ScopesWorkbench />);
    await screen.findByLabelText("Scope type");

    fireEvent.change(screen.getByLabelText("Scope type"), {
      target: { value: "Repository" }
    });
    fireEvent.change(screen.getByLabelText("Scope value"), {
      target: { value: "/opt/customer/repo" }
    });
    fireEvent.click(screen.getByRole("button", { name: /^add scope$/i }));

    await waitFor(() => {
      expect(createScope).toHaveBeenCalledWith({
        assetClass: "Code",
        scopeType: "Repository",
        value: "/opt/customer/repo"
      });
    });
  });

  it("adds a CloudAccount scope when the operator picks that type", async () => {
    const created = scope({
      assetClass: "Cloud",
      scopeId: "55555555-5555-4555-8555-555555555555",
      scopeType: "CloudAccount",
      value: "123456789012",
      verificationMethod: "AWS_INTEGRATION"
    });
    vi.spyOn(api, "listScopes")
      .mockResolvedValueOnce([])
      .mockResolvedValue([created]);
    const createScope = vi.spyOn(api, "createScope").mockResolvedValue(created);

    render(<ScopesWorkbench />);
    await screen.findByLabelText("Scope type");

    fireEvent.change(screen.getByLabelText("Scope type"), {
      target: { value: "CloudAccount" }
    });
    fireEvent.change(screen.getByLabelText("Scope value"), {
      target: { value: "123456789012" }
    });
    fireEvent.click(screen.getByRole("button", { name: /^add scope$/i }));

    await waitFor(() => {
      expect(createScope).toHaveBeenCalledWith({
        assetClass: "Cloud",
        scopeType: "CloudAccount",
        value: "123456789012"
      });
    });
  });

  it("adds a CIDR as IPRange when the operator picks that type", async () => {
    const created = scope({
      assetClass: "Network",
      scopeId: "66666666-6666-4666-8666-666666666666",
      scopeType: "IPRange",
      value: "10.0.0.0/24",
      verificationMethod: "OPERATOR_ATTESTATION"
    });
    vi.spyOn(api, "listScopes")
      .mockResolvedValueOnce([])
      .mockResolvedValue([created]);
    const createScope = vi.spyOn(api, "createScope").mockResolvedValue(created);

    render(<ScopesWorkbench />);
    await screen.findByLabelText("Scope type");

    fireEvent.change(screen.getByLabelText("Scope type"), {
      target: { value: "IPRange" }
    });
    fireEvent.change(screen.getByLabelText("Scope value"), {
      target: { value: "10.0.0.0/24" }
    });
    fireEvent.click(screen.getByRole("button", { name: /^add scope$/i }));

    await waitFor(() => {
      expect(createScope).toHaveBeenCalledWith({
        assetClass: "Network",
        scopeType: "IPRange",
        value: "10.0.0.0/24"
      });
    });
  });

  it("infers Repository when a hosted git org/repo URL is pasted", async () => {
    const created = scope({
      assetClass: "Code",
      scopeId: "55555555-5555-4555-8555-555555555555",
      scopeType: "Repository",
      value: "https://github.com/acme/payments-api",
      verificationMethod: "FILE"
    });
    vi.spyOn(api, "listScopes")
      .mockResolvedValueOnce([])
      .mockResolvedValue([created]);
    const createScope = vi.spyOn(api, "createScope").mockResolvedValue(created);

    render(<ScopesWorkbench />);
    await screen.findByLabelText("Scope type");

    expect(screen.getByLabelText("Scope type")).toHaveValue("Domain");
    fireEvent.change(screen.getByLabelText("Scope value"), {
      target: { value: "https://github.com/acme/payments-api" }
    });
    expect(screen.getByLabelText("Scope type")).toHaveValue("Repository");

    fireEvent.click(screen.getByRole("button", { name: /^add scope$/i }));

    await waitFor(() => {
      expect(createScope).toHaveBeenCalledWith({
        assetClass: "Code",
        scopeType: "Repository",
        value: "https://github.com/acme/payments-api"
      });
    });
  });

  it("infers CloudAccount when a 12-digit AWS account id is pasted", async () => {
    const created = scope({
      assetClass: "Cloud",
      scopeId: "77777777-7777-4777-8777-777777777777",
      scopeType: "CloudAccount",
      value: "123456789012",
      verificationMethod: "AWS_INTEGRATION"
    });
    vi.spyOn(api, "listScopes")
      .mockResolvedValueOnce([])
      .mockResolvedValue([created]);
    const createScope = vi.spyOn(api, "createScope").mockResolvedValue(created);

    render(<ScopesWorkbench />);
    await screen.findByLabelText("Scope type");

    expect(screen.getByLabelText("Scope type")).toHaveValue("Domain");
    fireEvent.change(screen.getByLabelText("Scope value"), {
      target: { value: "123456789012" }
    });
    expect(screen.getByLabelText("Scope type")).toHaveValue("CloudAccount");

    fireEvent.click(screen.getByRole("button", { name: /^add scope$/i }));

    await waitFor(() => {
      expect(createScope).toHaveBeenCalledWith({
        assetClass: "Cloud",
        scopeType: "CloudAccount",
        value: "123456789012"
      });
    });
  });

  it("infers CIDR (IPRange) when a CIDR is pasted", async () => {
    const created = scope({
      assetClass: "Network",
      scopeId: "88888888-8888-4888-8888-888888888888",
      scopeType: "IPRange",
      value: "10.0.0.0/24",
      verificationMethod: "OPERATOR_ATTESTATION"
    });
    vi.spyOn(api, "listScopes")
      .mockResolvedValueOnce([])
      .mockResolvedValue([created]);
    const createScope = vi.spyOn(api, "createScope").mockResolvedValue(created);

    render(<ScopesWorkbench />);
    await screen.findByLabelText("Scope type");

    expect(screen.getByLabelText("Scope type")).toHaveValue("Domain");
    fireEvent.change(screen.getByLabelText("Scope value"), {
      target: { value: "10.0.0.0/24" }
    });
    expect(screen.getByLabelText("Scope type")).toHaveValue("IPRange");

    fireEvent.click(screen.getByRole("button", { name: /^add scope$/i }));

    await waitFor(() => {
      expect(createScope).toHaveBeenCalledWith({
        assetClass: "Network",
        scopeType: "IPRange",
        value: "10.0.0.0/24"
      });
    });
  });

  it("does not send operators to inventory when a scope is already listed", async () => {
    vi.spyOn(api, "listScopes").mockResolvedValue([scope()]);

    render(<ScopesWorkbench />);

    expect(
      await screen.findAllByText("app.example.com")
    ).not.toHaveLength(0);
    expect(screen.queryByText(/assets & ownership/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /assets/i })).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /^add scope$/i })
    ).toHaveLength(1);
  });

  it("does not present Repository Attest as equal to the authorization file", async () => {
    vi.spyOn(api, "listScopes").mockResolvedValue([
      scope({
        assetClass: "Code",
        scopeType: "Repository",
        value: "/tmp/never-existed-repo",
        verificationMethod: "FILE"
      })
    ]);

    render(<ScopesWorkbench />);

    expect(
      await screen.findByRole("button", { name: /^verify authorization$/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^attest authorization$/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /attest as owner \(runner-only path\)/i
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Audited attestation — not a substitute for the authorization file when the control plane can read the path."
      )
    ).toBeInTheDocument();
  });

  it("keeps Domain verification on DNS TXT and does not offer Attest", async () => {
    vi.spyOn(api, "listScopes").mockResolvedValue([scope()]);

    render(<ScopesWorkbench />);

    expect(
      await screen.findByRole("button", { name: /^verify authorization$/i })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /attest/i })).not.toBeInTheDocument();
    expect(screen.getByText(/DNS TXT _periscan\./i)).toBeInTheDocument();
    expect(screen.getByText(/Publish the DNS TXT record/i)).toBeInTheDocument();
    expect(screen.queryByText(/lab only/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/not a substitute for the authorization file/i)
    ).not.toBeInTheDocument();
  });

  it("verifies CloudAccount via connected AWS, with Owner attest as the fallback", async () => {
    const cloud = scope({
      assetClass: "Cloud",
      scopeType: "CloudAccount",
      value: "123456789012",
      verificationMethod: "AWS_INTEGRATION"
    });
    vi.spyOn(api, "listScopes").mockResolvedValue([cloud]);
    const verifyScope = vi
      .spyOn(api, "verifyScope")
      .mockResolvedValue({ ...cloud, verificationStatus: "Verified" });

    render(<ScopesWorkbench />);

    expect(
      await screen.findByRole("button", { name: /^verify authorization$/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Connect an AWS integration whose account id matches this scope/i
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/DNS TXT _periscan\./i)).not.toBeInTheDocument();
    expect(screen.queryByText(/lab only/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^attest as owner$/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: /attest as owner \(runner-only path\)/i
      })
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /^verify authorization$/i })
    );
    await waitFor(() => {
      expect(verifyScope).toHaveBeenCalledWith(scopeId, {
        operatorAttestation: false
      });
    });

    fireEvent.click(screen.getByRole("button", { name: /^attest as owner$/i }));
    await waitFor(() => {
      expect(verifyScope).toHaveBeenCalledWith(scopeId, {
        operatorAttestation: true
      });
    });
  });

  it.each([
    ["IPRange", "10.0.0.0/24"],
    ["InternalNetwork", "10.42.0.0/24"]
  ] as const)(
    "labels %s Attest as an audited Owner/Admin statement",
    async (scopeType, value) => {
      vi.spyOn(api, "listScopes").mockResolvedValue([
        scope({
          assetClass: "Network",
          scopeType,
          value,
          verificationMethod: "MANUAL",
          verificationToken: null
        })
      ]);

      render(<ScopesWorkbench />);

      expect(await screen.findAllByText(value)).not.toHaveLength(0);
      expect(
        screen.queryByRole("button", { name: /^attest authorization$/i })
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /^attest as owner$/i })
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "Audited Owner/Admin statement that this CIDR or internal network is customer-authorized."
        )
      ).toBeInTheDocument();
      expect(screen.queryByText(/lab only/i)).not.toBeInTheDocument();
    }
  );
});
