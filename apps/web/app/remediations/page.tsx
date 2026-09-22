import { redirect } from "next/navigation";

import { remediationsListAliasTarget } from "../../src/lib/remediations-list-alias";

export const metadata = {
  title: "Remediation — Periscan"
};

/**
 * P3-REMALIAS: plural `/remediations` was a Next 404; first-hour list is
 * `/remediation`. Redirect the list alias only. Detail stays `/remediation/:id`.
 */
export default function RemediationsAliasPage() {
  redirect(remediationsListAliasTarget("/remediations") ?? "/remediation");
}
