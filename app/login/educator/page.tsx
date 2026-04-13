import type { Metadata } from "next";
import Link from "next/link";
import { StudentLoginForm } from "../student-login-form";
import { getSafeEducatorRedirectPath } from "@/lib/auth/student-redirect";

export const metadata: Metadata = {
  title: "Educator log in — Cohort Connect",
  description: "Sign in to Cohort Connect as an educator or module lead.",
};

export default async function EducatorLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const raw = typeof sp.next === "string" ? sp.next : undefined;
  const educatorRedirectAfterLogin = getSafeEducatorRedirectPath(raw);

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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Educator log in</h1>
          <p className="mt-2 text-sm text-muted">
            Manage cohorts, rules, and exports for your modules.
          </p>
          <StudentLoginForm
            studentLoginFormVariant="educator"
            studentRedirectAfterLogin={educatorRedirectAfterLogin}
          />
          <p className="mt-6 text-center text-sm text-muted">
            New here?{" "}
            <Link href="/signup/educator" className="font-medium text-brand hover:text-brand-deep">
              Educator sign up
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
