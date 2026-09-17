# Periscan Terraform Boundary

This directory is the Terraform entrypoint for production infrastructure work.
The current repository ships deployable Docker images and local Compose
dependencies, but it does not encode a vendor-specific production topology until
a customer environment is selected.

Required production inputs before adding provider modules:

- PostgreSQL with backups and migration access.
- Redis compatible with BullMQ.
- S3-compatible object storage for evidence artifacts.
- API, worker, web, runner-agent, and optional runner image locations.
- Secret management for session, JWT, integration, evidence-storage, and queue
  credentials.
- Network policy for outbound-only runner communication.

Do not add fake provider resources or sample customer infrastructure here. Any
future provider module must be tested, documented, and wired to deployment
validation before it is presented as production-ready.
