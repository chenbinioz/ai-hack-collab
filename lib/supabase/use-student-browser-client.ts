import { useMemo } from "react";
import { createStudentBrowserClient } from "@/lib/supabase/student-browser-client";

/** Stable browser Supabase client — safe to use in hook dependency arrays. */
export function useStudentBrowserClient() {
  return useMemo(() => createStudentBrowserClient(), []);
}
