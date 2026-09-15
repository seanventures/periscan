import { createPublicDemoValidationSnapshot } from "@periscan/shared";

import { DemoWorkspace } from "../../../src/components/demo-workspace";

export const metadata = {
  title: "Guided demo — Periscan"
};

export default function DemoWorkspacePage() {
  return <DemoWorkspace snapshot={createPublicDemoValidationSnapshot()} />;
}
