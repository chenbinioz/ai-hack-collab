"use client";

import { useState } from "react";
import { createStudentBrowserClient } from "@/lib/supabase/student-browser-client";

interface JoinClassSectionProps {
  onClassJoined?: () => void;
}

export function JoinClassSection({ onClassJoined }: JoinClassSectionProps) {
  const [joinCode, setJoinCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!joinCode.trim()) {
      setError("Please enter a class code");
      return;
    }

    try {
      setIsJoining(true);
      setError(null);
      setSuccess(null);

      const supabase = createStudentBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setError("Not authenticated");
        return;
      }

      const response = await fetch("/api/student/join-class", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ code: joinCode.trim().toUpperCase() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to join class");
        return;
      }

      setSuccess("Successfully joined class!");
      setJoinCode("");
      onClassJoined?.(); // Refresh the class list

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error("Error joining class:", err);
      setError(err.message || "Failed to join class");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <section className="rounded-2xl border border-black/10 bg-surface p-6 shadow-sm dark:border-white/10 sm:p-8">
      <h2 className="text-lg font-semibold text-foreground">Join a Class</h2>
      <p className="mt-2 text-sm text-muted">
        Enter the class code provided by your educator to join a class and start collaborating.
      </p>

      <form onSubmit={handleJoinClass} className="mt-6">
        <div className="flex gap-3">
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Enter class code (e.g., ABC123)"
            className="flex-1 rounded-xl border border-black/10 bg-background px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/15 uppercase"
            maxLength={6}
          />
          <button
            type="submit"
            disabled={isJoining || !joinCode.trim()}
            className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isJoining ? "Joining..." : "Join Class"}
          </button>
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {success && (
          <p className="mt-3 text-sm text-green-600 dark:text-green-400">{success}</p>
        )}
      </form>
    </section>
  );
}