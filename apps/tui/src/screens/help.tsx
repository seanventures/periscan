import React from "react";
import { Box, Text } from "ink";

import { DEFAULT_API_URL } from "../lib/session.js";
import { SCREEN_ORDER, screenLabel } from "../nav.js";
import { theme } from "../theme.js";

const PROOF_LOOP_STAGES = [
  "Authorize",
  "Run",
  "Evidence",
  "Fixed-only-via-verify"
] as const;

export function HelpScreen() {
  const jumpKeys = SCREEN_ORDER.map(
    (id, index) => `${index + 1} ${screenLabel(id)}`
  ).join(" · ");

  return (
    <Box flexDirection="column">
      <Text bold>Help</Text>

      <Text bold color={theme.accent}>
        Keys
      </Text>
      <Text>q quit · ? this help</Text>
      <Text color={theme.muted}>{jumpKeys}</Text>

      <Box marginTop={1} flexDirection="column">
        <Text bold color={theme.accent}>
          Proof loop
        </Text>
        <Text>{PROOF_LOOP_STAGES.join(" → ")}</Text>
        <Text color={theme.muted}>
          2 auth · 3 scopes · 4 run Community. Denied tasks never queued.
        </Text>
        <Text color={theme.muted}>
          Fixed only after a measured verification event.
        </Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold color={theme.warn}>
          SETTLED safety
        </Text>
        <Text color={theme.muted}>
          Live Atomic, Caldera, SharpHound, ransomware, and exploit chaining
          stay off.
        </Text>
        <Text color={theme.muted}>
          Validate only verified authorized scope. Path words follow weakest-hop
          evidence.
        </Text>
        <Text color={theme.muted}>
          Not full BAS. Not a certification or audit opinion.
        </Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold color={theme.accent}>
          License
        </Text>
        <Text color={theme.muted}>
          Product source is Apache-2.0 (Community edition).
        </Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold color={theme.accent}>
          API
        </Text>
        <Text color={theme.muted}>
          {`PERISCAN_API_URL points at the control plane (default ${DEFAULT_API_URL}).`}
        </Text>
      </Box>
    </Box>
  );
}
