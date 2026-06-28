"use client";

import { useState } from "react";
import { createStudentBrowserClient } from "@/lib/supabase/student-browser-client";
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
  max_team_size: number;
  ai_preferences: {
    focus_skills: boolean;
    focus_working_style: boolean;
    focus_availability: boolean;
    balance_diversity: boolean;
  };
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
    max_team_size: 3,
    ai_preferences: {
      focus_skills: true,
      focus_working_style: true,
      focus_availability: true,
      balance_diversity: true,
    },
  });

  const supabase = createStudentBrowserClient();

  const updatePreference = (key: keyof AssignmentFormData["ai_preferences"], value: boolean) => {
    setFormData((prev) => ({
      ...prev,
      ai_preferences: {
        ...prev.ai_preferences,
        [key]: value,
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
              <label htmlFor="max_team_size" className="block text-sm font-medium text-foreground">
                Maximum Team Size
              </label>
              <select
                id="max_team_size"
                value={formData.max_team_size}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, max_team_size: parseInt(e.target.value) }))
                }
                className="mt-1 block w-full rounded-xl border border-black/10 bg-background px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/15"
              >
                {[2, 3, 4, 5, 6].map((size) => (
                  <option key={size} value={size}>
                    {size} students
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-medium text-foreground">AI Matching Preferences</h3>
            <p className="mb-4 text-xs text-muted">
              Choose what the AI should focus on when creating teams for this assignment.
            </p>

            <div className="space-y-3">
              {[
                {
                  key: "focus_skills" as const,
                  label: "Skill complementarity",
                  description: "Match students with different technical skills",
                },
                {
                  key: "focus_working_style" as const,
                  label: "Working style compatibility",
                  description: "Consider communication and deadline preferences",
                },
                {
                  key: "focus_availability" as const,
                  label: "Schedule compatibility",
                  description: "Match students with similar availability",
                },
                {
                  key: "balance_diversity" as const,
                  label: "Balance team diversity",
                  description: "Create diverse teams with varied backgrounds",
                },
              ].map(({ key, label, description }) => (
                <label key={key} className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={formData.ai_preferences[key]}
                    onChange={(e) => updatePreference(key, e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-black/20 text-brand focus:ring-brand dark:border-white/20"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-foreground">{label}</div>
                    <div className="text-xs text-muted">{description}</div>
                  </div>
                </label>
              ))}
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
