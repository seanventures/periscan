# BAS execution authorization

Product development follows [BAS_AEV_PROGRAM.md](../BAS_AEV_PROGRAM.md).
Customer execution requires an authorization record bound to the exact plan.

Record the tenant and authorizing owner, verified target scope/version, runner
or private engine deployment, selected adapter/content pins, scenario IDs,
input digest, required privilege, maintenance window and expiry. Record the
policy decision and any required approvers. Reauthorize material changes.

The execution plan must define resource/rate limits, timeout, stop conditions,
cleanup and cleanup verification, telemetry sources and observation window,
evidence retention, and operational contacts. Denied work must never queue.
Cancellation must revoke future dispatch and report actual active-task status.

Use synthetic data and dedicated test identities where required. Exclude
customer-data destruction, credential theft, persistent implants, evasion,
real data exfiltration and uncontrolled chaining. Engine availability does not
make every upstream scenario eligible.

Before launch, verify authorization and adapter readiness again. After launch,
retain signed receipts, control outcomes, cleanup status and audit evidence.
Only measured verification may mark a risk Fixed. A successful import, tool
exit code or signed commercial agreement is not validation evidence.
