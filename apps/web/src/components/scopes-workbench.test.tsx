import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CommunityValidationSuiteResponse, Scope } from "@periscan/shared";

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

function communitySuite(
  overrides: Partial<CommunityValidationSuiteResponse> = {}
): CommunityValidationSuiteResponse {
  return {
    cloudAwsAvailable: true,
    copyleftOptIn: {
      hint: "GPL/LGPL extras stay Engine Lab.",
      licensedToolIds: [],
      modules: []
    },
    deferredModules: [],
    editionId: "community",
    includeExternalPoa: false,
    licenseNote: "Not live Atomic.",
    modules: [
      {
        defaultSafetyLevel: "PassiveReadOnly",
        executionMode: "ControlPlane",
        moduleId: "gitleaks.repo_secrets",
        requiredScopeTypes: ["Repository"],
        targetKind: "repositoryPath",
        title: "Repository secret scan",
        toolId: "gitleaks",
        toolLicense: "MIT"
      }
    ],
    runnerAvailable: true,
    scopeType: "Repository",
    startableModuleIds: ["gitleaks.repo_secrets"],
    valueLine: "Community edition is the open-core validation pack.",
    ...overrides
  };
}

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
    vi.spyOn(api, "getCommunityValidationSuite").mockResolvedValue(
      communitySuite()
    );
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
    expect(type).toHaveValue("Repository");
    expect(
      [...type.querySelectorAll("option")].map((option) => option.value)
    ).toEqual(["Domain", "Repository", "CloudAccount", "IPRange"]);
    expect(
      [...type.querySelectorAll("option")].map((option) => option.textContent)
    ).toEqual(["Domain", "Repository", "AWS account", "CIDR"]);
    expect(screen.getByLabelText("Scope value")).toHaveAttribute(
      "placeholder",
      "/opt/customer/repo"
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

  it("adds a Repository scope from the default Community-verifiable type", async () => {
    const created = scope({
      assetClass: "Code",
      scopeType: "Repository",
      value: "/opt/customer/repo",
      verificationMethod: "FILE"
    });
    vi.spyOn(api, "listScopes")
      .mockResolvedValueOnce([])
      .mockResolvedValue([created]);
    const createScope = vi.spyOn(api, "createScope").mockResolvedValue(created);

    render(<ScopesWorkbench />);
    await screen.findByText("Nothing runs until a scope is verified.");
    expect(screen.getByLabelText("Scope type")).toHaveValue("Repository");

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
    expect(
      await screen.findAllByText("/opt/customer/repo")
    ).not.toHaveLength(0);
  });

  it("adds a Domain scope when the operator picks that type", async () => {
    const created = scope();
    vi.spyOn(api, "listScopes")
      .mockResolvedValueOnce([])
      .mockResolvedValue([created]);
    const createScope = vi.spyOn(api, "createScope").mockResolvedValue(created);

    render(<ScopesWorkbench />);
    await screen.findByText("Nothing runs until a scope is verified.");

    fireEvent.change(screen.getByLabelText("Scope type"), {
      target: { value: "Domain" }
    });
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
    vi.spyOn(api, "listScopes").mockResolvedValue([]);
    const createScope = vi.spyOn(api, "createScope");

    render(<ScopesWorkbench />);
    await screen.findByLabelText("Scope type");

    expect(screen.getByLabelText("Scope type")).toHaveValue("Repository");
    fireEvent.change(screen.getByLabelText("Scope value"), {
      target: { value: "https://github.com/acme/payments-api" }
    });
    expect(screen.getByLabelText("Scope type")).toHaveValue("Repository");
    expect(screen.getByRole("note")).toHaveTextContent(
      /cannot be added or verified/i
    );

    expect(screen.getByRole("button", { name: /^add scope$/i })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /^add scope$/i }));
    expect(createScope).not.toHaveBeenCalled();
  });

  it("does not offer Verify for a pending hosted GitHub URL repository", async () => {
    vi.spyOn(api, "listScopes").mockResolvedValue([
      scope({
        assetClass: "Code",
        scopeType: "Repository",
        value: "https://github.com/org/repo",
        verificationMethod: "FILE"
      })
    ]);
    const verifyScope = vi.spyOn(api, "verifyScope");

    render(<ScopesWorkbench />);

    expect(
      await screen.findAllByText("https://github.com/org/repo")
    ).not.toHaveLength(0);
    expect(screen.getAllByText("Pending")).not.toHaveLength(0);
    expect(
      screen.queryByRole("button", { name: /^verify authorization$/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /attest/i })).not.toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(
      /cannot be added or verified/i
    );
    expect(screen.getByRole("note")).toHaveTextContent(
      /absolute path such as \/opt\/customer\/repo/i
    );
    expect(
      screen.queryByText(/\.periscan-authorization/)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^copy$/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: /download \.periscan-authorization/i
      })
    ).not.toBeInTheDocument();
    expect(verifyScope).not.toHaveBeenCalled();
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

    expect(screen.getByLabelText("Scope type")).toHaveValue("Repository");
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

    expect(screen.getByLabelText("Scope type")).toHaveValue("Repository");
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

  it("copies the token and downloads .periscan-authorization for a pending local repo", async () => {
    vi.spyOn(api, "listScopes").mockResolvedValue([
      scope({
        assetClass: "Code",
        scopeType: "Repository",
        value: "/tmp/customer-repo",
        verificationMethod: "FILE",
        verificationToken: "periscan-a0901c6698480ffcb3c0bbfe"
      })
    ]);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    let downloadedName = "";
    let downloadedBlob: Blob | null = null;
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockImplementation((obj) => {
        downloadedBlob = obj as Blob;
        return "blob:mock-authorization";
      });
    const revokeObjectURL = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloadedName = this.download;
      });

    try {
      render(<ScopesWorkbench />);

      expect(
        await screen.findByText(/Token periscan-a0901c6698480ffcb3c0bbfe/)
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /^copy$/i }));
      await waitFor(() => {
        expect(writeText).toHaveBeenCalledWith(
          "periscan-a0901c6698480ffcb3c0bbfe"
        );
      });

      fireEvent.click(
        screen.getByRole("button", {
          name: /download \.periscan-authorization/i
        })
      );
      expect(downloadedName).toBe(".periscan-authorization");
      expect(downloadedBlob).toBeInstanceOf(Blob);
      expect(await downloadedBlob!.text()).toBe(
        "periscan-a0901c6698480ffcb3c0bbfe"
      );
    } finally {
      createObjectURL.mockRestore();
      revokeObjectURL.mockRestore();
      clickSpy.mockRestore();
    }
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

  it("does not advertise Run Community validation for an attested CloudAccount with 0 startable engines", async () => {
    const cloud = scope({
      assetClass: "Cloud",
      scopeType: "CloudAccount",
      value: "123456789012",
      verificationMethod: "AWS_INTEGRATION",
      verificationStatus: "Verified",
      verifiedAt: now,
      verifiedBy: userId
    });
    vi.spyOn(api, "listScopes").mockResolvedValue([cloud]);
    vi.spyOn(api, "getCommunityValidationSuite").mockResolvedValue(
      communitySuite({
        cloudAwsAvailable: false,
        deferredModules: [
          {
            moduleId: "prowler.aws_posture",
            reason: "Connect an AWS integration to start Prowler.",
            title: "Prowler AWS posture"
          },
          {
            moduleId: "cloudlist.cloud_assets",
            reason: "Enroll an internal runner to start this engine.",
            title: "cloudlist cloud assets"
          }
        ],
        modules: [
          {
            defaultSafetyLevel: "PassiveReadOnly",
            executionMode: "ControlPlane",
            moduleId: "prowler.aws_posture",
            requiredScopeTypes: ["CloudAccount"],
            targetKind: "hostname",
            title: "Prowler AWS posture",
            toolId: "prowler",
            toolLicense: "Apache-2.0"
          }
        ],
        runnerAvailable: false,
        scopeType: "CloudAccount",
        startableModuleIds: []
      })
    );

    render(<ScopesWorkbench />);

    expect(await screen.findAllByText("123456789012")).not.toHaveLength(0);
    const connect = await screen.findByRole("link", { name: /^connect aws$/i });
    expect(connect).toHaveAttribute("href", "/integrations");
    expect(connect).toHaveTextContent(/^Connect AWS$/);
    expect(
      screen.queryByRole("link", { name: /run community validation/i })
    ).not.toBeInTheDocument();
  });

  it("still offers Run Community validation when a verified repository has startable engines", async () => {
    vi.spyOn(api, "listScopes").mockResolvedValue([
      scope({
        assetClass: "Code",
        scopeType: "Repository",
        value: "/opt/customer/repo",
        verificationMethod: "FILE",
        verificationStatus: "Verified",
        verifiedAt: now,
        verifiedBy: userId
      })
    ]);

    render(<ScopesWorkbench />);

    const run = await screen.findByRole("link", {
      name: /run community validation/i
    });
    expect(run).toHaveAttribute("href", "/missions");
    expect(
      screen.queryByRole("link", { name: /^connect aws$/i })
    ).not.toBeInTheDocument();
  });

  it("says no engines start instead of Run when startable is empty and AWS is already connected", async () => {
    vi.spyOn(api, "listScopes").mockResolvedValue([
      scope({
        assetClass: "Cloud",
        scopeType: "CloudAccount",
        value: "123456789012",
        verificationMethod: "AWS_INTEGRATION",
        verificationStatus: "Verified",
        verifiedAt: now,
        verifiedBy: userId
      })
    ]);
    vi.spyOn(api, "getCommunityValidationSuite").mockResolvedValue(
      communitySuite({
        cloudAwsAvailable: true,
        runnerAvailable: false,
        scopeType: "CloudAccount",
        startableModuleIds: []
      })
    );

    render(<ScopesWorkbench />);

    expect(await screen.findAllByText("123456789012")).not.toHaveLength(0);
    expect(
      screen.queryByRole("link", { name: /run community validation/i })
    ).not.toBeInTheDocument();
    expect(
      await screen.findByText(/no community engines start yet/i)
    ).toBeInTheDocument();
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
