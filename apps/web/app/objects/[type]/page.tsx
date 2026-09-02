import { ObjectExplorerTypeShell } from "../../../src/components/object-explorer";

export const metadata = {
  title: "Object type — Periscan"
};

export default async function ObjectTypePage({
  params
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  return <ObjectExplorerTypeShell type={decodeURIComponent(type)} />;
}
