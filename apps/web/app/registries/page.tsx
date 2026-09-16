import { Suspense } from "react";

import { ToolGovernanceMarketplace } from "../../src/components/tool-governance-marketplace";

export const metadata = {
  title: "Engines — Periscan"
};

/**
 * P01-5: Legacy `/registries` alias of Engine Lab (`/engines`).
 * Same marketplace surface — RegistryCenter is not mounted here.
 * Product door for operators is Engines on Setup.
 */
export default function RegistriesPage() {
  return (
    <Suspense fallback={null}>
      <ToolGovernanceMarketplace />
    </Suspense>
  );
}
