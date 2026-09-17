-- Add audit action for non-executing third-party tool implementation bundle exports.
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'third_party_tool_implementation_bundle_generated';
