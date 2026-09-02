import Link from "next/link";

import { AttackTechniquesCatalog } from "../../src/components/attack-techniques-catalog";
import { PageHeader, PageShell, buttonClassName } from "../../src/ui";

export default async function AttackTechniquesPage({
  searchParams
}: {
  searchParams: Promise<{ technique?: string }>;
}) {
  const { technique } = await searchParams;
  return (
    <PageShell>
      <PageHeader
        eyebrow="Reference"
        title="ATT&CK reference & tenant coverage."
        description="A curated safe-example subset from Periscan's authenticated ATT&CK reference API, overlaid with this tenant's persisted control-validation coverage. This is not the complete MITRE catalog."
        actions={
          <>
            <Link
              className={buttonClassName({ size: "sm", variant: "secondary" })}
              href="/threat-center"
            >
              Threat Center
            </Link>
            <Link
              className={buttonClassName({ size: "sm", variant: "secondary" })}
              href="/findings"
            >
              Findings
            </Link>
          </>
        }
      />
      <AttackTechniquesCatalog initialTechniqueId={technique ?? ""} />
    </PageShell>
  );
}
