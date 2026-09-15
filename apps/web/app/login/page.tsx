import { AuthForm } from "../../src/components/auth-form";

export const metadata = {
  title: "Sign in — Periscan"
};

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
