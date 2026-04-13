"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStudentAuth } from "@/app/providers";
import { createStudentBrowserClient } from "@/lib/supabase/student-browser-client";
import {
  SURVEY_ALEVEL_OR_EQUIVALENT_OPTIONS,
  SURVEY_ANCILLARY_MODULE_OPTIONS,
  SURVEY_DEGREE_OPTIONS,
  SURVEY_YEAR_OPTIONS,
} from "@/lib/student-profile-survey-constants";
import { hasStudentSupabaseEnv } from "@/lib/supabase/student-env";
import { SupabaseEnvMissingBanner } from "@/components/supabase-env-missing-banner";

const inputClassName =
  "mt-1.5 w-full rounded-xl border border-black/10 bg-background px-3.5 py-2.5 text-foreground outline-none ring-brand/0 transition placeholder:text-muted/70 focus:border-brand/40 focus:ring-2 focus:ring-brand/20 disabled:opacity-60 dark:border-white/15";
const selectClassName = inputClassName;
const labelClassName = "block text-sm font-medium text-foreground";

const CONFIDENCE_SCALE_HINT = "1 = not confident at all · 5 = very confident";

type SurveyFormState = {
  name: string;
  degreeTitle: string;
  year: "" | (typeof SURVEY_YEAR_OPTIONS)[number];
  alevelTitles: string[];
  ancillaryModule: string;
  confidence: {
    coding: number;
    written_reports: number;
    presentation_public_speaking: number;
    mathematical_literacy: number;
    abstract_complex_content: number;
    conflict_resolution: number;
  };
  approach: {
    deadline: number;
    discussion: number;
    disagreement: number;
    new_concepts: number;
    communication: number;
    teammate_work: number;
    heavy_workload: number;
    group_project_role: number;
    critical_feedback: number;
  };
};

const CONFIDENCE_ITEMS: { key: keyof SurveyFormState["confidence"]; label: string }[] = [
  { key: "coding", label: "Coding" },
  { key: "written_reports", label: "Written reports" },
  { key: "presentation_public_speaking", label: "Presentation / public speaking" },
  { key: "mathematical_literacy", label: "Mathematical literacy" },
  { key: "abstract_complex_content", label: "Understanding abstract / complex content" },
  { key: "conflict_resolution", label: "Conflict resolution" },
];

const APPROACH_ITEMS: {
  key: keyof SurveyFormState["approach"];
  prompt: string;
  left: string;
  right: string;
}[] = [
  {
    key: "deadline",
    prompt: "When given a deadline, I work better:",
    left: "Steadily over time",
    right: "Under pressure nearer the deadline",
  },
  {
    key: "discussion",
    prompt: "In discussions, I prefer to:",
    left: "Listen first",
    right: "Take the lead",
  },
  {
    key: "disagreement",
    prompt: "When disagreements happen, I prefer to:",
    left: "Address issues directly when they arise",
    right: "Not address issues to avoid confrontation",
  },
  {
    key: "new_concepts",
    prompt: "I understand new concepts best when:",
    left: "Work through it myself",
    right: "Work through it with others",
  },
  {
    key: "communication",
    prompt: "Communication is most useful to me when it is:",
    left: "Frequent and informal (e.g. texts)",
    right: "Structured and formal (scheduled meetings)",
  },
  {
    key: "teammate_work",
    prompt: "When a teammate's work doesn't meet my expectations, I would rather:",
    left: "Do it myself",
    right: "Discuss it",
  },
  {
    key: "heavy_workload",
    prompt: "When workload gets heavy, I would rather:",
    left: "Work independently and manage it myself",
    right: "Reach out to the team to redistribute tasks",
  },
  {
    key: "group_project_role",
    prompt: "When contributing to a group project, I prefer:",
    left: "Doing focused, individual tasks",
    right: "Coordinating people and keeping the group on track",
  },
  {
    key: "critical_feedback",
    prompt: "When I receive critical feedback, my instinct is to:",
    left: "Defend my choices and explain my reasoning",
    right: "Listen, accept it and revise",
  },
];

function defaultSurveyFormState(): SurveyFormState {
  return {
    name: "",
    degreeTitle: "",
    year: "",
    alevelTitles: [],
    ancillaryModule: "",
    confidence: {
      coding: 3,
      written_reports: 3,
      presentation_public_speaking: 3,
      mathematical_literacy: 3,
      abstract_complex_content: 3,
      conflict_resolution: 3,
    },
    approach: {
      deadline: 3,
      discussion: 3,
      disagreement: 3,
      new_concepts: 3,
      communication: 3,
      teammate_work: 3,
      heavy_workload: 3,
      group_project_role: 3,
      critical_feedback: 3,
    },
  };
}

function ScaleSlider({
  id,
  value,
  onChange,
  leftLabel,
  rightLabel,
  disabled,
}: {
  id: string;
  value: number;
  onChange: (n: number) => void;
  leftLabel: string;
  rightLabel: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted">{leftLabel}</span>
        <span
          className="min-w-8 rounded-md bg-black/[0.06] px-2 py-0.5 text-center text-sm font-semibold tabular-nums text-foreground dark:bg-white/10"
          aria-live="polite"
        >
          {value}
        </span>
        <span className="text-xs text-muted">{rightLabel}</span>
      </div>
      <input
        id={id}
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-black/10 accent-brand disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white/15"
        aria-valuemin={1}
        aria-valuemax={5}
        aria-valuenow={value}
        aria-valuetext={`${value} out of 5`}
      />
    </div>
  );
}

export function StudentProfileSurveyPage() {
  const router = useRouter();
  const { user, isStudentAuthLoading } = useStudentAuth();
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<SurveyFormState>(() => defaultSurveyFormState());
  const [acceptedFinal, setAcceptedFinal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (isStudentAuthLoading || !user) {
      queueMicrotask(() => {
        if (cancelled) return;
        setIsProfileLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }

    if (!hasStudentSupabaseEnv()) {
      queueMicrotask(() => {
        if (cancelled) return;
        setIsProfileLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }

    queueMicrotask(() => {
      if (cancelled) return;
      setIsProfileLoading(true);
    });

    void (async () => {
      const supabase = createStudentBrowserClient();
      const { data, error } = await supabase.rpc("student_profile_survey_completed");

      if (cancelled) return;

      queueMicrotask(() => {
        if (cancelled) return;
        if (error) {
          setAlreadyCompleted(false);
          setIsProfileLoading(false);
          return;
        }
        if (data === true) {
          setAlreadyCompleted(true);
          router.replace("/student");
          return;
        }
        setAlreadyCompleted(false);
        setIsProfileLoading(false);
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [user, isStudentAuthLoading, router]);

  function toggleAlevel(title: string) {
    setForm((prev) => {
      const has = prev.alevelTitles.includes(title);
      return {
        ...prev,
        alevelTitles: has ? prev.alevelTitles.filter((t) => t !== title) : [...prev.alevelTitles, title],
      };
    });
  }

  function validateStep0(): boolean {
    if (!form.name.trim()) {
      setPageError("Enter your name.");
      return false;
    }
    if (!form.degreeTitle) {
      setPageError("Select your degree title.");
      return false;
    }
    if (!form.year) {
      setPageError("Select your year of study.");
      return false;
    }
    if (form.alevelTitles.length < 1) {
      setPageError("Select at least one A-Level or equivalent title.");
      return false;
    }
    if (!form.ancillaryModule) {
      setPageError("Select an ancillary module.");
      return false;
    }
    return true;
  }

  function goNext() {
    setPageError(null);
    if (step === 0 && !validateStep0()) return;
    setStep((s) => Math.min(s + 1, 2));
  }

  function goBack() {
    setPageError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);
    setPageError(null);

    if (!validateStep0()) {
      setStep(0);
      return;
    }

    if (!user || !hasStudentSupabaseEnv()) {
      setSubmitError("Supabase is not configured or you are not signed in.");
      return;
    }

    if (!acceptedFinal) {
      setSubmitError("Confirm that you understand your answers will be final.");
      return;
    }

    const alevelSorted = [...form.alevelTitles].sort();

    setIsSubmitting(true);
    try {
      const supabase = createStudentBrowserClient();
      const p_payload = {
        survey_name: form.name.trim(),
        survey_degree_title: form.degreeTitle,
        survey_year: form.year,
        survey_alevel_or_equivalent_titles: alevelSorted,
        survey_ancillary_module: form.ancillaryModule,
        survey_confidence_coding: form.confidence.coding,
        survey_confidence_written_reports: form.confidence.written_reports,
        survey_confidence_presentation_public_speaking: form.confidence.presentation_public_speaking,
        survey_confidence_mathematical_literacy: form.confidence.mathematical_literacy,
        survey_confidence_abstract_complex_content: form.confidence.abstract_complex_content,
        survey_confidence_conflict_resolution: form.confidence.conflict_resolution,
        survey_approach_deadline: form.approach.deadline,
        survey_approach_discussion: form.approach.discussion,
        survey_approach_disagreement: form.approach.disagreement,
        survey_approach_new_concepts: form.approach.new_concepts,
        survey_approach_communication: form.approach.communication,
        survey_approach_teammate_work: form.approach.teammate_work,
        survey_approach_heavy_workload: form.approach.heavy_workload,
        survey_approach_group_project_role: form.approach.group_project_role,
        survey_approach_critical_feedback: form.approach.critical_feedback,
      };

      const { error } = await supabase.rpc("submit_student_profile_survey", { p_payload });

      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("final") || msg.includes("cannot be changed")) {
          setSubmitError("This survey was already submitted and cannot be changed.");
        } else if (msg.includes("infinite recursion")) {
          setSubmitError(
            "Database RLS issue: run supabase/migrations/005_submit_student_profile_survey_rpc.sql in the Supabase SQL Editor, then submit again.",
          );
        } else {
          setSubmitError(error.message);
        }
        return;
      }

      router.replace("/student");
      router.refresh();
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isStudentAuthLoading || isProfileLoading || alreadyCompleted) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center px-4">
        <p className="text-sm text-muted">Loading survey…</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const disabledControls = isSubmitting || !hasStudentSupabaseEnv();

  return (
    <div className="flex min-h-full flex-col bg-background">
      <header className="border-b border-black/5 px-4 py-4 dark:border-white/10 sm:px-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand">Student space</p>
            <p className="text-sm font-semibold text-foreground">Profile survey</p>
          </div>
          <Link
            href="/student"
            className="text-sm font-medium text-brand transition hover:text-brand-deep dark:hover:text-brand"
          >
            ← Back to your space
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Student profile survey</h1>
        <p className="mt-2 text-sm text-muted">
          Page {step + 1} of 3 — your answers help module leads form fairer cohorts.
        </p>

        <div
          className="mt-6 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100"
          role="note"
        >
          <strong className="font-semibold">Important:</strong> once you submit this survey on the last page, you
          cannot go back and change any of your answers. Review each page before continuing.
        </div>

        <SupabaseEnvMissingBanner />

        <form className="mt-8 space-y-8" onSubmit={step === 2 ? handleSubmit : (e) => e.preventDefault()} noValidate>
          {submitError ? (
            <p
              className="rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-200"
              role="alert"
            >
              {submitError}
            </p>
          ) : null}
          {pageError ? (
            <p
              className="rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-200"
              role="alert"
            >
              {pageError}
            </p>
          ) : null}

          {step === 0 ? (
            <section className="space-y-6" aria-labelledby="survey-p1-heading">
              <h2 id="survey-p1-heading" className="text-lg font-semibold text-foreground">
                Page 1: Information
              </h2>

              <div>
                <label htmlFor="survey-name" className={labelClassName}>
                  Name
                </label>
                <input
                  id="survey-name"
                  name="survey_name"
                  type="text"
                  autoComplete="name"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  disabled={disabledControls}
                  className={inputClassName}
                  placeholder="Your name"
                />
              </div>

              <div>
                <label htmlFor="survey-degree" className={labelClassName}>
                  Degree title
                </label>
                <select
                  id="survey-degree"
                  name="survey_degree_title"
                  value={form.degreeTitle}
                  onChange={(e) => setForm((p) => ({ ...p, degreeTitle: e.target.value }))}
                  disabled={disabledControls}
                  className={selectClassName}
                >
                  <option value="">Select degree…</option>
                  {SURVEY_DEGREE_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="survey-year" className={labelClassName}>
                  Year
                </label>
                <select
                  id="survey-year"
                  name="survey_year"
                  value={form.year === "" ? "" : String(form.year)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm((p) => ({
                      ...p,
                      year: v === "" ? "" : (Number(v) as (typeof SURVEY_YEAR_OPTIONS)[number]),
                    }));
                  }}
                  disabled={disabledControls}
                  className={selectClassName}
                >
                  <option value="">Select year…</option>
                  {SURVEY_YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>
                      Year {y}
                    </option>
                  ))}
                </select>
              </div>

              <fieldset className="space-y-3">
                <legend className={labelClassName}>A-Level or equivalent titles (select all that apply)</legend>
                <p className="text-xs text-muted">You can choose more than one.</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SURVEY_ALEVEL_OR_EQUIVALENT_OPTIONS.map((title) => {
                    const id = `alevel-${title.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "")}`;
                    return (
                      <label
                        key={title}
                        htmlFor={id}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/15"
                      >
                        <input
                          id={id}
                          type="checkbox"
                          checked={form.alevelTitles.includes(title)}
                          onChange={() => toggleAlevel(title)}
                          disabled={disabledControls}
                          className="size-4 rounded border-black/20 text-brand focus:ring-brand/30 dark:border-white/30"
                        />
                        <span>{title}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div>
                <label htmlFor="survey-ancillary" className={labelClassName}>
                  Ancillary module
                </label>
                <select
                  id="survey-ancillary"
                  name="survey_ancillary_module"
                  value={form.ancillaryModule}
                  onChange={(e) => setForm((p) => ({ ...p, ancillaryModule: e.target.value }))}
                  disabled={disabledControls}
                  className={selectClassName}
                >
                  <option value="">Select ancillary module…</option>
                  {SURVEY_ANCILLARY_MODULE_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </section>
          ) : null}

          {step === 1 ? (
            <section className="space-y-8" aria-labelledby="survey-p2-heading">
              <div>
                <h2 id="survey-p2-heading" className="text-lg font-semibold text-foreground">
                  Page 2: Relevant skills
                </h2>
                <p className="mt-1 text-sm text-muted">Rate your confidence. {CONFIDENCE_SCALE_HINT}</p>
              </div>

              {CONFIDENCE_ITEMS.map(({ key, label }) => (
                <div key={key}>
                  <p className={labelClassName}>{label}</p>
                  <ScaleSlider
                    id={`confidence-${key}`}
                    value={form.confidence[key]}
                    onChange={(n) =>
                      setForm((p) => ({
                        ...p,
                        confidence: { ...p.confidence, [key]: n },
                      }))
                    }
                    leftLabel="1 · Not confident"
                    rightLabel="5 · Very confident"
                    disabled={disabledControls}
                  />
                </div>
              ))}
            </section>
          ) : null}

          {step === 2 ? (
            <section className="space-y-8" aria-labelledby="survey-p3-heading">
              <h2 id="survey-p3-heading" className="text-lg font-semibold text-foreground">
                Page 3: Approach to work
              </h2>
              <p className="text-sm text-muted">Each scale runs from 1 (left) to 5 (right).</p>

              {APPROACH_ITEMS.map(({ key, prompt, left, right }) => (
                <div key={key} className="space-y-2 border-b border-black/5 pb-6 last:border-0 dark:border-white/10">
                  <p className="text-sm font-medium text-foreground">{prompt}</p>
                  <ScaleSlider
                    id={`approach-${key}`}
                    value={form.approach[key]}
                    onChange={(n) =>
                      setForm((p) => ({
                        ...p,
                        approach: { ...p.approach, [key]: n },
                      }))
                    }
                    leftLabel={left}
                    rightLabel={right}
                    disabled={disabledControls}
                  />
                </div>
              ))}

              <div className="rounded-xl border border-black/10 bg-black/[0.02] p-4 dark:border-white/15 dark:bg-white/[0.04]">
                <label className="flex cursor-pointer items-start gap-3 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={acceptedFinal}
                    onChange={(e) => setAcceptedFinal(e.target.checked)}
                    disabled={disabledControls}
                    className="mt-1 size-4 shrink-0 rounded border-black/20 text-brand focus:ring-brand/30 dark:border-white/30"
                  />
                  <span>
                    I understand that after I submit this survey, my answers are final and I will not be able to
                    edit them.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={disabledControls}
                className="w-full rounded-xl bg-brand py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Submitting…" : "Submit survey"}
              </button>
            </section>
          ) : null}

          {step < 2 ? (
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={goBack}
                  disabled={disabledControls}
                  className="rounded-xl border border-black/10 bg-background px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-black/[0.03] disabled:opacity-60 dark:border-white/15 dark:hover:bg-white/[0.06]"
                >
                  Back
                </button>
              ) : null}
              <button
                type="button"
                onClick={goNext}
                disabled={disabledControls}
                className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-60"
              >
                Next
              </button>
            </div>
          ) : (
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={goBack}
                disabled={disabledControls}
                className="rounded-xl border border-black/10 bg-background px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-black/[0.03] disabled:opacity-60 dark:border-white/15 dark:hover:bg-white/[0.06]"
              >
                Back
              </button>
            </div>
          )}
        </form>
      </main>
    </div>
  );
}
