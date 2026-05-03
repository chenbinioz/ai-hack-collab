"use client";

import { useEffect, useMemo, useState } from "react";
import { useStudentAuth } from "@/app/providers";
import { createStudentBrowserClient } from "@/lib/supabase/student-browser-client";

type StudentProfile = {
  survey_name: string | null;
  survey_confidence_coding: number | null;
  survey_confidence_written_reports: number | null;
  survey_confidence_presentation_public_speaking: number | null;
  survey_confidence_mathematical_literacy: number | null;
  survey_confidence_abstract_complex_content: number | null;
  survey_confidence_conflict_resolution: number | null;
  survey_approach_deadline: number | null;
  survey_approach_discussion: number | null;
  survey_approach_disagreement: number | null;
  survey_approach_new_concepts: number | null;
  survey_approach_communication: number | null;
  survey_approach_teammate_work: number | null;
  survey_approach_heavy_workload: number | null;
  survey_approach_group_project_role: number | null;
  survey_approach_critical_feedback: number | null;
};

const SKILL_RECOMMENDATIONS = {
  survey_confidence_coding: {
    title: "Coding support",
    text: "Pair with a teammate who can own the first implementation draft, then swap for review and explanation.",
    resource: "Use a 20-minute code-along session before splitting into independent tasks.",
  },
  survey_confidence_written_reports: {
    title: "Writing support",
    text: "Use a shared outline and assign a single owner for the first structure pass.",
    resource: "Try a report skeleton with headings, claims, evidence, and action items.",
  },
  survey_confidence_presentation_public_speaking: {
    title: "Presentation support",
    text: "Give yourself a speaking role early so you can rehearse while the work is still fluid.",
    resource: "Use a 3-slide rehearsal: opening, evidence, and close.",
  },
  survey_confidence_mathematical_literacy: {
    title: "Quant support",
    text: "Ask for a teammate to sanity-check equations or calculations before you lock the result.",
    resource: "Run a worked-example checkpoint after every major calculation.",
  },
  survey_confidence_abstract_complex_content: {
    title: "Concept support",
    text: "Break hard ideas into plain-language summaries before the group makes decisions.",
    resource: "Use the 'explain it twice' technique: technical version, then plain version.",
  },
  survey_confidence_conflict_resolution: {
    title: "Conflict support",
    text: "Use a moderator or facilitator role when disagreements start to slow the group down.",
    resource: "Try a check-in script: issue, impact, request, next step.",
  },
} as const;

const WORKING_STYLE_RECOMMENDATIONS = [
  {
    title: "Deadline rhythm",
    text: "Your deadline preference suggests whether you should plan for early hand-offs or a tighter sprint window.",
  },
  {
    title: "Communication cadence",
    text: "Your discussion and communication scores can be translated into how often the group should meet.",
  },
  {
    title: "Friction check",
    text: "Your disagreement and critical-feedback answers help flag whether the team should use more structure in check-ins.",
  },
] as const;

function scaleLabel(value: number | null | undefined) {
  if (value == null) return "Unknown";
  if (value >= 4) return "High";
  if (value >= 3) return "Moderate";
  return "Needs support";
}

export function CollaborationCoach() {
  const { user, isStudentAuthLoading } = useStudentAuth();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createStudentBrowserClient();

    async function loadProfile() {
      if (isStudentAuthLoading) return;

      if (!user?.id) {
        setError("Not authenticated");
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc("get_student_profile_survey", {});
        if (cancelled) return;

        if (error) {
          setError(error.message || "Failed to load collaboration coaching data");
          return;
        }

        const profileData = Array.isArray(data) ? data[0] : data;
        setProfile((profileData as StudentProfile | null) ?? null);
      } catch {
        setError("Failed to load collaboration coaching data");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [user, isStudentAuthLoading]);

  const recommendations = useMemo(() => {
    if (!profile) return [];

    const scoredSkills = Object.entries(SKILL_RECOMMENDATIONS)
      .map(([key, info]) => ({ key, info, value: profile[key as keyof StudentProfile] as number | null }))
      .sort((a, b) => (a.value ?? 99) - (b.value ?? 99));

    const lowestSkill = scoredSkills[0];
    const nextSkill = scoredSkills[1];

    const baseCards = [
      {
        title: lowestSkill?.info.title ?? "Team support",
        text: lowestSkill?.info.text ?? "Use a shared check-in rhythm to keep the group aligned.",
        resource: lowestSkill?.info.resource ?? "Keep a short action list for the next meeting.",
      },
      {
        title: "Best-fit meeting style",
        text: `You read as ${scaleLabel(profile.survey_approach_communication)} for structured communication and ${scaleLabel(profile.survey_approach_discussion)} for discussion-first teamwork.`,
        resource: "Match the meeting format to the situation: quick async updates or a formal check-in.",
      },
      {
        title: "Early friction signal",
        text: `Your disagreement and feedback preferences suggest a ${scaleLabel(profile.survey_confidence_conflict_resolution)}-confidence route for handling tension.`,
        resource: "Use a moderator, a decision owner, or a written follow-up when a conversation starts to drift.",
      },
    ];

    if (nextSkill) {
      baseCards.push({
        title: nextSkill.info.title,
        text: `A second useful support area is ${nextSkill.info.title.toLowerCase()}.`,
        resource: nextSkill.info.resource,
      });
    }

    return baseCards;
  }, [profile]);

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-black/10 bg-surface p-6 shadow-sm dark:border-white/10">
        <p className="text-sm text-muted">Loading your collaboration coach…</p>
      </section>
    );
  }

  if (error || !profile) {
    return (
      <section className="rounded-2xl border border-black/10 bg-surface p-6 shadow-sm dark:border-white/10">
        <h2 className="text-lg font-semibold text-foreground">Collaboration coach</h2>
        <p className="mt-2 text-sm text-muted">
          Complete your survey to unlock personalised prompts, resources, and reflection suggestions.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-black/10 bg-surface p-6 shadow-sm dark:border-white/10 sm:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Collaboration coach</p>
          <h2 className="mt-2 text-xl font-semibold text-foreground">Personalised prompts for better teamwork</h2>
        </div>
        <p className="text-sm text-muted">A lightweight recommendation layer based on your survey responses.</p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {recommendations.map((item) => (
          <article key={item.title} className="rounded-3xl border border-black/5 bg-black/[0.02] p-5 dark:border-white/10 dark:bg-white/[0.04]">
            <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted">{item.text}</p>
            <p className="mt-3 rounded-2xl bg-background px-4 py-3 text-sm text-foreground shadow-sm dark:bg-zinc-950">
              {item.resource}
            </p>
          </article>
        ))}
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {WORKING_STYLE_RECOMMENDATIONS.map((item) => (
          <div key={item.title} className="rounded-2xl border border-black/5 bg-background p-4 dark:border-white/10 dark:bg-zinc-950">
            <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted">{item.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}