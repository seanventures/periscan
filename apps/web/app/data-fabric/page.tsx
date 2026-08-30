import { redirect } from "next/navigation";

export const metadata = {
  title: "Assets & ownership — Periscan"
};

/** P07-18: legacy /data-fabric → /assets (fabric is internal name only). */
export default function DataFabricRedirectPage() {
  redirect("/assets");
}
