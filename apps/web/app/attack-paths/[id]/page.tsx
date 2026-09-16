import { AttackPathDetail } from "../../../src/components/attack-path-detail";

export const metadata = {
  title: "Attack path — Periscan"
};

export default async function AttackPathDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AttackPathDetail id={id} />;
}
