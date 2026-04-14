import type { Metadata } from "next";
import { StudentSurveyResultsTable } from "./student-survey-results-table";
import { FeedbackAnalyticsPanel } from "./feedback-analytics-panel";

export const metadata: Metadata = {
  title: "Student survey results — Educator — Cohort Connect",
  description: "View completed student profile surveys.",
};

export default function EducatorSurveyResultsPage() {
  return (
    <main className="mx-auto w-full max-w-[min(100%,120rem)] px-4 py-8 sm:px-6 sm:py-10">
      <StudentSurveyResultsTable />
      <div className="mt-8">
        <FeedbackAnalyticsPanel />
      </div>
    </main>
  );
}
