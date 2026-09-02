import { ObjectExplorerInstanceShell } from "../../../../src/components/object-explorer";

export const metadata = {
  title: "Object instance — Periscan"
};

export default async function ObjectInstancePage({
  params
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type, id } = await params;
  return (
    <ObjectExplorerInstanceShell
      type={decodeURIComponent(type)}
      id={decodeURIComponent(id)}
    />
  );
}
