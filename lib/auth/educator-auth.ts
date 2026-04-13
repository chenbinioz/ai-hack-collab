import type { AuthError, SupabaseClient } from "@supabase/supabase-js";
import { createStudentBrowserClient } from "@/lib/supabase/student-browser-client";

function getSupabaseBrowserClient() {
  return createStudentBrowserClient();
}

function educatorAuthError(message: string): AuthError {
  return {
    name: "AuthError",
    message,
    status: 400,
  } as AuthError;
}

async function teacherProfileRowExists(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.rpc("teacher_profile_exists", {
    p_user_id: userId,
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
 * Educator sign-up: `auth.signUp` with `data.app_role = 'educator'` so the DB trigger
 * creates `teacher_profiles` (not `student_profiles`).
 */
export async function signUpEducator(email: string, password: string) {
  const supabase = getSupabaseBrowserClient();
  return supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { app_role: "educator" },
    },
  });
}

/**
 * Educator sign-in: validates credentials, then confirms `teacher_profiles` exists via RPC.
 */
export async function signInEducator(email: string, password: string) {
  const supabase = getSupabaseBrowserClient();
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
      error: educatorAuthError("Sign-in succeeded but no user was returned."),
    };
  }

  const profile = await teacherProfileRowExists(supabase, user.id);
  if (!profile.ok && profile.error) {
    await supabase.auth.signOut({ scope: "global" });
    return { data: { user: null, session: null }, error: educatorAuthError(profile.error.message) };
  }

  if (!profile.ok) {
    await supabase.auth.signOut({ scope: "global" });
    return {
      data: { user: null, session: null },
      error: educatorAuthError(
        "No educator profile found for this account. It should be created automatically when you sign up as an educator. Try signing up again or contact support.",
      ),
    };
  }

  return result;
}
