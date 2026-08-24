import { AuthForm } from "@/components/ui/AuthForm";

export const metadata = { title: "Sign in — Reef" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-bg p-5">
      <AuthForm />
    </main>
  );
}
