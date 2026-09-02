import { DashboardCommandCenter } from "../../src/components/dashboard-command-center";

export const metadata = {
  title: "Getting started — Periscan"
};

/** Alias of Home first-run. Keep this URL so the rail can set aria-current. */
export default function GettingStartedPage() {
  return <DashboardCommandCenter />;
}
