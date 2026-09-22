# SOC 2: vendor Type II vs customer support pack

**Audience:** CISO, procurement, and auditors evaluating Periscan claims.  
**Honesty bar:** no invented auditor, logo, bridge letter, or Type II PDF.

---

## Short answer

**Are you SOC 2 certified?** **No.**

Periscan does **not** currently publish a vendor SOC 2 Type II report.
Trust & Safety defaults `vendorAssurance.soc2TypeIiStatus` to **`None`**.
Enterprise commercial honesty keeps vendor SOC 2 attestation **`NotClaimed`**.
Do not treat product UI, screenshots, or evidence packs as Periscan’s vendor
attestation.

Community **can** emit a **customer SOC 2 support evidence pack** that maps
*your* measured Periscan validation evidence to a partial Trust Services Criteria
(TSC) catalog for **your** auditor’s follow-up. That pack is **not**
certification, **not** an audit opinion, and **not** a vendor Type II report.

Details and labels live in `packages/reports` (`SOC2Support` /
`SOC2Attestation` storage keys) and
[`trust/VENDOR_COMPLIANCE.md`](./trust/VENDOR_COMPLIANCE.md).

---

## Two different surfaces (do not conflate)

| Surface | What it is | What it is not |
| --- | --- | --- |
| **Vendor SOC 2 Type I / II** | Independent CPA attestation about Periscan as a service organization: policies, period of performance, evidence collection, and an auditor’s opinion | Something shipping code or a Community pack can finish |
| **Customer SOC 2 support evidence** | Product pack linking measured customer validation evidence to a **partial** TSC catalog for auditor follow-up | Periscan vendor certification / Type II / bridge letter |

GTM rule: never answer “Do you have SOC 2?” with only a screenshot of the
customer support pack.

---

## Why Type I / II is not a code ship

A SOC 2 Type I or Type II engagement requires:

- An **independent CPA** (or equivalent licensed auditor)
- Documented **policies and procedures** for the trust services in scope
- A defined **period of performance** (Type II) or point-in-time system
  description (Type I)
- Management assertions and auditor fieldwork

**Shipping product code cannot complete that.** Until a real program publishes
a report under NDA or publicly, status stays **`None` / `NotClaimed`**. Env
override `PERISCAN_VENDOR_SOC2_STATUS` may be `InProgress` or `ReportUnderNda`
only when those states are true — invalid values fail soft to `None`.

---

## Customer support pack (Community)

After measured validation on **authorized** scope, operators can generate the
**Customer SOC 2 support evidence** pack from the reports workbench
(`SOC2Support`). The pack:

- Links measured evidence IDs to a **partial** TSC mapping
- States it is **not certification / not an audit opinion**
- Is meant for **customer auditor follow-up**, not vendor RFP theater

Catalog depth expands only when measured mappings exist. Isolation proof and
questionnaire kit remain separate:
[`trust/README.md`](./trust/README.md),
[`PRODUCTION_READINESS.md`](./PRODUCTION_READINESS.md).

First-hour Community setup (local clone, Gitleaks-class secrets):
[`SETUP.md`](./SETUP.md). Community vs commercial boundary:
[`ENTERPRISE.md`](./ENTERPRISE.md).

---

## Vulnerability intake (not a SOC channel)

Product or dependency vulnerabilities: open a **title-only** GitHub issue with
the **`[SECURITY]`** prefix. No public PoC. No invented mailbox.

[`SECURITY.md`](../SECURITY.md)

---

## FAQ

### Are you SOC 2 certified?

**No.** Periscan does not currently publish a vendor SOC 2 Type II report
(`soc2TypeIiStatus` **None** / vendor attestation **NotClaimed**). Use the
**customer SOC 2 support evidence pack** for auditor follow-up on *your*
measured controls — see this page and
[`trust/VENDOR_COMPLIANCE.md`](./trust/VENDOR_COMPLIANCE.md).

---

## Related

| Want | File |
| --- | --- |
| Community vs commercial | [`ENTERPRISE.md`](./ENTERPRISE.md) |
| Local / self-host setup | [`SETUP.md`](./SETUP.md) |
| Vuln intake (`[SECURITY]`) | [`SECURITY.md`](../SECURITY.md) |
| Vendor assurance status | [`trust/VENDOR_COMPLIANCE.md`](./trust/VENDOR_COMPLIANCE.md) |
| Questionnaire kit | [`trust/README.md`](./trust/README.md) |
| Settled axioms | [`SETTLED.md`](./SETTLED.md) |
