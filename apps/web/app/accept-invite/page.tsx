import { Suspense } from "react";

import { AccessRecoveryForm } from "../../src/components/access-recovery-form";

export const metadata = {
  title: "Accept invitation — Periscan"
};

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <AccessRecoveryForm mode="invite" />
    </Suspense>
  );
}
