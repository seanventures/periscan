-- Add the mfa_activated audit action (MFA increment 2: verify + activate).
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'mfa_activated';
