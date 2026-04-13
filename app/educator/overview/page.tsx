import type { Metadata } from "next";
import { EducatorOverviewHeader } from "./educator-overview-header";

export const metadata: Metadata = {
  title: "Overview — Educator — Cohort Connect",
  description: "Educator dashboard overview for Cohort Connect.",
};

export default function EducatorOverviewPage() {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <EducatorOverviewHeader />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-10 sm:px-6">
        <p className="text-sm text-muted">
          This overview dashboard is a placeholder. Full cohort and module tools will be added here later.
        </p>
      </main>
    </div>
  );
}
