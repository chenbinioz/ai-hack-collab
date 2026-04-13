"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SupabaseEnvMissingBanner } from "@/components/supabase-env-missing-banner";
import { signInEducator } from "@/lib/auth/educator-auth";
import { signInStudent } from "@/lib/auth/student-auth";
import { getSafeRedirectPath } from "@/lib/auth/student-redirect";
import { hasStudentSupabaseEnv } from "@/lib/supabase/student-env";

function formatSignInErrorMessage(message: string, variant: StudentLoginFormVariant): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("invalid login credentials") ||
    lower.includes("invalid credentials") ||
    lower.includes("invalid email or password")
  ) {
    return "We couldn't find an account with that email and password. Check your details or sign up if you're new.";
  }
  if (lower.includes("email not confirmed")) {
    return "Confirm your email address before signing in.";
  }
  if (lower.includes("infinite recursion")) {
    if (variant === "educator") {
      return "Database RLS issue on teacher_profiles: run supabase/migrations/006_teacher_profiles_and_auth_role_trigger.sql in the Supabase SQL Editor, then sign in again.";
    }
    return "Database RLS issue: run supabase/migrations/003_fix_student_profiles_rls_recursion.sql in the Supabase SQL Editor, then sign in again.";
  }
  if (lower.includes("student_profile_exists") && lower.includes("does not exist")) {
    return "Missing database function: run supabase/migrations/003_fix_student_profiles_rls_recursion.sql in the Supabase SQL Editor, then sign in again.";
  }
  if (variant === "educator" && lower.includes("teacher_profile_exists") && lower.includes("does not exist")) {
    return "Missing database function: run supabase/migrations/006_teacher_profiles_and_auth_role_trigger.sql in the Supabase SQL Editor, then sign in again.";
  }
  return message;
}

export type StudentLoginFormVariant = "student" | "educator";

export function StudentLoginForm({
  studentLoginFormVariant,
  studentRedirectAfterLogin,
}: {
  studentLoginFormVariant: StudentLoginFormVariant;
  /** Post-login path; must be a safe relative path (see getSafeRedirectPath). */
  studentRedirectAfterLogin?: string;
}) {
  const router = useRouter();
  const postLoginFallback =
    studentLoginFormVariant === "educator" ? "/educator/overview" : "/student";
  const afterLogin = getSafeRedirectPath(studentRedirectAfterLogin, postLoginFallback);
  const copy =
    studentLoginFormVariant === "student"
      ? "Sign in with your student account to join cohorts and view your groups."
      : "Sign in with your staff account to manage cohorts and matching rules.";

  const [studentEmail, setStudentEmail] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [isStudentSigningIn, setIsStudentSigningIn] = useState(false);
  const [studentSignInError, setStudentSignInError] = useState<string | null>(null);

  async function handleStudentLoginSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStudentSignInError(null);

    const trimmedStudentEmail = studentEmail.trim();
    if (!trimmedStudentEmail || !studentPassword) {
      setStudentSignInError("Enter both email and password.");
      return;
    }

    if (!hasStudentSupabaseEnv()) {
      setStudentSignInError("Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY to .env and restart the dev server.");
      return;
    }

    setIsStudentSigningIn(true);
    try {
      const signInResult =
        studentLoginFormVariant === "educator"
          ? await signInEducator(trimmedStudentEmail, studentPassword)
          : await signInStudent(trimmedStudentEmail, studentPassword, {
              enforceStudentProfileRow: true,
            });
      if (signInResult.error) {
        setStudentSignInError(formatSignInErrorMessage(signInResult.error.message, studentLoginFormVariant));
        return;
      }
      router.replace(afterLogin);
      router.refresh();
    } catch {
      setStudentSignInError("Something went wrong. Please try again.");
    } finally {
      setIsStudentSigningIn(false);
    }
  }

  const fieldIdPrefix = `student-login-${studentLoginFormVariant}`;

  return (
    <form className="mt-8 space-y-5" onSubmit={handleStudentLoginSubmit} noValidate>
      <SupabaseEnvMissingBanner />
      <p className="text-sm text-muted">{copy}</p>

      {studentSignInError ? (
        <p
          className="rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-200"
          role="alert"
        >
          {studentSignInError}
        </p>
      ) : null}

      <div>
        <label htmlFor={`${fieldIdPrefix}-email`} className="block text-sm font-medium text-foreground">
          Email
        </label>
        <input
          id={`${fieldIdPrefix}-email`}
          name="email"
          type="email"
          autoComplete="email"
          value={studentEmail}
          onChange={(e) => setStudentEmail(e.target.value)}
          disabled={isStudentSigningIn || !hasStudentSupabaseEnv()}
          className="mt-1.5 w-full rounded-xl border border-black/10 bg-background px-3.5 py-2.5 text-foreground outline-none ring-brand/0 transition placeholder:text-muted/70 focus:border-brand/40 focus:ring-2 focus:ring-brand/20 disabled:opacity-60 dark:border-white/15"
        />
      </div>
      <div>
        <label htmlFor={`${fieldIdPrefix}-password`} className="block text-sm font-medium text-foreground">
          Password
        </label>
        <input
          id={`${fieldIdPrefix}-password`}
          name="password"
          type="password"
          autoComplete="current-password"
          value={studentPassword}
          onChange={(e) => setStudentPassword(e.target.value)}
          disabled={isStudentSigningIn || !hasStudentSupabaseEnv()}
          className="mt-1.5 w-full rounded-xl border border-black/10 bg-background px-3.5 py-2.5 text-foreground outline-none ring-brand/0 transition placeholder:text-muted/70 focus:border-brand/40 focus:ring-2 focus:ring-brand/20 disabled:opacity-60 dark:border-white/15"
        />
      </div>

      <button
        type="submit"
        disabled={isStudentSigningIn || !hasStudentSupabaseEnv()}
        className="w-full rounded-xl bg-brand py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isStudentSigningIn ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
