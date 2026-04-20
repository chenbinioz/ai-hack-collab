"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SupabaseEnvMissingBanner } from "@/components/supabase-env-missing-banner";
import { signUpEducator } from "@/lib/auth/educator-auth";
import { hasStudentSupabaseEnv } from "@/lib/supabase/student-env";

function formatEducatorSignupErrorMessage(message: string): string {
  if (message.toLowerCase().includes("database error saving new user")) {
    return "Sign-up failed inside the database (usually the auth profile trigger). In Supabase → SQL Editor, run supabase/migrations/006_teacher_profiles_and_auth_role_trigger.sql from this repo, then try again.";
  }
  return message;
}

export function EducatorSignupForm() {
  const router = useRouter();
  const [educatorSignupEmail, setEducatorSignupEmail] = useState("");
  const [educatorSignupPassword, setEducatorSignupPassword] = useState("");
  const [isEducatorSigningUp, setIsEducatorSigningUp] = useState(false);
  const [educatorSignupError, setEducatorSignupError] = useState<string | null>(null);
  const [educatorSignupSuccess, setEducatorSignupSuccess] = useState<string | null>(null);

  async function handleEducatorSignupSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEducatorSignupError(null);
    setEducatorSignupSuccess(null);

    const trimmedEmail = educatorSignupEmail.trim();
    if (!trimmedEmail || !educatorSignupPassword) {
      setEducatorSignupError("Enter both email and password.");
      return;
    }

    if (!hasStudentSupabaseEnv()) {
      setEducatorSignupError("Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY to .env and restart the dev server.");
      return;
    }

    setIsEducatorSigningUp(true);
    try {
      const { data, error: signUpError } = await signUpEducator(trimmedEmail, educatorSignupPassword);
      if (signUpError) {
        setEducatorSignupError(formatEducatorSignupErrorMessage(signUpError.message));
        return;
      }
      if (data.session) {
        router.replace("/educator/classes");
        router.refresh();
        return;
      }
      setEducatorSignupSuccess(
        "Account created. Check your email to confirm your address before signing in.",
      );
      setEducatorSignupEmail("");
      setEducatorSignupPassword("");
    } catch {
      setEducatorSignupError("Something went wrong. Please try again.");
    } finally {
      setIsEducatorSigningUp(false);
    }
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={handleEducatorSignupSubmit} noValidate>
      <SupabaseEnvMissingBanner />
      {educatorSignupError ? (
        <p
          className="rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-200"
          role="alert"
        >
          {educatorSignupError}
        </p>
      ) : null}
      {educatorSignupSuccess ? (
        <p
          className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-900 dark:text-emerald-100"
          role="status"
        >
          {educatorSignupSuccess}
        </p>
      ) : null}

      <div>
        <label htmlFor="educator-signup-email" className="block text-sm font-medium text-foreground">
          Email
        </label>
        <input
          id="educator-signup-email"
          name="email"
          type="email"
          autoComplete="email"
          value={educatorSignupEmail}
          onChange={(e) => setEducatorSignupEmail(e.target.value)}
          disabled={isEducatorSigningUp || !hasStudentSupabaseEnv()}
          className="mt-1.5 w-full rounded-xl border border-black/10 bg-background px-3.5 py-2.5 text-foreground outline-none ring-brand/0 transition placeholder:text-muted/70 focus:border-brand/40 focus:ring-2 focus:ring-brand/20 disabled:opacity-60 dark:border-white/15"
        />
      </div>
      <div>
        <label htmlFor="educator-signup-password" className="block text-sm font-medium text-foreground">
          Password
        </label>
        <input
          id="educator-signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={educatorSignupPassword}
          onChange={(e) => setEducatorSignupPassword(e.target.value)}
          disabled={isEducatorSigningUp || !hasStudentSupabaseEnv()}
          className="mt-1.5 w-full rounded-xl border border-black/10 bg-background px-3.5 py-2.5 text-foreground outline-none ring-brand/0 transition placeholder:text-muted/70 focus:border-brand/40 focus:ring-2 focus:ring-brand/20 disabled:opacity-60 dark:border-white/15"
        />
      </div>

      <button
        type="submit"
        disabled={isEducatorSigningUp || !hasStudentSupabaseEnv()}
        className="w-full rounded-xl bg-brand py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isEducatorSigningUp ? "Creating account…" : "Create educator account"}
      </button>
    </form>
  );
}
