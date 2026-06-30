"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useStudentBrowserClient } from "@/lib/supabase/use-student-browser-client";
import { createStudentBrowserClient } from "@/lib/supabase/student-browser-client";
import { uploadAssignmentFile } from "@/lib/files/storage";
import { formatFileSize, validateFile } from "@/lib/files/validation";

export interface AssignmentAttachment {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  download_url?: string | null;
}

interface PendingFile {
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

interface AssignmentAttachmentsPanelProps {
  classId: string;
  assignmentId: string | null;
  mode: "create" | "manage";
  pendingFiles?: File[];
  onPendingFilesChange?: (files: File[]) => void;
}

export function AssignmentAttachmentsPanel({
  classId,
  assignmentId,
  mode,
  pendingFiles = [],
  onPendingFilesChange,
}: AssignmentAttachmentsPanelProps) {
  const supabase = useStudentBrowserClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [attachments, setAttachments] = useState<AssignmentAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(mode === "manage" && !!assignmentId);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localPending, setLocalPending] = useState<PendingFile[]>(
    pendingFiles.map((file) => ({ file, status: "pending" as const })),
  );

  const fetchAttachments = useCallback(async () => {
    if (!assignmentId || mode !== "manage") return;

    try {
      setIsLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Not authenticated");
        return;
      }

      const response = await fetch(
        `/api/educator/classes/${classId}/assignments/${assignmentId}/attachments`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        },
      );

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load attachments");
      }

      setAttachments(payload.attachments ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load attachments");
    } finally {
      setIsLoading(false);
    }
  }, [assignmentId, classId, mode, supabase]);

  useEffect(() => {
    void fetchAttachments();
  }, [fetchAttachments]);

  useEffect(() => {
    if (mode === "create" && onPendingFilesChange) {
      onPendingFilesChange(localPending.map((p) => p.file));
    }
  }, [localPending, mode, onPendingFilesChange]);

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const valid: PendingFile[] = [];
    const errors: string[] = [];

    Array.from(files).forEach((file) => {
      const result = validateFile(file);
      if (result.valid) {
        valid.push({ file, status: "pending" });
      } else {
        errors.push(`${file.name}: ${result.error}`);
      }
    });

    if (errors.length > 0) {
      setError(errors.join("; "));
    } else {
      setError(null);
    }

    if (mode === "create") {
      setLocalPending((prev) => [...prev, ...valid]);
    } else if (assignmentId) {
      void uploadFiles(valid.map((p) => p.file));
    }
  };

  const registerAttachment = async (
    session: { access_token: string },
    attachmentId: string,
    file: File,
    storagePath: string,
  ) => {
    const response = await fetch(
      `/api/educator/classes/${classId}/assignments/${assignmentId}/attachments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: attachmentId,
          file_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
          storage_path: storagePath,
        }),
      },
    );

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Failed to register attachment");
    }
  };

  const uploadFiles = async (files: File[]) => {
    if (!assignmentId || files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      for (const file of files) {
        const validation = validateFile(file);
        if (!validation.valid) {
          setError(`${file.name}: ${validation.error}`);
          continue;
        }

        const { storagePath, attachmentId } = await uploadAssignmentFile(
          supabase,
          assignmentId,
          file,
        );
        await registerAttachment(session, attachmentId, file, storagePath);
      }

      await fetchAttachments();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removePendingFile = (index: number) => {
    setLocalPending((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDelete = async (attachmentId: string) => {
    if (!assignmentId) return;

    try {
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(
        `/api/educator/classes/${classId}/assignments/${assignmentId}/attachments/${attachmentId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${session.access_token}` },
        },
      );

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to delete attachment");
      }

      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete attachment");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-medium text-foreground">Resources</h4>
          <p className="text-xs text-muted">
            {mode === "create"
              ? "Optional files students can download (PDF, Office, images, txt, csv — max 10 MB each)."
              : "Files shared with enrolled students."}
          </p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv"
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
            disabled={uploading || (mode === "manage" && !assignmentId)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || (mode === "manage" && !assignmentId)}
            className="rounded-lg border border-black/10 bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/[0.06]"
          >
            {uploading ? "Uploading..." : "Add file"}
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      )}

      {mode === "create" && localPending.length > 0 && (
        <ul className="space-y-2">
          {localPending.map((pending, index) => (
            <li
              key={`${pending.file.name}-${index}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-black/5 bg-background/50 px-3 py-2 text-sm dark:border-white/10"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{pending.file.name}</p>
                <p className="text-xs text-muted">{formatFileSize(pending.file.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => removePendingFile(index)}
                className="text-xs text-red-600 hover:text-red-700 dark:text-red-400"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {mode === "manage" && (
        <>
          {isLoading ? (
            <p className="text-xs text-muted">Loading resources...</p>
          ) : attachments.length === 0 ? (
            <p className="text-xs text-muted">No files attached yet.</p>
          ) : (
            <ul className="space-y-2">
              {attachments.map((attachment) => (
                <li
                  key={attachment.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-black/5 bg-background/50 px-3 py-2 text-sm dark:border-white/10"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{attachment.file_name}</p>
                    <p className="text-xs text-muted">
                      {formatFileSize(attachment.size_bytes)} ·{" "}
                      {new Date(attachment.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {attachment.download_url && (
                      <a
                        href={attachment.download_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-brand hover:underline"
                      >
                        Download
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleDelete(attachment.id)}
                      className="text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export async function uploadPendingAssignmentFiles(
  classId: string,
  assignmentId: string,
  files: File[],
  accessToken: string,
): Promise<{ uploaded: number; errors: string[] }> {
  const supabase = createStudentBrowserClient();
  const errors: string[] = [];
  let uploaded = 0;

  for (const file of files) {
    const validation = validateFile(file);
    if (!validation.valid) {
      errors.push(`${file.name}: ${validation.error}`);
      continue;
    }

    try {
      const { storagePath, attachmentId } = await uploadAssignmentFile(
        supabase,
        assignmentId,
        file,
      );

      const response = await fetch(
        `/api/educator/classes/${classId}/assignments/${assignmentId}/attachments`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: attachmentId,
            file_name: file.name,
            mime_type: file.type,
            size_bytes: file.size,
            storage_path: storagePath,
          }),
        },
      );

      const payload = await response.json();
      if (!response.ok) {
        errors.push(`${file.name}: ${payload.error || "Registration failed"}`);
      } else {
        uploaded += 1;
      }
    } catch (err: unknown) {
      errors.push(
        `${file.name}: ${err instanceof Error ? err.message : "Upload failed"}`,
      );
    }
  }

  return { uploaded, errors };
}
