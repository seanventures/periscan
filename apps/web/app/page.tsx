import { redirect } from "next/navigation";

// The dashboard is the product home. Keep `/` as a stable entry that lands on
// the proof-loop command center.
export default function IndexPage() {
  redirect("/dashboard");
}
