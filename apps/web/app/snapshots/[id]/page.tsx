import { SnapshotReviewWorkspace } from "../../../src/components/snapshot-review-workspace";

export default async function SnapshotReportPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  return <SnapshotReviewWorkspace snapshotId={id} />;
}
