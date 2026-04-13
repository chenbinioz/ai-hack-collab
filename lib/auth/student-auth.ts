import type { AuthError, SupabaseClient } from "@supabase/supabase-js";
import { createStudentBrowserClient } from "@/lib/supabase/student-browser-client";

/** Linked to `auth.users` by trigger; app updates this table after onboarding (see migrations). */
export const STUDENT_PROFILES_TABLE = "student_profiles" as const;

function getStudentSupabaseBrowserClient() {
  return createStudentBrowserClient();
}

function studentAuthError(message: string): AuthError {
  return {
    name: "AuthError",
    message,
    status: 400,
  } as AuthError;
}

/**
 * Uses DB RPC `student_profile_exists` (SECURITY DEFINER) so sign-in does not run a direct
 * SELECT on student_profiles under RLS — avoids "infinite recursion detected in policy".
 */
async function studentProfileRowExists(supabase: SupabaseClient, studentUserId: string) {
  const { data, error } = await supabase.rpc("student_profile_exists", {
    p_user_id: studentUserId,
  });

  if (error) {
    return { ok: false as const, error: new Error(error.message) };
  }
  if (data === true) {
    return { ok: true as const };
  }
  return { ok: false as const, error: null as null };
}

/**
 * Student sign-up: `supabase.auth.signUp` only. A DB trigger creates the `student_profiles` row.
 * Profile fields are updated later when the student completes onboarding.
 */
export async function signUpStudent(email: string, password: string) {
  const supabase = getStudentSupabaseBrowserClient();
  return supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { app_role: "student" },
    },
  });
}

export type SignInStudentOptions = {
  /**
   * When true (student flows), require a `student_profiles` row (created by the sign-up trigger).
   * Educator login skips this until a staff model exists.
   */
  enforceStudentProfileRow: boolean;
};

/**
 * Student sign-in: validates credentials via Auth, then confirms `student_profiles` exists (Postgres).
 * No client-side profile creation — that is the trigger’s job at sign-up.
 */
export async function signInStudent(
  email: string,
  password: string,
  options: SignInStudentOptions = { enforceStudentProfileRow: true },
) {
  const supabase = getStudentSupabaseBrowserClient();
  const trimmedEmail = email.trim();

  const result = await supabase.auth.signInWithPassword({
    email: trimmedEmail,
    password,
  });

  if (result.error) {
    return result;
  }

  const user = result.data.user;
  if (!user) {
    return {
      data: { user: null, session: null },
      error: studentAuthError("Sign-in succeeded but no user was returned."),
    };
  }

  if (!options.enforceStudentProfileRow) {
    return result;
  }

  const profile = await studentProfileRowExists(supabase, user.id);
  if (!profile.ok && profile.error) {
    await supabase.auth.signOut({ scope: "global" });
    return { data: { user: null, session: null }, error: studentAuthError(profile.error.message) };
  }

  if (!profile.ok) {
    await supabase.auth.signOut({ scope: "global" });
    return {
      data: { user: null, session: null },
      error: studentAuthError(
        "No student profile found for this account. It should be created automatically when you sign up. Try signing up again or contact support.",
      ),
    };
  }

  return result;
}

/** Ends session locally and revokes refresh token on the server. */
export async function signOutStudent() {
  const supabase = getStudentSupabaseBrowserClient();
  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) throw error;
}
