"use client";

import { useMemo, useState } from "react";
import { createStudentBrowserClient } from "@/lib/supabase/student-browser-client";

interface FeedbackModalProps {
  open: boolean;
  teamName: string;
  teamId: string;
  onClose: () => void;
  onSubmitted: () => void;
}

const RATINGS = [1, 2, 3, 4, 5] as const;

export function FeedbackModal({ open, teamName, teamId, onClose, onSubmitted }: FeedbackModalProps) {
  const [skillMatch, setSkillMatch] = useState<number | null>(null);
  const [styleMatch, setStyleMatch] = useState<number | null>(null);
  const [overallSatisfaction, setOverallSatisfaction] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canSubmit = skillMatch !== null && styleMatch !== null && overallSatisfaction !== null;

  const ratingLabel = useMemo(
    () => (value: number) => {
      switch (value) {
        case 1:
          return "Poor";
        case 2:
          return "Fair";
        case 3:
          return "Okay";
        case 4:
          return "Good";
        case 5:
          return "Excellent";
        default:
          return "";
      }
    },
    [],
  );

  async function handleSubmit() {
    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const supabase = createStudentBrowserClient();
    const userResult = await supabase.auth.getUser();

    if (!userResult.data.user?.id) {
      setSubmitError("Unable to identify your account. Please refresh and try again.");
      setIsSubmitting(false);
      return;
    }

    const payload = {
      student_id: userResult.data.user.id,
      team_id: teamId,
      skill_match: skillMatch,
      style_match: styleMatch,
      overall_satisfaction_rating: overallSatisfaction,
    };

    const { error } = await supabase.from("feedback").insert(payload);

    if (error) {
      setSubmitError(error.message || "Failed to submit feedback.");
      setIsSubmitting(false);
      return;
    }

    onSubmitted();
    onClose();
    setIsSubmitting(false);
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-3xl border border-black/10 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-zinc-950 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">Instant Sentiment</p>
            <h2 className="mt-3 text-xl font-semibold text-foreground">How did your team feel?</h2>
            <p className="mt-2 text-sm text-muted">Share your first impression of the team you just saw.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted transition hover:bg-black/5 hover:text-foreground"
            aria-label="Close feedback modal"
          >
            ✕
          </button>
        </div>

        <div className="mt-8 space-y-6">
          {[
            { key: "skillMatch", label: "Skill Match" },
            { key: "styleMatch", label: "Style Match" },
            { key: "overallSatisfaction", label: "Overall Satisfaction" },
          ].map((field) => {
            const value = field.key === "skillMatch" ? skillMatch : field.key === "styleMatch" ? styleMatch : overallSatisfaction;
            const setValue = field.key === "skillMatch" ? setSkillMatch : field.key === "styleMatch" ? setStyleMatch : setOverallSatisfaction;

            return (
              <div key={field.key} className="rounded-3xl bg-surface p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-foreground">{field.label}</h3>
                  <span className="text-xs text-muted">{value ? ratingLabel(value) : "Choose a rating"}</span>
                </div>
                <div className="mt-4 grid grid-cols-5 gap-2">
                  {RATINGS.map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => setValue(rating)}
                      className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition ${
                        value === rating
                          ? "border-brand bg-brand text-white"
                          : "border-black/10 bg-white text-foreground hover:border-black/20 dark:border-white/10 dark:bg-zinc-950 dark:text-white"
                      }`}
                    >
                      {rating}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {submitError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {submitError}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs text-muted">Your ratings are anonymous and help improve the next matching batch.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-black/10 bg-background px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-black/[0.03] dark:border-white/15 dark:bg-zinc-900"
              >
                Later
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit || isSubmitting}
                className="rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "Submitting…" : "Submit feedback"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
