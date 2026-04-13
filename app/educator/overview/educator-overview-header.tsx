"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStudentAuth } from "@/app/providers";

export function EducatorOverviewHeader() {
  const router = useRouter();
  const { signOutStudent } = useStudentAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleLogout() {
    setIsSigningOut(true);
    try {
      await signOutStudent();
      router.replace("/");
      router.refresh();
    } catch {
      setIsSigningOut(false);
    }
  }

  return (
    <header className="border-b border-black/5 px-4 py-4 dark:border-white/10 sm:px-6">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">Overview</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-sm font-medium text-brand transition hover:text-brand-deep dark:hover:text-brand"
          >
            Home
          </Link>
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={isSigningOut}
            className="rounded-xl border border-black/10 bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:hover:bg-white/[0.06]"
          >
            {isSigningOut ? "Signing out…" : "Log out"}
          </button>
        </div>
      </div>
    </header>
  );
}
