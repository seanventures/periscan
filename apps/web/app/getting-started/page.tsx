import { redirect } from "next/navigation";

export const metadata = {
  title: "Getting started — Periscan"
};

/** One first-run: Home GetStarted. This route is an alias, not a second board. */
export default function GettingStartedPage() {
  redirect("/dashboard");
}
