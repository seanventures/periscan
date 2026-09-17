import { DataFabricWorkbench } from "../../src/components/data-fabric-workbench";

export const metadata = {
  title: "Assets & ownership — Periscan"
};

/** P07-18 / P07-2: inventory & ownership; authorize lives on /scopes. */
export default function AssetsPage() {
  return <DataFabricWorkbench />;
}
