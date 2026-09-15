import React, { useEffect, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";

import type { PeriscanApi } from "../lib/api.js";
import { theme } from "../theme.js";

export type LoginMode = "login" | "signup";

type LoginInput = {
  email: string;
  password: string;
};

type SignupInput = {
  email: string;
  name: string;
  password: string;
  tenantName: string;
};

type AuthMethod = "login" | "signup";

function readAuthMethod(
  api: PeriscanApi,
  name: AuthMethod
): ((input: LoginInput | SignupInput) => Promise<unknown>) | undefined {
  const candidate = (api as unknown as Record<string, unknown>)[name];
  return typeof candidate === "function"
    ? (candidate as (input: LoginInput | SignupInput) => Promise<unknown>)
    : undefined;
}

function accountNameFromEmail(email: string): string {
  // Signup requires name; this screen collects tenant, not a display name.
  const at = email.indexOf("@");
  const local = at > 0 ? email.slice(0, at) : email;
  return local || email;
}

function errorStatus(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : fallback;
}

export async function authenticateWithApi(input: {
  api: PeriscanApi;
  email: string;
  mode: LoginMode;
  password: string;
  tenant: string;
}): Promise<string> {
  const email = input.email.trim();
  const tenant = input.tenant.trim();
  const { api, password } = input;

  if (!email) {
    return "Email is required.";
  }
  if (!password) {
    return "Password is required.";
  }

  if (input.mode === "signup") {
    if (!tenant) {
      return "Tenant is required to sign up.";
    }
    if (password.length < 12) {
      return "Password must be at least 12 characters.";
    }

    const signup = readAuthMethod(api, "signup");
    if (typeof signup !== "function") {
      return "Signup is not available on this API client.";
    }

    try {
      await signup.call(api, {
        email,
        name: accountNameFromEmail(email),
        password,
        tenantName: tenant
      });
      return `Created tenant ${tenant} as ${email}.`;
    } catch (error) {
      return errorStatus(error, "Signup failed.");
    }
  }

  const login = readAuthMethod(api, "login");
  if (typeof login !== "function") {
    return "Login is not available on this API client.";
  }

  try {
    await login.call(api, { email, password });
    return `Signed in as ${email}.`;
  } catch (error) {
    return errorStatus(error, "Login failed.");
  }
}

type FormStep = "email" | "password" | "tenant";

function withoutTabs(value: string): string {
  return value.replace(/\t/gu, "");
}

function Field(props: {
  active: boolean;
  disabled?: boolean;
  label: string;
  mask?: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  value: string;
}) {
  const display = props.mask && props.value
    ? "*".repeat(props.value.length)
    : props.value;

  return (
    <Box>
      <Box width={10}>
        <Text color={props.active ? theme.accent : theme.muted}>
          {props.label}
        </Text>
      </Box>
      {props.active && !props.disabled ? (
        <TextInput
          focus
          mask={props.mask}
          onChange={(value) => {
            props.onChange(withoutTabs(value));
          }}
          onSubmit={() => {
            props.onSubmit();
          }}
          placeholder={props.placeholder}
          showCursor
          value={props.value}
        />
      ) : (
        <Text color={props.value ? theme.ink : theme.muted}>
          {display || props.placeholder || ""}
        </Text>
      )}
    </Box>
  );
}

export function isAuthSuccessStatus(status: string): boolean {
  return (
    status.startsWith("Created tenant ") || status.startsWith("Signed in as ")
  );
}

export function LoginScreen(props: {
  api: PeriscanApi;
  onAuthenticated?: () => void;
  onStatus: (s: string) => void;
}) {
  const { api, onStatus } = props;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenant, setTenant] = useState("");
  const [step, setStep] = useState<FormStep>("email");
  const [busy, setBusy] = useState(false);
  const cancelled = useRef(false);
  const mode: LoginMode = tenant.trim() ? "signup" : "login";

  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
    };
  }, []);

  const stepRef = useRef(step);
  stepRef.current = step;

  useInput((input, key) => {
    if (busy) {
      return;
    }
    const enter = key.return || input === "\r" || input === "\n";
    if (!enter) {
      return;
    }
    const current = stepRef.current;
    if (current === "email") {
      setStep("password");
      return;
    }
    if (current === "password") {
      setStep("tenant");
      return;
    }
    void submit();
  });

  async function submit(): Promise<void> {
    if (busy) {
      return;
    }

    setBusy(true);
    onStatus(mode === "signup" ? "Creating account…" : "Signing in…");

    const status = await authenticateWithApi({
      api,
      email,
      mode,
      password,
      tenant
    });

    if (cancelled.current) {
      return;
    }

    onStatus(status);
    setBusy(false);
    if (isAuthSuccessStatus(status)) {
      props.onAuthenticated?.();
    }
  }

  return (
    <Box flexDirection="column">
      <Text bold color={theme.accent}>
        Login
      </Text>
      <Text color={theme.muted}>
        {mode === "signup"
          ? "create account · live /auth/signup"
          : "sign in · live /auth/login"}
      </Text>
      <Box flexDirection="column" marginTop={1}>
        <Field
          active={step === "email"}
          disabled={busy}
          label="Email"
          onChange={setEmail}
          onSubmit={() => {
            /* Enter is handled on the screen so a real TTY and Ink agree. */
          }}
          placeholder="work email"
          value={email}
        />
        <Field
          active={step === "password"}
          disabled={busy}
          label="Password"
          mask="*"
          onChange={setPassword}
          onSubmit={() => {
            /* Enter is handled on the screen so a real TTY and Ink agree. */
          }}
          placeholder="password"
          value={password}
        />
        <Field
          active={step === "tenant"}
          disabled={busy}
          label="Tenant"
          onChange={setTenant}
          onSubmit={() => {
            /* Enter is handled on the screen so a real TTY and Ink agree. */
          }}
          placeholder="organization · leave empty to sign in"
          value={tenant}
        />
      </Box>
      <Box marginTop={1}>
        <Text color={theme.muted}>
          Enter next · Enter on Tenant submits · leave tenant empty to sign in
        </Text>
      </Box>
    </Box>
  );
}
