import { Suspense } from "react";

import { AccessRecoveryForm } from "../../src/components/access-recovery-form";

export const metadata = {
  title: "Reset password — Periscan"
};

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <AccessRecoveryForm mode="reset" />
    </Suspense>
  );
}
