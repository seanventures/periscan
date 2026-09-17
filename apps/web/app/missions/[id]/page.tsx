import { MissionDetail } from "../../../src/components/mission-detail";

export const metadata = {
  title: "Validation mission — Periscan"
};

export default async function MissionDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MissionDetail missionId={id} />;
}
