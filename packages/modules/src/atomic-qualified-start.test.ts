import { describe, expect, it } from "vitest";

import { getModuleById } from "./index.js";
import {
  ATOMIC_DATE_LAB,
  ATOMIC_ENV_LAB,
  ATOMIC_HOSTNAME_LAB
} from "./bas-local-lab.js";
import {
  listAtomicQualifiedStartArgv,
  planAtomicQualifiedCampaignQueue,
  resolveAtomicQualifiedStartArgv
} from "./atomic-qualified-start.js";

const HOSTNAME_PIN = {
  provider: "AtomicRedTeam",
  upstreamId: ATOMIC_HOSTNAME_LAB.scenarioId
};
const ENV_PIN = {
  provider: "AtomicRedTeam",
  upstreamId: ATOMIC_ENV_LAB.scenarioId
};
const DATE_PIN = {
  provider: "AtomicRedTeam",
  upstreamId: ATOMIC_DATE_LAB.scenarioId
};

describe("Atomic qualified start argv allowlist", () => {
  it("allowlists reviewed Linux binaries only, including /bin/ps only if a plan exists", () => {
    const argv = listAtomicQualifiedStartArgv();
    expect(argv).toEqual(
      expect.arrayContaining(["/bin/hostname", "/bin/env", "/bin/date"])
    );
    expect(argv.every((item) => item.startsWith("/bin/"))).toBe(true);
    expect(argv).not.toContain("sh");
    expect(argv).not.toContain("/bin/bash");
    if (!argv.includes("/bin/ps")) {
      expect(
        resolveAtomicQualifiedStartArgv("atomic:not-a-ps-plan").allowlisted
      ).toBe(false);
    }
  });

  it("resolves hostname, env, and date pins to argv and never YAML command text", () => {
    expect(
      resolveAtomicQualifiedStartArgv(ATOMIC_HOSTNAME_LAB.scenarioId)
    ).toEqual(
      expect.objectContaining({
        allowlisted: true,
        argv: ["/bin/hostname"]
      })
    );
    expect(
      resolveAtomicQualifiedStartArgv("fcbdd43f-f4ad-42d5-98f3-0218097e2720")
    ).toEqual(
      expect.objectContaining({
        allowlisted: true,
        argv: ["/bin/env"]
      })
    );
    expect(resolveAtomicQualifiedStartArgv(ATOMIC_DATE_LAB.scenarioId)).toEqual(
      expect.objectContaining({
        allowlisted: true,
        argv: ["/bin/date"]
      })
    );
  });

  it("fails closed for catalog dry-run, Windows net time, and shell-script GUIDs", () => {
    for (const guid of [
      "8d0d1e2b-5e3f-4c22-8d1b-000000001087",
      "20aba24b-e61f-4b26-b4ce-4784f763ca20",
      "034fe21c-3186-49dd-8d5d-128b35f181c7",
      "cccb070c-df86-4216-a5bc-9fb60c74e27c",
      "atomic.live"
    ]) {
      const resolved = resolveAtomicQualifiedStartArgv(guid);
      expect(resolved.allowlisted).toBe(false);
      if (!resolved.allowlisted) {
        expect(resolved.reason).toMatch(
          /never eval|argv|allowlist|not a lab execution adapter/i
        );
      }
    }
  });
});

describe("planAtomicQualifiedCampaignQueue", () => {
  it("returns jobsQueued=0 when startable is false even for allowlisted pins", () => {
    const planned = planAtomicQualifiedCampaignQueue({
      pins: [HOSTNAME_PIN, ENV_PIN, DATE_PIN],
      qualificationTablesPresent: true,
      startable: false
    });
    expect(planned).toMatchObject({
      jobsQueued: 0,
      queued: false,
      yamlEval: false
    });
    expect(planned.argvTasks).toEqual([]);
    expect(planned.denyReason).toMatch(/never queued/i);
  });

  it("returns jobsQueued=0 when qualification tables are missing", () => {
    const planned = planAtomicQualifiedCampaignQueue({
      pins: [HOSTNAME_PIN],
      qualificationTablesPresent: false,
      startable: true
    });
    expect(planned.jobsQueued).toBe(0);
    expect(planned.queued).toBe(false);
    expect(planned.denyReason).toMatch(/qualification/i);
    expect(planned.denyReason).toMatch(/never queued/i);
  });

  it("queues one argv task per allowlisted pin when startable and qualification is present", () => {
    const planned = planAtomicQualifiedCampaignQueue({
      pins: [HOSTNAME_PIN, ENV_PIN, DATE_PIN],
      qualificationTablesPresent: true,
      startable: true
    });
    expect(planned.queued).toBe(true);
    expect(planned.jobsQueued).toBeGreaterThanOrEqual(1);
    expect(planned.jobsQueued).toBe(3);
    expect(planned.denyReason).toBeNull();
    expect(planned.yamlEval).toBe(false);
    expect(planned.argvTasks.map((task) => task.argv[0]).sort()).toEqual([
      "/bin/date",
      "/bin/env",
      "/bin/hostname"
    ]);
    expect(planned.argvTasks.every((task) => task.argv.length === 1)).toBe(
      true
    );
  });

  it("fails closed for a mix of allowlisted argv and YAML-eval pins", () => {
    const planned = planAtomicQualifiedCampaignQueue({
      pins: [
        HOSTNAME_PIN,
        {
          provider: "AtomicRedTeam",
          upstreamId: "cccb070c-df86-4216-a5bc-9fb60c74e27c"
        }
      ],
      qualificationTablesPresent: true,
      startable: true
    });
    expect(planned.jobsQueued).toBe(0);
    expect(planned.queued).toBe(false);
    expect(planned.argvTasks).toEqual([]);
    expect(planned.denyReason).toMatch(/never eval|argv/i);
  });

  it("does not treat ControlPlane atomic.live as queueable argv", () => {
    const planned = planAtomicQualifiedCampaignQueue({
      pins: [{ provider: "ControlPlane", upstreamId: "atomic.live" }],
      qualificationTablesPresent: true,
      startable: true
    });
    expect(planned.jobsQueued).toBe(0);
    expect(planned.queued).toBe(false);
  });
});

describe("Atomic production module stays dark", () => {
  it("does not globally set liveSupported true", () => {
    expect(
      getModuleById("atomic.control_validation_safe")?.manifest.liveSupported
    ).toBe(false);
    expect(process.env.PERISCAN_LIVE_OFFENSIVE).not.toBe("1");
  });
});
