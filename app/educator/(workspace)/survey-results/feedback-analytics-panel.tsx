"use client";

import { useEffect, useState } from "react";
import { createStudentBrowserClient } from "@/lib/supabase/student-browser-client";

interface TeamFeedbackAverage {
  team_id: string;
  name: string;
  average: number;
  count: number;
  total_reading_seconds?: number;
  avg_reading_seconds_per_submission?: number;
  coach_total_seconds?: number;
  coach_samples?: number;
}

interface FeedbackAnalyticsPanelProps {
  classId: string;
}

export function FeedbackAnalyticsPanel({ classId }: FeedbackAnalyticsPanelProps) {
  const [averages, setAverages] = useState<TeamFeedbackAverage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [collabMap, setCollabMap] = useState<Map<string, number>>(new Map());
  const [ratingTimeMap, setRatingTimeMap] = useState<Map<number, { totalSeconds: number; count: number }>>(new Map());

  useEffect(() => {
    let isMounted = true;

    async function loadAverages() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const supabase = createStudentBrowserClient();
        // Bound the data fetch with a timeout to avoid leaving the UI stuck
        const teamsRes = await supabase.from("teams").select("id, name").eq("class_id", classId);
        const teamIds = teamsRes.data?.map((t: any) => t.id) || [];

        const fetchPromise = Promise.all([
          supabase.from("feedback").select("team_id, overall_satisfaction, match_explanation_seconds").eq("class_id", classId),
          teamsRes,
          // message_read_times stores seconds spent reading coach messages (one row per student/message)
          supabase.from("message_read_times").select("team_id, seconds").in("team_id", teamIds),
        ]);

        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout fetching analytics (10s)")), 10000));

        const res: any = await Promise.race([fetchPromise, timeout]);
        const [{ data: feedbackData, error: feedbackError }, { data: teamData, error: teamError }, { data: messageReadData, error: messageReadError }] = res;

        if (feedbackError) {
          throw new Error(feedbackError.message);
        }
        if (teamError) {
          throw new Error(teamError.message);
        }

        const teamMap = new Map(teamData?.map((team: any) => [team.id, team.name]));
        // Fetch collaboration balances from backend educator-data
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
          const res = await fetch(`${apiUrl}/educator-data`);
          if (res.ok) {
            const json = await res.json();
            const teamsFromApi = json.teams || [];
            const map = new Map<string, number>();
            teamsFromApi.forEach((t: any) => {
              if (t.id && typeof t.collaboration_balance === "number") {
                map.set(t.id, t.collaboration_balance);
              }
            });
            if (isMounted) setCollabMap(map);
          } else {
            // non-OK response; leave collabMap unchanged
          }
        } catch (err: any) {
          console.warn("Could not fetch collaboration balances:", err);
        }
        const grouped = new Map<string, { total: number; count: number }>();
        const ratingTime = new Map<number, { totalSeconds: number; count: number }>();

        feedbackData?.forEach((entry: any) => {
          if (!entry.team_id) return;
          const group = grouped.get(entry.team_id) ?? { total: 0, count: 0 };
          group.total += entry.overall_satisfaction ?? 0;
          group.count += 1;
          grouped.set(entry.team_id, group);

          const rating = entry.overall_satisfaction ?? null;
          if (rating) {
            const rt = ratingTime.get(rating) ?? { totalSeconds: 0, count: 0 };
            rt.totalSeconds += (entry.match_explanation_seconds ?? 0);
            rt.count += 1;
            ratingTime.set(rating, rt);
          }
        });

        const averages = Array.from(grouped.entries()).map(([teamId, stats]) => ({
          team_id: teamId,
          name: String(teamMap.get(teamId) ?? "Unknown team"),
          average: stats.count > 0 ? stats.total / stats.count : 0,
          count: stats.count,
          total_reading_seconds: 0,
          avg_reading_seconds_per_submission: 0,
        } as TeamFeedbackAverage));

        // compute team-level total reading time for match explanation from feedback.match_explanation_seconds
        const readingByTeam = new Map<string, { total: number; count: number }>();
        feedbackData?.forEach((entry: any) => {
          if (!entry.team_id) return;
          const current = readingByTeam.get(entry.team_id) ?? { total: 0, count: 0 };
          current.total += (entry.match_explanation_seconds ?? 0);
          current.count += 1;
          readingByTeam.set(entry.team_id, current);
        });

        averages.forEach((team) => {
          const r = readingByTeam.get(team.team_id);
          if (r) {
            team.total_reading_seconds = r.total;
            team.avg_reading_seconds_per_submission = r.count > 0 ? Math.round(r.total / r.count) : 0;
          }
        });

        // compute coach message reading seconds per team
        const coachReading = new Map<string, { totalSeconds: number; count: number }>();
        (messageReadData || []).forEach((row: any) => {
          if (!row.team_id) return;
          const cur = coachReading.get(row.team_id) ?? { totalSeconds: 0, count: 0 };
          cur.totalSeconds += (row.seconds ?? 0);
          cur.count += 1;
          coachReading.set(row.team_id, cur);
        });

        // attach coachReading to team objects (we'll use ratingTimeMap to show rating/time previously stored)
        averages.forEach((team) => {
          const cr = coachReading.get(team.team_id);
          (team as any).coach_total_seconds = cr ? cr.totalSeconds : 0;
          (team as any).coach_samples = cr ? cr.count : 0;
        });

        if (isMounted) {
          setAverages(averages.sort((a, b) => b.average - a.average));
          setRatingTimeMap(new Map(ratingTime));
        }
      } catch (error: any) {
        console.error("FeedbackAnalyticsPanel.loadAverages error:", error);
        if (isMounted) {
          setLoadError((error && (error.message || String(error))) || "Unable to load feedback analytics.");
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
            const meterColor = team.average >= 4 ? "bg-emerald-500" : team.average >= 3 ? "bg-amber-500" : "bg-rose-500";

            return (
              <div key={team.team_id} className="rounded-3xl border border-black/5 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-950">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-foreground">{team.name}</p>
                    <p className="text-xs text-muted">{team.count} feedback submission{team.count === 1 ? "" : "s"}</p>
                  </div>
                  {(() => {
                    const val = collabMap.get(team.team_id);
                    if (typeof val !== "number") {
                      return (
                        <div className="flex items-center gap-2 rounded-full bg-black/2 px-2 py-1 text-xs text-muted dark:bg-white/5">
                          <span className={`h-2.5 w-2.5 rounded-full bg-neutral-300 dark:bg-neutral-600`} />
                          <span className="whitespace-nowrap">Collab —</span>
                        </div>
                      );
                    }
                    const color = val <= 0.33 ? "bg-emerald-500" : val <= 0.66 ? "bg-amber-500" : "bg-rose-500";
                    return (
                      <div
                        role="img"
                        aria-label={`Collaboration balance ${val.toFixed(2)}`}
                        title={`Collaboration balance ${val.toFixed(2)}`}
                        className="flex items-center gap-2 rounded-full bg-black/5 px-2 py-1 text-xs font-semibold text-foreground dark:bg-white/10"
                      >
                        <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
                        <span className="whitespace-nowrap">Collab {val.toFixed(2)}</span>
                      </div>
                    );
                  })()}
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-muted">Average score</div>
                    <div className="text-sm font-semibold text-foreground">{Number(team.average).toFixed(1)} / 5</div>
                  </div>
                  <div className="w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10 h-4">
                    <div
                      className={`${meterColor} h-full rounded-full transition-all duration-300`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 text-xs text-muted sm:flex-row sm:justify-between">
                  <div>
                    <div className="text-foreground text-xs font-medium">Reads total</div>
                    <div>{(team as any).total_reading_seconds ?? 0}s</div>
                  </div>
                  <div>
                    <div className="text-foreground text-xs font-medium">Avg / submission</div>
                    <div>{(team as any).avg_reading_seconds_per_submission ?? 0}s</div>
                  </div>
                  <div>
                    <div className="text-foreground text-xs font-medium">Coach reads</div>
                    <div>{(team as any).coach_total_seconds ?? 0}s ({(team as any).coach_samples ?? 0})</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-foreground">Reading time vs rating</h3>
          <p className="text-xs text-muted">Average seconds spent reading explanation, by overall rating.</p>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {[1,2,3,4,5].map((rating) => {
              const data = ratingTimeMap.get(rating);
              const avg = data && data.count > 0 ? Math.round(data.totalSeconds / data.count) : 0;
              return (
                <div key={rating} className="rounded-2xl border border-black/5 bg-white p-3 text-center text-sm">
                  <div className="font-semibold">{rating}</div>
                  <div className="text-xs text-muted">{avg}s avg</div>
                  <div className="text-xs text-muted">{data ? data.count : 0} samples</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
  );
}
