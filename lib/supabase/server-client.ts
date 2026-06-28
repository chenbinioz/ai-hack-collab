import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { getStudentSupabaseAnonKey, getStudentSupabaseUrl } from "@/lib/supabase/student-env";

function cookieHandlers(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return {
    getAll() {
      return cookieStore.getAll();
    },
    setAll(cookiesToSet: { name: string; value: string; options?: Parameters<typeof cookieStore.set>[2] }[]) {
      try {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options),
        );
      } catch {
        /* ignore when called from a Server Component that cannot set cookies */
      }
    },
  };
}

/** Server Components / Route Handlers: reads session from cookies. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(getStudentSupabaseUrl(), getStudentSupabaseAnonKey(), {
    cookies: cookieHandlers(cookieStore),
  });
}

/** Route Handlers that may receive Bearer tokens from browser fetches. */
export async function createClientFromRequest(request: NextRequest) {
  const cookieStore = await cookies();
  const authHeader =
    request.headers.get("authorization") || request.headers.get("Authorization");

  return createServerClient(getStudentSupabaseUrl(), getStudentSupabaseAnonKey(), {
    global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
    cookies: cookieHandlers(cookieStore),
  });
}
