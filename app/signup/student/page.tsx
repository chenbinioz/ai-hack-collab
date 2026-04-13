import type { Metadata } from "next";
import Link from "next/link";
import { StudentSignupForm } from "../signup-form";

export const metadata: Metadata = {
  title: "Student sign up — Cohort Connect",
  description: "Create a student account for Cohort Connect.",
};

export default function StudentSignupPage() {
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Student sign up</h1>
          <p className="mt-2 text-sm text-muted">
            Create your student account. Your email and profile are stored in Supabase (Auth and PostgreSQL).
          </p>
          <StudentSignupForm />
          <p className="mt-6 text-center text-sm text-muted">
            Already have an account?{" "}
            <Link href="/login/student" className="font-medium text-brand hover:text-brand-deep">
              Student log in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
