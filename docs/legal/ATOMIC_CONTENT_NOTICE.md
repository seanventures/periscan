# Atomic Red Team content notice

The qualification fixtures under `packages/modules/src/fixtures/atomic/` are
unchanged copies from Red Canary Atomic Red Team at commit
`11ff111ace63e02825dd44ce8246800203a10ce8`.

- T1082 source: https://github.com/redcanaryco/atomic-red-team/blob/11ff111ace63e02825dd44ce8246800203a10ce8/atomics/T1082/T1082.yaml
  SHA-256: `6cfdcdd8d114195f788bf719baecda1a95363d904316a156c8f44e45e71e9f29`
- T1124 source: https://github.com/redcanaryco/atomic-red-team/blob/11ff111ace63e02825dd44ce8246800203a10ce8/atomics/T1124/T1124.yaml
  SHA-256: `68391c9deff4ac6f43683bf4a5d5fa149764de3ce04f41957ea5afb36f7868aa`
- Upstream license: MIT; original notice retained next to the fixtures in `LICENSE.txt`.
- The local lab harness allowlists three Linux-safe argv tests:
  Hostname Discovery GUID `486e88ea-4f56-470f-9b57-3f4d73f39133` (`/bin/hostname`),
  environment-variable discovery GUID `fcbdd43f-f4ad-42d5-98f3-0218097e2720`
  (`/bin/env`), and System Time Discovery GUID
  `f449c933-0891-407f-821e-7916a21a1a6f` (`/bin/date`). Remaining definitions
  are source integrity data and fail closed; they are not executable harness
  inputs.

The harness invokes those reviewed native binaries directly without a shell. It
does not install or invoke Invoke-AtomicRedTeam. The independently pulled
BusyBox image retains its upstream licensing; it is not bundled into Periscan
by this change. Customer live Atomic execution remains disabled.
