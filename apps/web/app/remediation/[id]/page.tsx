import { RemediationDetail } from "../../../src/components/remediation-detail";

export const metadata = {
  title: "Remediation — Periscan"
};

export default async function RemediationDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RemediationDetail id={id} />;
}
