-- Provider-agnostic subscription assignment: the BillingPackage key per tenant
-- (resolved against the catalog for entitlement checks). Additive + nullable
-- with an entry-tier default, so existing tenants get a real package and image
-- rollback is forward-safe.
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "billing_package_key" text DEFAULT 'ValidationSnapshot';
