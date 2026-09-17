import { EvidenceLedger } from "../../src/components/evidence-ledger";

export const metadata = {
  title: "Evidence — Periscan"
};

export default async function EvidencePage({
  searchParams
}: {
  searchParams: Promise<{ evidenceId?: string; q?: string }>;
}) {
  const params = await searchParams;
  // ICP-P1-12: prefer ?q= deep-links from compliance (and other surfaces);
  // keep evidenceId for older bookmarks.
  const initialQuery = params.q ?? params.evidenceId ?? "";
  return <EvidenceLedger initialQuery={initialQuery} />;
}
