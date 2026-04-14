"use client";

import { useState } from "react";

export default function EducatorSortGroupsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleGenerateTeams = async () => {
    setIsLoading(true);
    setToastMessage(null);

    try {
      const response = await fetch("http://localhost:8000/match", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to generate AI teams");
      }

      const data = await response.json();
      if (data.error) {
        showToast(data.error, "error");
        return;
      }

      showToast("Success! Teams generated and written to the database.");
    } catch (error: any) {
      console.error("Error generating teams:", error);
      showToast(error.message || "Error generating teams. Is the FastAPI server running?", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    setIsResetting(true);
    setToastMessage(null);

    try {
      const response = await fetch("http://localhost:8000/reset-matches", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to reset matches");
      }

      showToast("All team assignments have been reset.");
      // Refresh the page after a short delay so the toast is visible
      setTimeout(() => window.location.reload(), 1500);
    } catch (error: any) {
      console.error("Error resetting matches:", error);
      showToast(error.message || "Error resetting. Is the FastAPI server running?", "error");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-[min(100%,120rem)] px-4 py-8 sm:px-6 sm:py-10">
      <div className="relative rounded-2xl border border-dashed border-black/15 bg-black/[0.02] px-6 py-16 text-center dark:border-white/20 dark:bg-white/[0.03]">
        <h2 className="text-lg font-semibold text-foreground">Sort groups</h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted">
          Click the button below to allow the Gemini AI to automatically sort and place the students into teams based on their profiles.
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            onClick={handleGenerateTeams}
            disabled={isLoading || isResetting}
            className="inline-flex items-center justify-center rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-white/90"
          >
            {isLoading ? (
              <>
                <svg
                  className="mr-2 h-4 w-4 animate-spin text-white dark:text-black"
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
                Thinking...
              </>
            ) : (
              "Generate AI Teams"
            )}
          </button>

          <button
            onClick={handleReset}
            disabled={isLoading || isResetting}
            className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-900/40"
          >
            {isResetting ? (
              <>
                <svg
                  className="mr-2 h-4 w-4 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Resetting...
              </>
            ) : (
              "Reset All Teams"
            )}
          </button>
        </div>
      </div>

      {/* Simple Custom Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg border border-black/10 bg-white px-4 py-3 shadow-lg dark:border-white/10 dark:bg-zinc-900">
          <div
            className={`h-2 w-2 rounded-full ${
              toastType === "error" ? "bg-red-500" : "bg-green-500"
            }`}
          />
          <p className="text-sm font-medium text-foreground">{toastMessage}</p>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-4 text-muted hover:text-foreground"
          >
            &times;
          </button>
        </div>
      )}
    </main>
  );
}
