"use client";

import { FeedbackAnalyticsPanel } from "@/app/educator/(workspace)/survey-results/feedback-analytics-panel";

interface ClassFeedbackOverviewProps {
  classId: string;
}

export function ClassFeedbackOverview({ classId }: ClassFeedbackOverviewProps) {
  return (
    <div className="rounded-2xl border border-black/10 bg-surface p-6 shadow-sm dark:border-white/10">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">Class feedback overview</h2>
        <p className="mt-1 text-sm text-muted">
          Aggregated satisfaction and engagement metrics across all assignments in this class.
        </p>
      </div>
      <FeedbackAnalyticsPanel classId={classId} />
    </div>
  );
}
