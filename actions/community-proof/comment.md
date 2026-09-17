<!-- periscan-community-proof -->
## Periscan Community proof

Community edition is the open-core **validation slice** on an authorized
scope. This comment is a Validation Snapshot proof card. It is **not** a
LICENSE flip.

### {{outcome_heading}}

{{outcome_body}}

| Field | Value |
| --- | --- |
| Scope | `{{scope_id}}` ({{scope_type}}) |
| Mission | `{{mission_id}}` (`{{mission_status}}`) |
| Policy decision | `{{policy_decision_id}}` |
| Jobs queued | {{jobs_queued}} |
| Engines | {{engine_list}} |
| Finding count | {{finding_count}} |
| validationState | {{validation_state_counts}} |
| Evidence IDs | {{evidence_ids}} |

**Policy:** denied tasks are never queued.

Nuclei, when it applies, is a **second mission** and may skip: {{nuclei_note}}

Findings are those whose evidence intersects this mission
(`GET /api/v1/findings?missionId=`). Empty findings: empty list, not theater.
**Fixed** still requires a verification event.
