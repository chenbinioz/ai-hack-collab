"use client";

import { useState } from "react";
import { createStudentBrowserClient } from "@/lib/supabase/student-browser-client";

interface CreateClassModalProps {
  onClose: () => void;
  onClassCreated: () => void;
}

interface ClassFormData {
  name: string;
  description: string;
  coursework_deadline: string;
  max_team_size: number;
  ai_preferences: {
    focus_skills: boolean;
    focus_working_style: boolean;
    focus_availability: boolean;
    focus_goals: boolean;
    balance_diversity: boolean;
  };
}

export function CreateClassModal({ onClose, onClassCreated }: CreateClassModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<ClassFormData>({
    name: "",
    description: "",
    coursework_deadline: "",
    max_team_size: 3,
    ai_preferences: {
      focus_skills: true,
      focus_working_style: true,
      focus_availability: true,
      focus_goals: true,
      balance_diversity: true,
    },
  });

  const supabase = createStudentBrowserClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError("Class name is required");
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

      const response = await fetch("/api/educator/classes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create class");
      }

      const data = await response.json();
      onClassCreated();
    } catch (err: any) {
      console.error("Error creating class:", err);
      setError(err.message || "Failed to create class");
    } finally {
      setIsLoading(false);
    }
  };

  const updatePreference = (key: keyof ClassFormData["ai_preferences"], value: boolean) => {
    setFormData(prev => ({
      ...prev,
      ai_preferences: {
        ...prev.ai_preferences,
        [key]: value,
      },
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-background p-6 shadow-xl">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground">Create New Class</h2>
          <p className="mt-1 text-sm text-muted">
            Set up a class for organizing students and generating teams.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic info */}
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-foreground">
                Class Name *
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., CS 101 - Fall 2026"
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
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description of the class"
                rows={3}
                className="mt-1 block w-full rounded-xl border border-black/10 bg-background px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/15"
              />
            </div>

            <div>
              <label htmlFor="coursework_deadline" className="block text-sm font-medium text-foreground">
                Coursework Deadline
              </label>
              <input
                id="coursework_deadline"
                type="datetime-local"
                value={formData.coursework_deadline}
                onChange={(e) => setFormData(prev => ({ ...prev, coursework_deadline: e.target.value }))}
                className="mt-1 block w-full rounded-xl border border-black/10 bg-background px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/15"
              />
              <p className="mt-1 text-xs text-muted">
                Optional. Students will see a live countdown on their class page.
              </p>
            </div>

            <div>
              <label htmlFor="max_team_size" className="block text-sm font-medium text-foreground">
                Maximum Team Size
              </label>
              <select
                id="max_team_size"
                value={formData.max_team_size}
                onChange={(e) => setFormData(prev => ({ ...prev, max_team_size: parseInt(e.target.value) }))}
                className="mt-1 block w-full rounded-xl border border-black/10 bg-background px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/15"
              >
                <option value={2}>2 students</option>
                <option value={3}>3 students</option>
                <option value={4}>4 students</option>
                <option value={5}>5 students</option>
                <option value={6}>6 students</option>
              </select>
            </div>
          </div>

          {/* AI Preferences */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3">AI Matching Preferences</h3>
            <p className="text-xs text-muted mb-4">
              Choose what the AI should focus on when creating teams for this class.
            </p>

            <div className="space-y-3">
              {[
                { key: "focus_skills" as const, label: "Skill complementarity", description: "Match students with different technical skills" },
                { key: "focus_working_style" as const, label: "Working style compatibility", description: "Consider communication and deadline preferences" },
                { key: "focus_availability" as const, label: "Schedule compatibility", description: "Match students with similar availability" },
                { key: "focus_goals" as const, label: "Project goals alignment", description: "Group students with similar project interests" },
                { key: "balance_diversity" as const, label: "Balance team diversity", description: "Create diverse teams with varied backgrounds" },
              ].map(({ key, label, description }) => (
                <label key={key} className="flex items-start gap-3 cursor-pointer">
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

          {/* Error message */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/30">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-black/5 dark:border-white/10">
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
              {isLoading ? "Creating..." : "Create Class"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}