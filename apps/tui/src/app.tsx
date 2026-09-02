import React, { useMemo, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";

import { PeriscanApi } from "./lib/api.js";
import { EnginesScreen } from "./screens/engines.js";
import { EvidenceScreen } from "./screens/evidence.js";
import { FindingsScreen } from "./screens/findings.js";
import { HealthScreen } from "./screens/health.js";
import { HelpScreen } from "./screens/help.js";
import { HomeScreen } from "./screens/home.js";
import { LoginScreen } from "./screens/login.js";
import { MissionsScreen } from "./screens/missions.js";
import { RemediationsScreen } from "./screens/remediations.js";
import { ScopesScreen } from "./screens/scopes.js";
import { ValidateScreen } from "./screens/validate.js";
import { theme } from "./theme.js";
import type { ScreenId } from "./nav.js";
import { SCREEN_ORDER, screenLabel } from "./nav.js";

export function TuiApp(props: { apiUrl: string }) {
  const { exit } = useApp();
  const api = useMemo(() => new PeriscanApi(props.apiUrl), [props.apiUrl]);
  const [screen, setScreen] = useState<ScreenId>("home");
  const [status, setStatus] = useState("q quit · ? help · 1–9 screens");

  const typing =
    screen === "login" ||
    screen === "scopes" ||
    screen === "validate" ||
    screen === "remediations";

  useInput((input, key) => {
    if (typing && !key.ctrl && !key.meta) {
      return;
    }
    if (input === "q" && !key.ctrl) {
      exit();
    }
    if (input === "?") {
      setScreen("help");
    }
    if (input === "e") {
      setScreen("evidence");
    }
    const idx = Number.parseInt(input, 10);
    if (idx >= 1 && idx <= 9) {
      setScreen(SCREEN_ORDER[idx - 1] ?? "home");
    }
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box>
        <Text color={theme.accent} bold>
          PERISCAN
        </Text>
        <Text color={theme.muted}> operator TUI · {props.apiUrl}</Text>
      </Box>
      <Box>
        <Text color={theme.muted}>
          {SCREEN_ORDER.map((id, i) =>
            id === screen
              ? `[${i + 1}:${screenLabel(id)}]`
              : ` ${i + 1}:${screenLabel(id)}`
          ).join(" ")}
        </Text>
      </Box>
      <Box flexGrow={1} flexDirection="column" marginTop={1}>
        {screen === "home" ? (
          <HomeScreen api={api} onStatus={setStatus} go={setScreen} />
        ) : null}
        {screen === "login" ? (
          <LoginScreen api={api} onStatus={setStatus} />
        ) : null}
        {screen === "scopes" ? (
          <ScopesScreen api={api} onStatus={setStatus} />
        ) : null}
        {screen === "validate" ? (
          <ValidateScreen api={api} onStatus={setStatus} />
        ) : null}
        {screen === "missions" ? (
          <MissionsScreen api={api} onStatus={setStatus} />
        ) : null}
        {screen === "findings" ? (
          <FindingsScreen api={api} onStatus={setStatus} />
        ) : null}
        {screen === "remediations" ? (
          <RemediationsScreen api={api} onStatus={setStatus} />
        ) : null}
        {screen === "engines" ? (
          <EnginesScreen api={api} onStatus={setStatus} />
        ) : null}
        {screen === "evidence" ? (
          <EvidenceScreen api={api} onStatus={setStatus} />
        ) : null}
        {screen === "health" ? (
          <HealthScreen api={api} onStatus={setStatus} />
        ) : null}
        {screen === "help" ? <HelpScreen /> : null}
      </Box>
      <Box>
        <Text color={theme.muted}>{status}</Text>
      </Box>
    </Box>
  );
}
