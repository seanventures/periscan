-- MFA increment 4: disable/reset audit action.
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'mfa_disabled';
