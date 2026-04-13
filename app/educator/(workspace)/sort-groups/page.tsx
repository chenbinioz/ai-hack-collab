import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sort groups — Educator — Cohort Connect",
  description: "Configure and sort student groups.",
};

export default function EducatorSortGroupsPage() {
  return (
    <main className="mx-auto w-full max-w-[min(100%,120rem)] px-4 py-8 sm:px-6 sm:py-10">
      <div className="rounded-2xl border border-dashed border-black/15 bg-black/[0.02] px-6 py-16 text-center dark:border-white/20 dark:bg-white/[0.03]">
        <h2 className="text-lg font-semibold text-foreground">Sort groups</h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted">
          Group sorting and placement tools will be available here in a future update.
        </p>
      </div>
    </main>
  );
}
