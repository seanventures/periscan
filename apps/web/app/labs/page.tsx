import { LabsPortal } from "../../src/components/labs-portal";

export const metadata = {
  title: "Labs — Periscan"
};

/**
 * UX-W10 — Labs portal home (portal-only rail door).
 * Former Labs peers are listed on this page only.
 */
export default function LabsPage() {
  return <LabsPortal />;
}
