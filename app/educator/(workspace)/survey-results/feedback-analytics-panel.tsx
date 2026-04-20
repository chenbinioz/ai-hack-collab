"use client";

import { useEffect, useState } from "react";
import { createStudentBrowserClient } from "@/lib/supabase/student-browser-client";

interface TeamFeedbackAverage {
  team_id: string;
  name: string;
  average: number;
  count: number;
}

interface FeedbackAnalyticsPanelProps {
  classId: string;
}

export function FeedbackAnalyticsPanel({ classId }: FeedbackAnalyticsPanelProps) {
  const [averages, setAverages] = useState<TeamFeedbackAverage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const supabase = createStudentBrowserClient();

    async function loadAverages() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const [{ data: feedbackData, error: feedbackError }, { data: teamData, error: teamError }] = await Promise.all([
          supabase.from("feedback").select("team_id, overall_satisfaction").eq("class_id", classId),
          supabase.from("teams").select("id, name").eq("class_id", classId),
        ]);

        if (feedbackError) {
          throw new Error(feedbackError.message);
        }
        if (teamError) {
          throw new Error(teamError.message);
        }

        const teamMap = new Map(teamData?.map((team: any) => [team.id, team.name]));
        const grouped = new Map<string, { total: number; count: number }>();

        feedbackData?.forEach((entry: any) => {
          if (!entry.team_id) return;
          const group = grouped.get(entry.team_id) ?? { total: 0, count: 0 };
          group.total += entry.overall_satisfaction ?? 0;
          group.count += 1;
          grouped.set(entry.team_id, group);
        });

        const averages = Array.from(grouped.entries()).map(([teamId, stats]) => ({
          team_id: teamId,
          name: teamMap.get(teamId) ?? "Unknown team",
          average: stats.count > 0 ? stats.total / stats.count : 0,
          count: stats.count,
        }));

        if (isMounted) {
          setAverages(averages.sort((a, b) => b.average - a.average));
        }
      } catch (error: any) {
        if (isMounted) {
          setLoadError(error.message || "Unable to load feedback analytics.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadAverages();

    return () => {
      isMounted = false;
    };
  }, [classId]);

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-black/10 bg-surface p-6 shadow-sm dark:border-white/10">
        <p className="text-sm text-muted">Loading analytics…</p>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm dark:border-red-800 dark:bg-red-950/30">
        {loadError}
      </section>
    );
  }

  if (averages.length === 0) {
    return (
      <section className="rounded-2xl border border-black/10 bg-surface p-6 shadow-sm dark:border-white/10">
        <h2 className="text-base font-semibold text-foreground">Feedback analytics</h2>
        <p className="mt-2 text-sm text-muted">No feedback has been submitted yet.</p>
      </section>
    );
  }

  return (
      <section className="rounded-2xl border border-black/10 bg-surface p-6 shadow-sm dark:border-white/10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Feedback analytics</h2>
            <p className="mt-1 text-sm text-muted">Average satisfaction by team based on recent instant sentiment.</p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {averages.map((team) => {
            const percentage = Math.round((team.average / 5) * 100);
            const meterColor =
              team.average >= 4 ? "bg-emerald-500" : team.average >= 3 ? "bg-amber-500" : "bg-rose-500";

            return (
              <div key={team.team_id} className="rounded-3xl border border-black/5 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-950">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-foreground">{team.name}</p>
                    <p className="text-xs text-muted">{team.count} feedback submission{team.count === 1 ? "" : "s"}</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-black/5 px-3 py-1 text-xs font-semibold text-foreground dark:bg-white/10">
                    <span className={"h-2.5 w-2.5 rounded-full " + meterColor} />
                    {team.average.toFixed(1)}/5
                  </div>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                  <div
                    className={`${meterColor} h-full rounded-full transition-all duration-300`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>
  );
}
