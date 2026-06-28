"use client";

import { useState, useEffect } from "react";
import { createStudentBrowserClient } from "@/lib/supabase/student-browser-client";

export function PostProjectSkillUpdateForm({ assignmentId }: { assignmentId: string }) {
  const [values, setValues] = useState<any>({
    survey_confidence_coding: 3,
    survey_confidence_written_reports: 3,
    survey_confidence_presentation_public_speaking: 3,
    survey_confidence_mathematical_literacy: 3,
    survey_confidence_abstract_complex_content: 3,
    survey_confidence_conflict_resolution: 3,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const supabase = createStudentBrowserClient();

  const [submittedRow, setSubmittedRow] = useState<any | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const sessionResp = await supabase.auth.getSession();
      const session = sessionResp.data?.session;
      const token = session?.access_token;
      if (!token) {
        setMessage("Not authenticated. Refresh and try again.");
        setIsSubmitting(false);
        return;
      }

      const { data: rpcData, error: rpcError } = await supabase.rpc("rpc_submit_post_project_skill_update", {
        p_assignment_id: assignmentId,
        p_survey_confidence_coding: values.survey_confidence_coding,
        p_survey_confidence_written_reports: values.survey_confidence_written_reports,
        p_survey_confidence_presentation_public_speaking: values.survey_confidence_presentation_public_speaking,
        p_survey_confidence_mathematical_literacy: values.survey_confidence_mathematical_literacy,
        p_survey_confidence_abstract_complex_content: values.survey_confidence_abstract_complex_content,
        p_survey_confidence_conflict_resolution: values.survey_confidence_conflict_resolution,
      });

      if (rpcError) {
        setMessage(rpcError.message || JSON.stringify(rpcError));
      } else if (rpcData?.error) {
        setMessage(String(rpcData.error));
      } else {
        setMessage("Skills updated for post-project phase.");
        setSubmittedRow({ ...values, submitted_at: new Date().toISOString() });
      }
    } catch (err: any) {
      setMessage(err.message || "Network error");
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    async function checkExisting() {
      try {
        const sessionResp = await supabase.auth.getSession();
        const session = sessionResp.data?.session;
        const token = session?.access_token;
        if (!token) return;

        const { data, error } = await supabase
          .from("post_project_skill_updates")
          .select("*")
          .eq("assignment_id", assignmentId)
          .limit(1);

        if (error) {
          return;
        }

        if (mounted && data && data.length > 0) {
          setSubmittedRow(data[0]);
          setMessage("You have already submitted a post-project update for this assignment.");
        }
      } catch {
        // ignore errors
      }
    }
    void checkExisting();
    return () => {
      mounted = false;
    };
  }, [assignmentId, supabase]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border p-4 bg-surface">
      <h3 className="text-sm font-semibold">Post-project skill update</h3>
      <p className="text-xs text-muted">After the assignment due date passes, you can update how confident you feel now (1–5).</p>

      {submittedRow ? (
        <div className="space-y-2">
          {Object.entries(values).map(([k]) => (
            <div key={k} className="flex items-center justify-between text-sm">
              <span className="capitalize">{k.replace("survey_confidence_", "").replace(/_/g, " ")}</span>
              <div className="flex items-center gap-2">
                <span className="min-w-6 text-xs tabular-nums">{String(submittedRow[k])}</span>
              </div>
            </div>
          ))}
          <p className="text-xs text-muted">Submitted at: {new Date(submittedRow.submitted_at).toLocaleString()}</p>
        </div>
      ) : (
        Object.entries(values).map(([k, v]) => (
          <label key={k} className="flex items-center justify-between text-sm">
            <span className="capitalize">{k.replace("survey_confidence_", "").replace(/_/g, " ")}</span>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={1}
                max={5}
                value={v as number}
                onChange={(e) => setValues((prev: any) => ({ ...prev, [k]: Number(e.target.value) }))}
              />
              <span className="min-w-6 text-xs tabular-nums">{String(v)}</span>
            </div>
          </label>
        ))
      )}

      <div className="flex items-center gap-2">
        <button className="rounded bg-brand px-3 py-1 text-white" disabled={isSubmitting || !!submittedRow}>
          {submittedRow ? "Submitted" : isSubmitting ? "Submitting..." : "Submit updates"}
        </button>
        {message ? <div className="text-sm text-muted">{message}</div> : null}
      </div>
    </form>
  );
}
