"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useStudentAuth } from "@/app/providers";

const tabs = [
  { href: "/educator/survey-results", label: "Student survey results" },
  { href: "/educator/sort-groups", label: "Sort groups" },
] as const;

export function EducatorWorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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
    <div className="flex min-h-full flex-col bg-background">
      <header className="border-b border-black/5 dark:border-white/10">
        <div className="mx-auto flex w-full max-w-[min(100%,120rem)] flex-col gap-0 px-4 sm:px-6">
          <div className="flex items-center justify-between gap-4 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-brand">Educator workspace</p>
              <p className="text-sm font-semibold text-foreground">Cohort Connect</p>
            </div>
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
          <nav
            className="-mb-px flex gap-1 overflow-x-auto border-t border-black/5 pt-1 dark:border-white/10"
            aria-label="Educator sections"
          >
            {tabs.map((tab) => {
              const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "shrink-0 rounded-t-lg px-4 py-3 text-sm font-medium transition",
                    active
                      ? "bg-surface text-foreground shadow-[inset_0_-2px_0_0_var(--color-brand)] dark:bg-white/[0.04]"
                      : "text-muted hover:bg-black/[0.03] hover:text-foreground dark:hover:bg-white/[0.04]",
                  ].join(" ")}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
