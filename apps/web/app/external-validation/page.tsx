import { ExternalValidationProfiles } from "../../src/components/external-validation-profiles";
import { PageShell } from "../../src/ui";

export const metadata = {
  title: "External assessment — Periscan"
};

export default function ExternalValidationPage() {
  return (
    <PageShell>
      <ExternalValidationProfiles />
    </PageShell>
  );
}
