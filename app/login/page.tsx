import type { Metadata } from "next";
import Link from "next/link";
import { StudentLoginForm } from "./student-login-form";
import { getSafeStudentRedirectPath } from "@/lib/auth/student-redirect";

export const metadata: Metadata = {
  title: "Log in — Cohort Connect",
  description: "Sign in to Cohort Connect.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const raw = typeof sp.next === "string" ? sp.next : undefined;
  const studentRedirectAfterLogin = getSafeStudentRedirectPath(raw);

  return (
    <div className="flex min-h-full flex-col bg-background">
      <header className="border-b border-black/5 px-4 py-4 dark:border-white/10 sm:px-6">
        <Link
          href="/"
          className="text-sm font-medium text-brand transition hover:text-brand-deep dark:hover:text-brand"
        >
          ← Back to home
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-md rounded-2xl border border-black/6 bg-surface p-8 shadow-sm dark:border-white/10">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Log in</h1>
          <p className="mt-2 text-sm text-muted">Sign in with your email and password to continue.</p>
          <StudentLoginForm
            studentLoginFormVariant="student"
            studentRedirectAfterLogin={studentRedirectAfterLogin}
          />
        </div>
      </main>
    </div>
  );
}
