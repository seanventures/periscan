import React from "react";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PeriscanApi } from "../lib/api.js";

import {
  authenticateWithApi,
  isAuthSuccessStatus,
  LoginScreen,
  type LoginMode
} from "./login.js";

const ANSI_COLOR = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "gu");

function visible(frame: string | undefined): string {
  return (frame ?? "").replace(ANSI_COLOR, "");
}

function createApi(methods?: {
  login?: (input: { email: string; password: string }) => Promise<unknown>;
  signup?: (input: {
    email: string;
    name: string;
    password: string;
    tenantName: string;
  }) => Promise<unknown>;
}): PeriscanApi {
  const api = new PeriscanApi("http://127.0.0.1:3001");
  if (methods?.login) {
    (api as { login?: typeof methods.login }).login = methods.login;
  }
  if (methods?.signup) {
    (api as { signup?: typeof methods.signup }).signup = methods.signup;
  }
  return api;
}

afterEach(() => {
  cleanup();
});

describe("LoginScreen", () => {
  it("renders Login with email and password fields", () => {
    const { lastFrame, unmount } = render(
      <LoginScreen api={createApi()} onStatus={() => undefined} />
    );

    const frame = visible(lastFrame());
    expect(frame).toContain("Login");
    expect(frame).toMatch(/Email/i);
    expect(frame).toMatch(/Password/i);
    expect(frame).not.toMatch(/stub/i);
    expect(frame).not.toMatch(/demo/i);

    unmount();
  });

  it("shows tenant with leave-empty-to-sign-in so a TTY can signup without Tab", () => {
    const { lastFrame, unmount } = render(
      <LoginScreen api={createApi()} onStatus={() => undefined} />
    );

    const frame = visible(lastFrame());
    expect(frame).toMatch(/Tenant/i);
    expect(frame).toMatch(/leave empty to sign in/i);
    unmount();
  });

  it("calls onAuthenticated after login succeeds so the operator can leave auth", async () => {
    const login = vi.fn(async () => ({
      user: { email: "owner@acme.example" }
    }));
    const onAuthenticated = vi.fn();
    const instance = render(
      <LoginScreen
        api={createApi({ login })}
        onAuthenticated={onAuthenticated}
        onStatus={() => undefined}
      />
    );

    await new Promise((resolve) => setTimeout(resolve, 50));
    instance.stdin.write("owner@acme.example");
    await new Promise((resolve) => setTimeout(resolve, 50));
    instance.stdin.write("\r");
    await new Promise((resolve) => setTimeout(resolve, 50));
    instance.stdin.write("a-secure-password");
    await new Promise((resolve) => setTimeout(resolve, 50));
    instance.stdin.write("\r");
    await new Promise((resolve) => setTimeout(resolve, 50));
    instance.stdin.write("\r");

    await vi.waitFor(() => {
      expect(onAuthenticated).toHaveBeenCalledTimes(1);
    });
    expect(login).toHaveBeenCalled();
    instance.unmount();
  });
});

describe("isAuthSuccessStatus", () => {
  it("recognizes signup and login success copy only", () => {
    expect(isAuthSuccessStatus("Created tenant Acme as owner@acme.example.")).toBe(
      true
    );
    expect(isAuthSuccessStatus("Signed in as owner@acme.example.")).toBe(true);
    expect(isAuthSuccessStatus("Email is required.")).toBe(false);
    expect(isAuthSuccessStatus("Creating account…")).toBe(false);
  });
});

describe("authenticateWithApi", () => {
  it("calls api.login with email and password", async () => {
    const login = vi.fn(async () => ({
      user: { email: "owner@acme.example" }
    }));
    const status = await authenticateWithApi({
      api: createApi({ login }),
      mode: "login" satisfies LoginMode,
      email: " owner@acme.example ",
      password: "a-secure-password",
      tenant: ""
    });

    expect(login).toHaveBeenCalledWith({
      email: "owner@acme.example",
      password: "a-secure-password"
    });
    expect(status).toContain("owner@acme.example");
  });

  it("calls api.signup with email, password, and tenant", async () => {
    const signup = vi.fn(async () => ({ tenant: { name: "Acme" } }));
    const status = await authenticateWithApi({
      api: createApi({ signup }),
      mode: "signup",
      email: "owner@acme.example",
      password: "a-secure-password",
      tenant: " Acme "
    });

    expect(signup).toHaveBeenCalledWith({
      email: "owner@acme.example",
      name: "owner",
      password: "a-secure-password",
      tenantName: "Acme"
    });
    expect(status).toContain("Acme");
  });

  it("reports API errors through the returned status", async () => {
    const login = vi.fn(async () => {
      throw new Error("Invalid email or password.");
    });

    await expect(
      authenticateWithApi({
        api: createApi({ login }),
        mode: "login",
        email: "owner@acme.example",
        password: "wrong-password",
        tenant: ""
      })
    ).resolves.toBe("Invalid email or password.");
  });

  it("does not invent a session when login is missing", async () => {
    const api = {
      apiUrl: "http://127.0.0.1:3001",
      health: async () => ({ status: "ok" })
    } as PeriscanApi;

    const status = await authenticateWithApi({
      api,
      mode: "login",
      email: "owner@acme.example",
      password: "a-secure-password",
      tenant: ""
    });

    expect(status).toMatch(/not available/i);
  });
});
