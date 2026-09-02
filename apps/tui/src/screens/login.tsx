import React, { useEffect, useRef, useState } from "react";
import { Box, Text, useFocus, useInput } from "ink";
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

function Field(props: {
  autoFocus?: boolean;
  disabled?: boolean;
  label: string;
  mask?: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  value: string;
}) {
  const { isFocused } = useFocus({
    autoFocus: props.autoFocus,
    isActive: !props.disabled
  });

  return (
    <Box>
      <Box width={10}>
        <Text color={isFocused ? theme.accent : theme.muted}>
          {props.label}
        </Text>
      </Box>
      <TextInput
        focus={isFocused && !props.disabled}
        mask={props.mask}
        onChange={props.onChange}
        onSubmit={() => {
          props.onSubmit();
        }}
        placeholder={props.placeholder}
        showCursor={isFocused && !props.disabled}
        value={props.value}
      />
    </Box>
  );
}

function ModeRow(props: {
  disabled?: boolean;
  mode: LoginMode;
  onToggle: () => void;
}) {
  const { isFocused } = useFocus({ isActive: !props.disabled });

  useInput(
    (input, key) => {
      if (key.return || input === " ") {
        props.onToggle();
      }
    },
    { isActive: isFocused && !props.disabled }
  );

  return (
    <Box>
      <Box width={10}>
        <Text color={isFocused ? theme.accent : theme.muted}>Mode</Text>
      </Box>
      <Text color={isFocused ? theme.ink : theme.muted}>
        {props.mode === "signup" ? "signup" : "login"}
        {isFocused ? "  Enter to switch" : ""}
      </Text>
    </Box>
  );
}

export function LoginScreen(props: {
  api: PeriscanApi;
  onStatus: (s: string) => void;
}) {
  const { api, onStatus } = props;
  const [mode, setMode] = useState<LoginMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenant, setTenant] = useState("");
  const [busy, setBusy] = useState(false);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
    };
  }, []);

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
          autoFocus
          disabled={busy}
          label="Email"
          onChange={setEmail}
          onSubmit={() => {
            void submit();
          }}
          placeholder="work email"
          value={email}
        />
        <Field
          disabled={busy}
          label="Password"
          mask="*"
          onChange={setPassword}
          onSubmit={() => {
            void submit();
          }}
          placeholder="password"
          value={password}
        />
        {mode === "signup" ? (
          <Field
            disabled={busy}
            label="Tenant"
            onChange={setTenant}
            onSubmit={() => {
              void submit();
            }}
            placeholder="organization"
            value={tenant}
          />
        ) : null}
        <ModeRow
          disabled={busy}
          mode={mode}
          onToggle={() => {
            setMode((current) => (current === "login" ? "signup" : "login"));
          }}
        />
      </Box>
      <Box marginTop={1}>
        <Text color={theme.muted}>
          Tab next · Enter submit · Tab to Mode then Enter to switch
        </Text>
      </Box>
    </Box>
  );
}
