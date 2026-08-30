# E2E feature completion swarm — 2026-07-31

Six parallel swarms closed **shippable end-to-end product paths** with acceptance tests. Safety floors held.

## Commits (main)

| Swarm | Commit | Focus |
|-------|--------|-------|
| S2 | `900c7263` + `2a22d8e2` | DRV marker + DNS canary + SCV observe + inject disabled |
| S3 | `32e0e443` | Compliance catalog expand + evidence-support E2E (not cert) |
| S5 | `1c84400f` | ASV/EASM discover path + connector Production gate E2E |
| S4 | `d72ce3c0` | SSO SAML/OIDC + force-MFA + SCIM honesty 501 E2E |
| S6 | `c4663872` | Webhooks lifecycle, ITSM≠Fixed, runner lease, CV schedules, MSSP isolation |
| S1 | (this commit family) | Multi-hop FullyMeasured + FFV closed loop + auto-apply UI |

## Fully working E2E journeys (acceptance-backed)

1. Multi-hop measure every hop → FullyMeasured → claim-safe report export  
2. Find-Fix-Verify: ticket never Fixed; verify → Fixed only with measured revalidation  
3. DRV detection-marker-proof (benign_marker_only)  
4. DNS-exfil canary (no real exfil; measured:false without live telemetry)  
5. Control observe pull-path; live inject hard-disabled  
6. Compliance snapshot → Met/Partial/Unmet → govern → export disclaimer  
7. SSO OIDC + SAML provisioned member; SCIM NotConfigured consistent 501  
8. ASV discover from verified scope → Heuristic/Measured honesty  
9. DO fix-verify CSV path (existing) + Production qual gate fail-closed  
10. Webhooks HMAC rotate/redrive; runner lease complete; CV schedule priorDiffs; MSSP client isolation  

## Still incomplete by design / external

| Residual | Why |
|----------|-----|
| Live lab multi-hop on real range | Needs enrolled in-network runner + range (not mock only) |
| Production connectors | Live partner keys + smoke receipts (0 Production) |
| Public customer refs | GTM |
| Inbound SCIM live | NotConfigured honesty complete; full IdP SCIM not enabled |
| Wave D inject | SOW-gated default off |
| Marketplace payments live | NotConfigured |
| Full BAS / Atomic-Caldera / ransomware | Safety refuse |
| Analyst score 95 | Blind rescore + partner mass |

## Safety held
No Fixed without verify · no live inject · no invented refs/Production certs · no certification theater.
