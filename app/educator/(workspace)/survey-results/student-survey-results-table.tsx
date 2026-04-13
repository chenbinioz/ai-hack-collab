"use client";

import { useCallback, useEffect, useState } from "react";
import { createStudentBrowserClient } from "@/lib/supabase/student-browser-client";
import { hasStudentSupabaseEnv } from "@/lib/supabase/student-env";
import {
  type CompletedStudentSurveyRow,
  fetchCompletedStudentSurveysForEducator,
  formatAlevelTitlesJson,
} from "@/lib/educator/student-survey-results";

function Cell({
  children,
  className = "",
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <td
      title={title}
      className={`px-3 py-2.5 text-sm tabular-nums text-foreground ${className}`}
    >
      {children}
    </td>
  );
}

function Th({
  children,
  title,
  className = "",
}: {
  children: React.ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <th
      scope="col"
      title={title}
      className={`border-b border-black/10 bg-black/[0.04] px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted dark:border-white/10 dark:bg-white/[0.06] ${className}`}
    >
      {children}
    </th>
  );
}

function formatCompletedAt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function StudentSurveyResultsTable() {
  const [rows, setRows] = useState<CompletedStudentSurveyRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!hasStudentSupabaseEnv()) {
      setLoadError("Supabase is not configured.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    const supabase = createStudentBrowserClient();
    const { data, error } = await fetchCompletedStudentSurveysForEducator(supabase);
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("does not exist") || msg.includes("function")) {
        setLoadError(
          "The educator survey export is not available yet. Run supabase/migrations/007_educator_list_completed_student_surveys.sql in the Supabase SQL Editor.",
        );
      } else if (msg.includes("forbidden")) {
        setLoadError("Your account is not recognised as an educator profile.");
      } else {
        setLoadError(error.message);
      }
      setRows(null);
      setIsLoading(false);
      return;
    }
    setRows((data ?? []) as CompletedStudentSurveyRow[]);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (isLoading) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center rounded-2xl border border-black/6 bg-surface dark:border-white/10">
        <p className="text-sm text-muted">Loading survey results…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-4 text-sm text-red-900 dark:text-red-100"
        role="alert"
      >
        {loadError}
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="rounded-2xl border border-black/6 bg-surface p-10 text-center shadow-sm dark:border-white/10">
        <p className="text-sm font-medium text-foreground">No completed surveys yet</p>
        <p className="mt-2 text-sm text-muted">
          When students finish the profile survey, their responses will appear in this table.
        </p>
      </div>
    );
  }

  const sectionBorder = "border-l-2 border-brand/30 pl-3";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Completed responses</h2>
          <p className="mt-1 text-sm text-muted">
            {rows.length} student{rows.length === 1 ? "" : "s"} · all ratings are on a 1–5 scale
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-xl border border-black/10 bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-black/[0.03] dark:border-white/15 dark:hover:bg-white/[0.06]"
        >
          Refresh
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/6 bg-surface shadow-sm dark:border-white/10">
        <div className="overflow-x-auto">
          <table className="w-max min-w-full border-collapse text-left">
            <thead>
              <tr>
                <Th className="sticky left-0 z-20 min-w-[9rem] bg-black/[0.04] shadow-[1px_0_0_0_var(--tw-shadow-color)] shadow-black/10 dark:bg-white/[0.06] dark:shadow-white/10">
                  Name
                </Th>
                <Th className="sticky left-[9rem] z-20 min-w-[11rem] bg-black/[0.04] shadow-[1px_0_0_0_var(--tw-shadow-color)] shadow-black/10 dark:bg-white/[0.06] dark:shadow-white/10">
                  Email
                </Th>
                <Th title="Degree title">Degree</Th>
                <Th title="Year of study">Yr</Th>
                <Th title="A-level or equivalent subjects" className="min-w-[9rem] normal-case">
                  Prior study
                </Th>
                <Th title="Ancillary module" className="min-w-[7rem] normal-case">
                  Ancillary
                </Th>
                <Th title="When the survey was submitted" className="min-w-[9rem] normal-case">
                  Submitted
                </Th>
                <Th title="Coding confidence" className={`min-w-[2.75rem] ${sectionBorder}`}>
                  Code
                </Th>
                <Th title="Written reports" className="min-w-[2.75rem]">
                  Write
                </Th>
                <Th title="Presentation / public speaking" className="min-w-[2.75rem]">
                  Speak
                </Th>
                <Th title="Mathematical literacy" className="min-w-[2.75rem]">
                  Maths
                </Th>
                <Th title="Abstract / complex content" className="min-w-[2.75rem]">
                  Abstr.
                </Th>
                <Th title="Conflict resolution" className="min-w-[2.75rem]">
                  Conf.
                </Th>
                <Th title="Approach to deadlines" className={`min-w-[2.75rem] ${sectionBorder}`}>
                  Dln.
                </Th>
                <Th title="Discussion" className="min-w-[2.75rem]">
                  Disc.
                </Th>
                <Th title="Disagreement" className="min-w-[2.75rem]">
                  Disagr.
                </Th>
                <Th title="New concepts" className="min-w-[2.75rem]">
                  New
                </Th>
                <Th title="Communication" className="min-w-[2.75rem]">
                  Comm.
                </Th>
                <Th title="Teammate work" className="min-w-[2.75rem]">
                  Team
                </Th>
                <Th title="Heavy workload" className="min-w-[2.75rem]">
                  Load
                </Th>
                <Th title="Group project role" className="min-w-[2.75rem]">
                  Role
                </Th>
                <Th title="Critical feedback" className="min-w-[2.75rem]">
                  Fdbk.
                </Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/6 dark:divide-white/10">
              {rows.map((r) => (
                <tr
                  key={r.student_id}
                  className="bg-background/50 transition-colors hover:bg-black/[0.03] dark:bg-transparent dark:hover:bg-white/[0.04]"
                >
                  <Cell className="sticky left-0 z-10 max-w-[12rem] truncate bg-surface font-medium shadow-[1px_0_0_0_var(--tw-shadow-color)] shadow-black/10 dark:bg-surface dark:shadow-white/10">
                    {r.survey_name?.trim() || "—"}
                  </Cell>
                  <Cell
                    className="sticky left-[9rem] z-10 max-w-[14rem] truncate bg-surface text-muted shadow-[1px_0_0_0_var(--tw-shadow-color)] shadow-black/10 dark:bg-surface dark:shadow-white/10"
                    title={r.email}
                  >
                    {r.email || "—"}
                  </Cell>
                  <Cell className="max-w-[10rem] truncate" title={r.survey_degree_title ?? undefined}>
                    {r.survey_degree_title ?? "—"}
                  </Cell>
                  <Cell className="whitespace-nowrap">{r.survey_year ?? "—"}</Cell>
                  <Cell className="max-w-[12rem] whitespace-normal text-sm leading-snug text-muted">
                    {formatAlevelTitlesJson(r.survey_alevel_or_equivalent_titles)}
                  </Cell>
                  <Cell className="max-w-[9rem] truncate text-muted" title={r.survey_ancillary_module ?? undefined}>
                    {r.survey_ancillary_module ?? "—"}
                  </Cell>
                  <Cell className="whitespace-nowrap text-muted">{formatCompletedAt(r.profile_survey_completed_at)}</Cell>
                  <Cell className={`text-center ${sectionBorder}`}>{r.survey_confidence_coding ?? "—"}</Cell>
                  <Cell className="text-center">{r.survey_confidence_written_reports ?? "—"}</Cell>
                  <Cell className="text-center">{r.survey_confidence_presentation_public_speaking ?? "—"}</Cell>
                  <Cell className="text-center">{r.survey_confidence_mathematical_literacy ?? "—"}</Cell>
                  <Cell className="text-center">{r.survey_confidence_abstract_complex_content ?? "—"}</Cell>
                  <Cell className="text-center">{r.survey_confidence_conflict_resolution ?? "—"}</Cell>
                  <Cell className={`text-center ${sectionBorder}`}>{r.survey_approach_deadline ?? "—"}</Cell>
                  <Cell className="text-center">{r.survey_approach_discussion ?? "—"}</Cell>
                  <Cell className="text-center">{r.survey_approach_disagreement ?? "—"}</Cell>
                  <Cell className="text-center">{r.survey_approach_new_concepts ?? "—"}</Cell>
                  <Cell className="text-center">{r.survey_approach_communication ?? "—"}</Cell>
                  <Cell className="text-center">{r.survey_approach_teammate_work ?? "—"}</Cell>
                  <Cell className="text-center">{r.survey_approach_heavy_workload ?? "—"}</Cell>
                  <Cell className="text-center">{r.survey_approach_group_project_role ?? "—"}</Cell>
                  <Cell className="text-center">{r.survey_approach_critical_feedback ?? "—"}</Cell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-black/6 px-4 py-3 text-xs text-muted dark:border-white/10">
          <span className="font-medium text-foreground">Confidence:</span> Code · Write · Speak · Maths · Abstr. ·
          Conf. ·{" "}
          <span className="font-medium text-foreground">Collaboration:</span> Dln. · Disc. · Disagr. · New · Comm. ·
          Team · Load · Role · Fdbk.
        </p>
      </div>
    </div>
  );
}
