-- Audit action for MCP tool invocations (a customer AI client calling a
-- read-only Periscan tool over the Model Context Protocol). Own migration so
-- the enum value is committed before any code references it.
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'mcp_tool_invoked';
