import type { Metadata } from "next";
import { ClassesList } from "./classes-list";

export const metadata: Metadata = {
  title: "Classes — Educator — Cohort Connect",
  description: "Manage your classes and student groups.",
};

export default function EducatorClassesPage() {
  return (
    <main className="mx-auto w-full max-w-[min(100%,120rem)] px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Classes</h1>
        <p className="mt-2 text-muted">
          Create classes, manage student enrollment, and generate AI-matched teams.
        </p>
      </div>

      <ClassesList />
    </main>
  );
}