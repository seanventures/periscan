-- Add audit action for non-executing third-party tool candidate batch imports.
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'third_party_tool_candidate_batch_imported';
