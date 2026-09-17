# Security policy

## Reporting a vulnerability

If you believe you have found a security issue in Periscan (control plane, web,
runner, policy gates, or dependency supply chain):

1. **Do not** post exploit details, payloads, credentials, or a public PoC.
2. Open a **title-only** GitHub issue on
   [seanventures/periscan](https://github.com/seanventures/periscan/issues/new?template=security.yml)
   with the `[SECURITY]` title prefix (use the Security issue template). Keep the
   public body free of PoCs — maintainers will follow up privately.
3. In the private follow-up, include: affected component/version, reproduction
   against **your own** lab or written-authorized systems only, impact, and any
   suggested fix.
4. **Do not** attach live exploit PoCs, ransomware, credential dumps, or
   weaponized payloads.

This project does **not** use GitHub private vulnerability reporting (PVR) or
GitHub Actions as intake. There is no public `security@` mailbox — do not guess
one. Title-only `[SECURITY]` issues are the intake path (SETTLED).

**Coordinated disclosure:** we aim to acknowledge a `[SECURITY]` issue within
**72 hours** and to ship a fix or disclose within **90 days**, unless we agree
a longer embargo (for example a coordinated CVE).

## Product boundaries

Periscan only validates **customer-authorized, verified scope**. See
[`SECURITY_BOUNDARIES.md`](./SECURITY_BOUNDARIES.md) and
[`docs/SETTLED.md`](./docs/SETTLED.md) for the full floor:

- No destructive tests, real data exfiltration, credential theft, or persistence
- Denied tasks must never be queued
- **Fixed** requires a verification event
- Live Atomic / Caldera / SharpHound and similar offensive live packs stay off
  unless a separate legal/safety program is approved

A vulnerability report does not waive those rules.

## Scope of reports we accept

| In scope | Out of scope |
|----------|--------------|
| Authn/z bypass, tenant isolation breaks | Scanning third-party hosts without authorization |
| Policy/audit bypass (denied tasks queued) | Social engineering of customers |
| Runner task signing / result provenance flaws | DoS against public infra you do not operate |
| Fixed-without-verify paths | Purely theoretical issues without repro |
| Dependency CVEs in shipped default images | Issues only in Blocked/legal-review opt-in tools |

## Safe research

Use the local lab (`pnpm lab:up`, `pnpm lab:dev`) and verified lab scopes only.
Do not use Periscan to probe systems you do not own or lack written
authorization to test. Do not ask maintainers to enable live Atomic, Caldera,
SharpHound, or other SETTLED-off capabilities as part of a disclosure.
