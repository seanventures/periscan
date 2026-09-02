import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { Box, Text, useInput } from "ink";
import {
  communityScopeAuthorizationHint,
  communityScopeVerificationKind,
  defaultAssetClassForCommunityScope,
  type Scope
} from "@periscan/shared";

import type { PeriscanApi } from "../lib/api.js";
import { theme } from "../theme.js";

const CREATE_TYPES = [
  { label: "Domain", scopeType: "Domain" },
  { label: "Repository", scopeType: "Repository" },
  { label: "CloudAccount", scopeType: "CloudAccount" },
  { label: "CIDR", scopeType: "IPRange" }
] as const;

const CREATE_TYPE_KEYS: Record<string, number> = {
  d: 0,
  r: 1,
  c: 2,
  i: 3
};

type CreateType = (typeof CREATE_TYPES)[number];

function isLabMode(): boolean {
  return process.env.PERISCAN_LAB_MODE === "1";
}

function formatScopeType(scopeType: string): string {
  return scopeType === "IPRange" ? "CIDR" : scopeType;
}

function createTypeAt(index: number): CreateType {
  const length = CREATE_TYPES.length;
  const normalized = ((index % length) + length) % length;
  return CREATE_TYPES[normalized] ?? CREATE_TYPES[0]!;
}

function placeholderFor(scopeType: CreateType["scopeType"]): string {
  switch (scopeType) {
    case "IPRange":
      return "10.0.0.0/24";
    case "Repository":
      return "/opt/customer/repo";
    case "CloudAccount":
      return "123456789012";
    default:
      return "app.example.com";
  }
}

function errorMessage(caught: unknown, fallback: string): string {
  return caught instanceof Error ? caught.message : fallback;
}

export function ScopesScreen(props: {
  api: PeriscanApi;
  onStatus: (s: string) => void;
}) {
  const { api, onStatus } = props;
  const labMode = isLabMode();
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"list" | "create">("list");
  const [createIndex, setCreateIndex] = useState(0);
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createType = createTypeAt(createIndex);
  const selected =
    scopes.find((item) => item.scopeId === selectedId) ?? scopes[0] ?? null;

  const modeRef = useRef(mode);
  const valueRef = useRef(value);
  const createIndexRef = useRef(createIndex);
  const busyRef = useRef(busy);
  const selectedRef = useRef(selected);
  const labModeRef = useRef(labMode);
  const scopesRef = useRef(scopes);
  const selectedIdRef = useRef(selectedId);
  modeRef.current = mode;
  valueRef.current = value;
  createIndexRef.current = createIndex;
  busyRef.current = busy;
  selectedRef.current = selected;
  labModeRef.current = labMode;
  scopesRef.current = scopes;
  selectedIdRef.current = selectedId;

  const upsert = useCallback((next: Scope) => {
    setScopes((current) => {
      const exists = current.some((item) => item.scopeId === next.scopeId);
      if (!exists) {
        return [...current, next];
      }
      return current.map((item) =>
        item.scopeId === next.scopeId ? next : item
      );
    });
    setSelectedId(next.scopeId);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const items = await api.listScopes();
      setScopes(items);
      setError(null);
      setSelectedId((current) => {
        if (current && items.some((item) => item.scopeId === current)) {
          return current;
        }
        return items[0]?.scopeId ?? null;
      });
    } catch (caught) {
      setError(errorMessage(caught, "Unable to read scopes"));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (mode === "create") {
      onStatus("d/r/c/i type · enter create · esc cancel");
      return;
    }
    onStatus(
      labMode
        ? "n new · v verify DNS TXT · m lab only · ↑↓ select"
        : "n new · v verify DNS TXT · ↑↓ select"
    );
  }, [labMode, mode, onStatus]);

  const moveSelection = useCallback((delta: number) => {
    const rows = scopesRef.current;
    if (rows.length === 0) {
      return;
    }
    const currentIndex = Math.max(
      0,
      rows.findIndex((item) => item.scopeId === selectedIdRef.current)
    );
    const next = rows[currentIndex + delta];
    if (next) {
      setSelectedId(next.scopeId);
    }
  }, []);

  const submitCreate = useCallback(async () => {
    const trimmed = valueRef.current.trim();
    if (!trimmed || busyRef.current) {
      return;
    }
    const nextType = createTypeAt(createIndexRef.current);
    setBusy(true);
    setError(null);
    try {
      const created = await api.createScope({
        assetClass: defaultAssetClassForCommunityScope(nextType.scopeType),
        scopeType: nextType.scopeType,
        value: trimmed
      });
      upsert(created);
      setValue("");
      setCreateIndex(0);
      setMode("list");
    } catch (caught) {
      setError(errorMessage(caught, "Unable to create scope"));
    } finally {
      setBusy(false);
    }
  }, [api, upsert]);

  const verifySelected = useCallback(
    async (devModeManual: boolean) => {
      const current = selectedRef.current;
      if (!current || busyRef.current) {
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const verified = await api.verifyScope(
          current.scopeId,
          devModeManual ? { devModeManual: true } : {}
        );
        upsert(verified);
      } catch (caught) {
        setError(errorMessage(caught, "Unable to verify scope"));
      } finally {
        setBusy(false);
      }
    },
    [api, upsert]
  );

  useInput((input, key) => {
    if (modeRef.current === "create") {
      if (key.escape) {
        setMode("list");
        setValue("");
        setCreateIndex(0);
        return;
      }
      if (key.tab || input === "\t") {
        setCreateIndex((current) => current + (key.shift ? -1 : 1));
        return;
      }
      if (key.return || input === "\r" || input === "\n") {
        void submitCreate();
        return;
      }
      if (key.backspace || key.delete) {
        setValue((current) => current.slice(0, -1));
        return;
      }
      const typeIndex = CREATE_TYPE_KEYS[input];
      if (valueRef.current.length === 0 && typeIndex !== undefined) {
        setCreateIndex(typeIndex);
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setValue((current) => current + input);
      }
      return;
    }

    if (input === "n") {
      setMode("create");
      setValue("");
      setCreateIndex(0);
      setError(null);
      return;
    }
    if (input === "v") {
      void verifySelected(false);
      return;
    }
    if (input === "m" && labModeRef.current) {
      void verifySelected(true);
      return;
    }
    if (key.upArrow || input === "k") {
      moveSelection(-1);
      return;
    }
    if (key.downArrow || input === "j") {
      moveSelection(1);
    }
  });

  const verifyHint = useMemo(() => {
    if (!selected) {
      return "Verify via DNS TXT.";
    }
    const kind = communityScopeVerificationKind(selected.scopeType);
    const hint = communityScopeAuthorizationHint(selected.scopeType);
    if (
      kind === "dns_txt" &&
      selected.verificationStatus !== "Verified" &&
      selected.verificationToken
    ) {
      return `${hint} Token ${selected.verificationToken} → DNS TXT _periscan.`;
    }
    return hint;
  }, [selected]);

  return (
    <Box flexDirection="column">
      <Text bold>Scopes</Text>
      <Text color={theme.muted}>Verify via DNS TXT.</Text>
      {labMode ? (
        <Text color={theme.warn}>m lab only (devModeManual)</Text>
      ) : null}
      {error ? <Text color={theme.danger}>{error}</Text> : null}
      {loading ? <Text color={theme.muted}>Loading scopes…</Text> : null}
      {mode === "create" ? (
        <Box flexDirection="column" marginTop={1}>
          <Text>
            New scope · Type:{" "}
            <Text color={theme.accent} bold>
              {createType.label}
            </Text>
          </Text>
          <Text>
            Value:{" "}
            {value.length > 0 ? (
              value
            ) : (
              <Text color={theme.muted}>
                {placeholderFor(createType.scopeType)}
              </Text>
            )}
          </Text>
        </Box>
      ) : null}
      {!loading && scopes.length === 0 && mode === "list" ? (
        <Text color={theme.muted}>No authorized scopes yet</Text>
      ) : null}
      {scopes.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          {scopes.map((item) => {
            const active = item.scopeId === (selected?.scopeId ?? null);
            return (
              <Text
                key={item.scopeId}
                color={active ? theme.accent : undefined}
              >
                {active ? "> " : "  "}
                {item.value} {formatScopeType(item.scopeType)}{" "}
                {item.verificationStatus}
              </Text>
            );
          })}
        </Box>
      ) : null}
      {selected && mode === "list" ? (
        <Text color={theme.muted}>{verifyHint}</Text>
      ) : null}
    </Box>
  );
}
