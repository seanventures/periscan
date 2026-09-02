import { SnapshotReportView } from "../../../../src/components/snapshot-report-view";

export default async function SnapshotReportPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  return <SnapshotReportView snapshotId={id} />;
}
