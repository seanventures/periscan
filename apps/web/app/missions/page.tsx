// Honesty contract: this route is the guided Validation Snapshot surface only.
// Multi-type mission control stays unmounted until product-ready; primary nav
// must not claim "Missions" for this page while that remains true.
// Public chrome word = Validate (P07-3); workflow name stays Validation Snapshot.
import { ValidationSnapshotFlow } from "../../src/components/validation-snapshot-flow";

export const metadata = {
  title: "Validate — Periscan"
};

export default function MissionsPage() {
  return <ValidationSnapshotFlow />;
}
