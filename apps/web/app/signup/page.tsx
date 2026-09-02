import { AuthForm } from "../../src/components/auth-form";

export const metadata = {
  title: "Create account — Periscan"
};

export default function SignupPage() {
  return <AuthForm mode="signup" />;
}
