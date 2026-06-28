import type { User } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import type { createClient } from "@/lib/supabase/server-client";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

export async function resolveRequestUser(
  supabase: ServerSupabase,
  request: NextRequest,
): Promise<{ user: User | null; error: Error | null }> {
  let { data: { user }, error } = await supabase.auth.getUser();

  if (!user) {
    const authHeader =
      request.headers.get("authorization") || request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice("Bearer ".length);
      const tokenUserResult = await supabase.auth.getUser(token);
      user = tokenUserResult.data.user;
      error = tokenUserResult.error;
    }
  }

  return { user, error };
}
