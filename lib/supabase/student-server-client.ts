import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getStudentSupabaseAnonKey, getStudentSupabaseUrl } from "@/lib/supabase/student-env";

/** Server Components / Route Handlers: reads session from cookies. */
export async function createStudentServerClient() {
  const cookieStore = await cookies();

  return createServerClient(getStudentSupabaseUrl(), getStudentSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          /* ignore when called from a Server Component that cannot set cookies */
        }
      },
    },
  });
}
