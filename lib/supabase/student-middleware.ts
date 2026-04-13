import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import {
  getStudentSupabaseAnonKey,
  getStudentSupabaseUrl,
  hasStudentSupabaseEnv,
} from "@/lib/supabase/student-env";

/**
 * Refreshes the Supabase session from cookies on each matched request.
 * Keep logic minimal between createServerClient and getUser() per Supabase guidance.
 */
export async function updateStudentAuthSession(request: NextRequest) {
  if (!hasStudentSupabaseEnv()) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(getStudentSupabaseUrl(), getStudentSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  await supabase.auth.getUser();

  return response;
}
