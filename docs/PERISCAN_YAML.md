# Community-as-code (`.periscan.yaml`)

GitHub users can copy [`.periscan.example.yaml`](../.periscan.example.yaml) to
`.periscan.yaml` in a project they **own** to declare Community pack intent in
reviewable form.

Product source is Apache-2.0. It is not full BAS.

## Runtime still uses the API and policy

The control plane **does not load** `.periscan.yaml` or
`.periscan.example.yaml`. Starts still go through:

```text
verified scope
  → POST /api/v1/community/validation-runs
  → policy decision (Denied never queues)
  → Community engines
  → evidence
```

YAML cannot:

- Replace Domain DNS TXT, repository `.periscan-authorization`, Connected AWS
  match, or Owner/Admin CIDR attestation
- Queue work the policy engine would deny
- Enable Atomic, Caldera, SharpHound, sqlmap, Metasploit, or live ransomware
- Mark a finding **Fixed** (Fixed still requires a verification event)

A parser in `packages/shared/src/community-as-code.ts` validates the document
shape. It does **not** start missions. It accepts the committed example's
block-style YAML (comments, nested maps, booleans) — not full YAML 1.2.
Wiring the overlay into the control plane is a later change and needs its
own tests.

Copy the example; do not commit secrets. Gitignore local `.periscan.yaml`.

## Required intent

| Field                           | Community value                                         |
| ------------------------------- | ------------------------------------------------------- |
| `pack`                          | `community`                                             |
| `safety.ceiling`                | `ActiveNonInvasive` (or the stricter `PassiveReadOnly`) |
| `safety.require_verified_scope` | `true`                                                  |
| `nuclei.second_mission`         | `true` (keep Nuclei out of the primary start set)       |
| `engines.atomic`                | `false`                                                 |

`pack: atomic` and any safety ceiling above `ActiveNonInvasive` (`BASLite`,
`AdvancedAdversarial`, …) fail closed.

## Related

- Offering: [`COMMUNITY.md`](../COMMUNITY.md)
- Contract: `packages/shared/src/community-edition.ts`
- Auth file for repositories: `.periscan-authorization` (not this YAML)
