"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createStudentBrowserClient } from "@/lib/supabase/student-browser-client";
import { signOutStudent } from "@/lib/auth/student-auth";
import { hasStudentSupabaseEnv } from "@/lib/supabase/student-env";

export type StudentAuthContextValue = {
  user: User | null;
  session: Session | null;
  /** True until the first `getSession()` completes — avoids flashing logged-out UI. */
  isStudentAuthLoading: boolean;
  signOutStudent: () => Promise<void>;
};

const StudentAuthContext = createContext<StudentAuthContextValue | undefined>(undefined);

export function StudentAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isStudentAuthLoading, setIsStudentAuthLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (!hasStudentSupabaseEnv()) {
      queueMicrotask(() => {
        if (!cancelled) setIsStudentAuthLoading(false);
      });
      return;
    }

    const supabase = createStudentBrowserClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      queueMicrotask(() => {
        if (cancelled) return;
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
      });
    });

    void supabase.auth.getSession().then(({ data: { session: initial } }) => {
      if (cancelled) return;
      queueMicrotask(() => {
        if (cancelled) return;
        setSession(initial);
        setUser(initial?.user ?? null);
        setIsStudentAuthLoading(false);
      });
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signOutStudentCallback = useCallback(async () => {
    await signOutStudent();
  }, []);

  const value = useMemo(
    () => ({
      user,
      session,
      isStudentAuthLoading,
      signOutStudent: signOutStudentCallback,
    }),
    [user, session, isStudentAuthLoading, signOutStudentCallback],
  );

  return <StudentAuthContext.Provider value={value}>{children}</StudentAuthContext.Provider>;
}

export function useStudentAuth(): StudentAuthContextValue {
  const ctx = useContext(StudentAuthContext);
  if (ctx === undefined) {
    throw new Error("useStudentAuth must be used within StudentAuthProvider");
  }
  return ctx;
}
