import { Suspense } from "react";

import { EmailVerification } from "../../src/components/email-verification";

export const metadata = {
  title: "Verify email — Periscan"
};

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <EmailVerification />
    </Suspense>
  );
}
