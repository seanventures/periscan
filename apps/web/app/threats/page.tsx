import { redirect } from "next/navigation";

/**
 * UX-W2 threats hub join — product alias for the single Threats door.
 * Canonical surface is `/threat-center` (Labs · Threats) with hub links to
 * feed + signal activity. Deep links to those routes remain valid.
 */
export default function ThreatsAliasPage() {
  redirect("/threat-center");
}
