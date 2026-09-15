import { ScopesWorkbench } from "../../src/components/scopes-workbench";

export const metadata = {
  title: "Scope — Periscan"
};

/**
 * First-class authorized-scope home (P14-8 / P07-2 Operate Scope).
 * Asset lineage remains at /assets (Assets & ownership).
 */
export default function ScopesPage() {
  return <ScopesWorkbench />;
}
