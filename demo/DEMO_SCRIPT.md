# Periscan Demo Script

Three paths. Pick **one**. Mixing them is how you lie to the room.

| Path | How | Scope | What you get |
| ---- | --- | ----- | ------------ |
| **Fixture** | `pnpm seed:demo` | `demo.example.com` | Labeled seed. Not measured. |
| **Lab hops** | `pnpm lab:demo-up` | `*.lab.range.test` | Hop receipts + mocksiem. **Not** Community pack. |
| **Community** | `POST /api/v1/community/validation-runs` | A **verified** authorized scope | Permissive OSS pack + evidence. **Not** a LICENSE flip. |

Floors: root `LICENSE` stays proprietary. Not full BAS. No live Atomic / Caldera / SharpHound / sqlmap / Metasploit. **Fixed** only after a verification event.

Not a case study. No logos, testimonials, or “customer reference.” Companion SE rules: [`docs/competitive/DEMO_AND_SE_RULES.md`](../docs/competitive/DEMO_AND_SE_RULES.md).

---

## Wave spine (7–10 screens)

Stay on Operate. Do **not** open unless asked: `/swarm`, `/workflows`, `/operators`, `/engagements`, `/mcp`, `/model-gateway`, AI-apps / NHI theater, multi-vector BAS library slides.

1. Home — `/dashboard`
2. Connect honesty — `/integrations` (Beta/Planned; never Production/Certified)
3. Authorized scope — `/scopes`
4. Validate — `/missions`
5. Path — `/attack-paths` (Measured vs Heuristic)
6. Finding — `/findings`
7. Retest — `/remediation` (**Fixed** only after re-measure)
8. Evidence — `/evidence` or `/reports` (IDs, no raw scanner dump)
9. *(optional)* Engines — `/engines`
10. *(optional)* Schedule — `/schedules`

> Periscan is the **AEV / CTEM proof layer** on tools you already bought. We
> measure which exposures are real on authorized scope and prove fixes —
> we do **not** replace full multi-vector BAS, CNAPP, or RBVM.

---

## 1. Fixture (`seed:demo`)

```bash
pnpm seed:demo
pnpm dev
```

- Email: `demo@periscan.local`
- Password: `periscan-demo-password`
- Scope: **`demo.example.com`** (seed only — never a lab target)

Say “fixture” out loud. Do not present this as a lab probe or a Community run.

Pre-auth sample: `/demo` — labeled **sample**. Redacted secret → sample role →
sample path → mock SIEM miss → AI fixture → path breakers → evidence pack
without raw scanner output.

---

## 2. Lab hops (`lab:demo-up`) — not Community pack

Hop-measured range. Scopes are **`edge.lab.range.test`**, **`app.lab.range.test`**,
**`data.lab.range.test`**. Never `demo.example.com`.

```bash
# Terminal A — range
pnpm lab:up

# Terminal B — api + worker + web (PERISCAN_LAB_MODE=1)
pnpm lab:dev

# Terminal C
pnpm lab:demo-up
```

Login: email from `infra/lab/.lab-demo.env` (`PERISCAN_LAB_EMAIL`)  
Password: `periscan-lab-password-ok`  
(Not `demo@periscan.local` unless you also ran `seed:demo` — different tenant.)

Walk:

1. `/scopes` — confirm **Verified** `edge.lab.range.test`, `app.lab.range.test`,
   `data.lab.range.test`. If you see `demo.example.com`, you are on the fixture
   tenant. Switch.
2. `/integrations` — Splunk → mocksiem is live; mock GitHub/AWS stay labeled mock.
3. `/missions` — hop missions + control canaries. Do **not** start Community pack
   here; hops are not the Community OSS suite.
4. `/attack-paths` — edge → app → data. Label Measured vs Heuristic.
   `fullyMeasured` needs worker + hop receipts.
5. `/findings` → route to remediation.
6. Harden + re-measure. **Fixed** only after re-test.
7. `/evidence` or `/reports` — evidence IDs.

Guide: [`docs/DEMO_LAB_SITE.md`](../docs/DEMO_LAB_SITE.md).

---

## 3. Community pack (`POST /community/validation-runs`)

Proof layer on a **verified** scope. Not hop receipts from `lab:demo-up`. Not a
public LICENSE flip.

```bash
GET  /api/v1/community/validation-suite?scopeId=
POST /api/v1/community/validation-runs
     {"scopeId":"<uuid>","policyDecisionId":"<uuid>"}
GET  /api/v1/findings?missionId=
POST /api/v1/community/validation-runs/:missionId/remediations
```

UI: Validate → **Run Community validation**. HTTP 200 is not “jobs queued” —
read `jobsQueued` and `mission.status`. Nuclei is a **second mission**. Denied
policy never queues. Engine Lab → Install + enable Community pack (permissive
SPDX). GPL stays Engine Lab + license accept.

Re-run after the fix. **Fixed** only via verification. Ticket close is
`ClosedWithoutEvidence`.

---

## Labs zoo only if asked

If they ask swarm, MCP, model gateway, or autonomous engagement: label
Labs / platform, open only that route, then return to the spine.

Periscan presents validated paths, control verdicts where real, remediations,
fix verification, and evidence IDs — not raw scanner dumps.
