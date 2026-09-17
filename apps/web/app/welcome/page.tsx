import { Suspense } from "react";

import { WelcomeExperience } from "../../src/components/welcome-experience";

export const metadata = {
  title: "Choose your starting view — Periscan"
};

export default function WelcomePage() {
  return (
    <Suspense fallback={null}>
      <WelcomeExperience />
    </Suspense>
  );
}
