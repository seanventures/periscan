import { Suspense } from "react";

import { SpecialistCoverageHonesty } from "../../src/components/specialist-coverage-honesty";
import { ToolGovernanceMarketplace } from "../../src/components/tool-governance-marketplace";

export const metadata = {
  title: "Engines — Periscan"
};

/**
 * Engine Lab — Community-startable vs legal-review vs catalog-only.
 * Accept upstream license → install from pin → enable under policy.
 * Specialist rows 2/16/21/22/26/28 stay Scaffold/partner-gated (Slice 9).
 * `/registries` remains the same marketplace surface for operators.
 */
export default function EnginesPage() {
  return (
    <>
      <Suspense fallback={null}>
        <ToolGovernanceMarketplace />
      </Suspense>
      <div className="mx-auto w-full max-w-7xl px-5 pb-6">
        <SpecialistCoverageHonesty />
      </div>
    </>
  );
}
