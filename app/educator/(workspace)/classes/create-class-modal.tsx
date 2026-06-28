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
}

export function CreateClassModal({ onClose, onClassCreated }: CreateClassModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<ClassFormData>({
    name: "",
    description: "",
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

      onClassCreated();
    } catch (err: any) {
      console.error("Error creating class:", err);
      setError(err.message || "Failed to create class");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-background p-6 shadow-xl">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground">Create New Class</h2>
          <p className="mt-1 text-sm text-muted">
            Set up a class for organizing students and assignments.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-foreground">
                Class Name *
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
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
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description of the class"
                rows={3}
                className="mt-1 block w-full rounded-xl border border-black/10 bg-background px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/15"
              />
            </div>
          </div>

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
              {isLoading ? "Creating..." : "Create Class"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
