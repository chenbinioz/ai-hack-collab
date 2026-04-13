"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SupabaseEnvMissingBanner } from "@/components/supabase-env-missing-banner";
import { signUpStudent } from "@/lib/auth/student-auth";
import { hasStudentSupabaseEnv } from "@/lib/supabase/student-env";

function formatStudentSignupErrorMessage(message: string): string {
  if (message.toLowerCase().includes("database error saving new user")) {
    return "Sign-up failed inside the database (usually the auth profile trigger). In Supabase → SQL Editor, run supabase/migrations/002_fix_student_signup.sql and supabase/migrations/006_teacher_profiles_and_auth_role_trigger.sql from this repo, then try again.";
  }
  return message;
}

export function StudentSignupForm() {
  const router = useRouter();
  const [studentSignupEmail, setStudentSignupEmail] = useState("");
  const [studentSignupPassword, setStudentSignupPassword] = useState("");
  const [isStudentSigningUp, setIsStudentSigningUp] = useState(false);
  const [studentSignupError, setStudentSignupError] = useState<string | null>(null);
  const [studentSignupSuccess, setStudentSignupSuccess] = useState<string | null>(null);

  async function handleStudentSignupSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStudentSignupError(null);
    setStudentSignupSuccess(null);

    const trimmedStudentEmail = studentSignupEmail.trim();
    if (!trimmedStudentEmail || !studentSignupPassword) {
      setStudentSignupError("Enter both email and password.");
      return;
    }

    if (!hasStudentSupabaseEnv()) {
      setStudentSignupError("Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY to .env and restart the dev server.");
      return;
    }

    setIsStudentSigningUp(true);
    try {
      const { data, error: signUpStudentError } = await signUpStudent(
        trimmedStudentEmail,
        studentSignupPassword,
      );
      if (signUpStudentError) {
        setStudentSignupError(formatStudentSignupErrorMessage(signUpStudentError.message));
        return;
      }
      if (data.session) {
        router.replace("/student");
        router.refresh();
        return;
      } else {
        setStudentSignupSuccess(
          "Account created. Check your email to confirm your address before signing in.",
        );
      }
      setStudentSignupEmail("");
      setStudentSignupPassword("");
    } catch {
      setStudentSignupError("Something went wrong. Please try again.");
    } finally {
      setIsStudentSigningUp(false);
    }
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={handleStudentSignupSubmit} noValidate>
      <SupabaseEnvMissingBanner />
      {studentSignupError ? (
        <p
          className="rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-200"
          role="alert"
        >
          {studentSignupError}
        </p>
      ) : null}
      {studentSignupSuccess ? (
        <p
          className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-900 dark:text-emerald-100"
          role="status"
        >
          {studentSignupSuccess}
        </p>
      ) : null}

      <div>
        <label htmlFor="student-signup-email" className="block text-sm font-medium text-foreground">
          Email
        </label>
        <input
          id="student-signup-email"
          name="email"
          type="email"
          autoComplete="email"
          value={studentSignupEmail}
          onChange={(e) => setStudentSignupEmail(e.target.value)}
          disabled={isStudentSigningUp || !hasStudentSupabaseEnv()}
          className="mt-1.5 w-full rounded-xl border border-black/10 bg-background px-3.5 py-2.5 text-foreground outline-none ring-brand/0 transition placeholder:text-muted/70 focus:border-brand/40 focus:ring-2 focus:ring-brand/20 disabled:opacity-60 dark:border-white/15"
        />
      </div>
      <div>
        <label htmlFor="student-signup-password" className="block text-sm font-medium text-foreground">
          Password
        </label>
        <input
          id="student-signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={studentSignupPassword}
          onChange={(e) => setStudentSignupPassword(e.target.value)}
          disabled={isStudentSigningUp || !hasStudentSupabaseEnv()}
          className="mt-1.5 w-full rounded-xl border border-black/10 bg-background px-3.5 py-2.5 text-foreground outline-none ring-brand/0 transition placeholder:text-muted/70 focus:border-brand/40 focus:ring-2 focus:ring-brand/20 disabled:opacity-60 dark:border-white/15"
        />
      </div>

      <button
        type="submit"
        disabled={isStudentSigningUp || !hasStudentSupabaseEnv()}
        className="w-full rounded-xl bg-brand py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isStudentSigningUp ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
