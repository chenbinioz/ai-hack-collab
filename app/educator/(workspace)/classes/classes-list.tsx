"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createStudentBrowserClient } from "@/lib/supabase/student-browser-client";
import { CreateClassModal } from "./create-class-modal";

interface Class {
  id: string;
  name: string;
  description: string;
  code: string;
  coursework_deadline: string | null;
  max_team_size: number;
  student_count: number;
  created_at: string;
}

export function ClassesList() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const router = useRouter();
  const supabase = createStudentBrowserClient();

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Not authenticated");
        return;
      }

      const response = await fetch("/api/educator/classes", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch classes");
      }

      setClasses(data.classes || []);
    } catch (err: any) {
      console.error("Error fetching classes:", err);
      setError(err.message || "Failed to load classes");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClassCreated = () => {
    setShowCreateModal(false);
    fetchClasses(); // Refresh the list
  };

  const handleViewClass = (classId: string) => {
    router.push(`/educator/classes/${classId}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-2 text-muted">
          <svg
            className="h-5 w-5 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          Loading classes...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-950/30">
        <h3 className="text-lg font-semibold text-red-900 dark:text-red-100">Error</h3>
        <p className="mt-2 text-red-700 dark:text-red-300">{error}</p>
        <button
          onClick={fetchClasses}
          className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with create button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Your Classes</h2>
          <p className="text-sm text-muted">Manage student enrollment and team generation</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-deep"
        >
          Create Class
        </button>
      </div>

      {/* Classes grid */}
      {classes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/15 bg-black/[0.02] p-12 text-center dark:border-white/20 dark:bg-white/[0.03]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand/10">
            <svg
              className="h-6 w-6 text-brand"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
              />
            </svg>
          </div>
          <h3 className="mt-4 text-lg font-medium text-foreground">No classes yet</h3>
          <p className="mt-2 text-sm text-muted">
            Create your first class to start organizing students into groups.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-6 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-deep"
          >
            Create Your First Class
          </button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((classItem) => (
            <div
              key={classItem.id}
              className="rounded-2xl border border-black/10 bg-surface p-6 shadow-sm transition hover:shadow-md dark:border-white/10"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">{classItem.name}</h3>
                  <p className="mt-1 text-sm text-muted line-clamp-2">
                    {classItem.description || "No description"}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Students</span>
                  <span className="font-medium text-foreground">{classItem.student_count}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Max team size</span>
                  <span className="font-medium text-foreground">{classItem.max_team_size}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Join code</span>
                  <code className="rounded bg-black/5 px-2 py-0.5 text-xs font-mono dark:bg-white/10">
                    {classItem.code}
                  </code>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Deadline</span>
                  <span className="font-medium text-foreground">
                    {classItem.coursework_deadline
                      ? new Date(classItem.coursework_deadline).toLocaleString()
                      : "Not set"}
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleViewClass(classItem.id)}
                className="mt-4 w-full rounded-xl border border-black/10 bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-black/[0.03] dark:border-white/15 dark:hover:bg-white/[0.06]"
              >
                Manage Class
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create class modal */}
      {showCreateModal && (
        <CreateClassModal
          onClose={() => setShowCreateModal(false)}
          onClassCreated={handleClassCreated}
        />
      )}
    </div>
  );
}