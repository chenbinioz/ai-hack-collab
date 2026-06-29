"use client";

import { useState } from "react";
import { createStudentBrowserClient } from "@/lib/supabase/student-browser-client";
import { MatchingFocusPreferencesPicker } from "@/components/matching-focus-preferences-picker";
import { SkillPreferencesPicker } from "@/components/skill-preferences-picker";
import {
  DEFAULT_AI_PREFERENCES,
  type AiPreferences,
} from "@/lib/matching/skill-preferences";
import {
  AssignmentAttachmentsPanel,
  uploadPendingAssignmentFiles,
} from "./assignment-attachments-panel";

interface CreateAssignmentModalProps {
  classId: string;
  onClose: () => void;
  onAssignmentCreated: () => void;
}

interface AssignmentFormData {
  title: string;
  description: string;
  due_date: string;
  ideal_team_size: number;
  ai_preferences: AiPreferences;
}

export function CreateAssignmentModal({
  classId,
  onClose,
  onAssignmentCreated,
}: CreateAssignmentModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [formData, setFormData] = useState<AssignmentFormData>({
    title: "",
    description: "",
    due_date: "",
    ideal_team_size: 3,
    ai_preferences: { ...DEFAULT_AI_PREFERENCES },
  });

  const supabase = createStudentBrowserClient();

  const updateWantedSkills = (wanted_skills: AiPreferences["wanted_skills"]) => {
    setFormData((prev) => ({
      ...prev,
      ai_preferences: {
        ...prev.ai_preferences,
        wanted_skills,
        focus_skills: wanted_skills.length > 0,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      setError("Assignment title is required");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Not authenticated");
        return;
      }

      const response = await fetch(`/api/educator/classes/${classId}/assignments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create assignment");
      }

      const { assignment } = await response.json();

      if (pendingFiles.length > 0 && assignment?.id) {
        const { uploaded, errors: uploadErrors } = await uploadPendingAssignmentFiles(
          classId,
          assignment.id,
          pendingFiles,
          session.access_token,
        );
        if (uploadErrors.length > 0) {
          setUploadWarnings([
            `Assignment created. ${uploaded} of ${pendingFiles.length} file(s) uploaded.`,
            ...uploadErrors,
          ]);
        }
      }

      onAssignmentCreated();
    } catch (err: any) {
      console.error("Error creating assignment:", err);
      setError(err.message || "Failed to create assignment");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-background p-6 shadow-xl">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground">Add Assignment</h2>
          <p className="mt-1 text-sm text-muted">
            Create a new assignment with its own deadline, team settings, and team generation.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-foreground">
                Title *
              </label>
              <input
                id="title"
                type="text"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Project 1"
                className="mt-1 block w-full rounded-xl border border-black/10 bg-background px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/15"
                required
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-foreground">
                Description
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Optional assignment description"
                rows={3}
                className="mt-1 block w-full rounded-xl border border-black/10 bg-background px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/15"
              />
            </div>

            <div>
              <label htmlFor="due_date" className="block text-sm font-medium text-foreground">
                Due Date
              </label>
              <input
                id="due_date"
                type="datetime-local"
                value={formData.due_date}
                onChange={(e) => setFormData((prev) => ({ ...prev, due_date: e.target.value }))}
                className="mt-1 block w-full rounded-xl border border-black/10 bg-background px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/15"
              />
              <p className="mt-1 text-xs text-muted">
                Optional. Students will see a countdown for this assignment.
              </p>
            </div>

            <div>
              <label htmlFor="ideal_team_size" className="block text-sm font-medium text-foreground">
                Ideal team size
              </label>
              <select
                id="ideal_team_size"
                value={formData.ideal_team_size}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, ideal_team_size: parseInt(e.target.value) }))
                }
                className="mt-1 block w-full rounded-xl border border-black/10 bg-background px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/15"
              >
                {[2, 3, 4, 5, 6].map((size) => (
                  <option key={size} value={size}>
                    {size} students
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted">
                Teams will be generated to match this size when possible.
              </p>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-medium text-foreground">AI Matching Preferences</h3>
            <p className="mb-4 text-xs text-muted">
              Choose what the AI should focus on when creating teams for this assignment.
            </p>

            <div className="space-y-4">
              <MatchingFocusPreferencesPicker
                preferences={formData.ai_preferences}
                onChange={(ai_preferences) =>
                  setFormData((prev) => ({ ...prev, ai_preferences }))
                }
              />

              <SkillPreferencesPicker
                selected={formData.ai_preferences.wanted_skills}
                onChange={updateWantedSkills}
              />
            </div>
          </div>

          <AssignmentAttachmentsPanel
            classId={classId}
            assignmentId={null}
            mode="create"
            pendingFiles={pendingFiles}
            onPendingFilesChange={setPendingFiles}
          />

          {uploadWarnings.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
              {uploadWarnings.map((warning) => (
                <p key={warning} className="text-sm text-amber-800 dark:text-amber-200">
                  {warning}
                </p>
              ))}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/30">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-black/5 pt-4 dark:border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-black/10 bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-black/[0.03] dark:border-white/15 dark:hover:bg-white/[0.06]"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Creating..." : "Create Assignment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
