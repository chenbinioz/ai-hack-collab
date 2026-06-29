"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createStudentBrowserClient } from "@/lib/supabase/student-browser-client";
import {
  EXTERNAL_DATA_EXPECTED_FILENAMES,
  EXTERNAL_DATA_FILE_LABELS,
  EXTERNAL_DATA_FILE_TYPES,
  REQUIRED_EXTERNAL_DATA_FILE_TYPE,
  validateCsvHeaders,
  type ExternalDataFileType,
} from "@/lib/external-data/constants";
import { uploadClassExternalDataFile } from "@/lib/files/storage";

interface ExternalDataLayer {
  id: string;
  layer_number: number;
  name: string | null;
  uploaded_at: string;
  processed_at: string | null;
  process_status: string;
  process_error: string | null;
}

interface ExternalDataFile {
  id: string;
  layer_id: string;
  file_type: string;
  file_name: string;
  row_count: number;
  uploaded_at: string;
}

interface ExternalDataStatus {
  layers: ExternalDataLayer[];
  files: ExternalDataFile[];
  latest_by_type: Partial<
    Record<ExternalDataFileType, { layer_number: number; row_count: number; uploaded_at: string }>
  >;
  last_insight_computed_at: string | null;
  matched_student_count: number;
  enrolled_with_external_id_count: number;
}

interface ClassExternalDataPanelProps {
  classId: string;
}

function layerDisplayName(layer: ExternalDataLayer): string {
  return layer.name?.trim() || `Layer ${layer.layer_number}`;
}

export function ClassExternalDataPanel({ classId }: ClassExternalDataPanelProps) {
  const supabase = createStudentBrowserClient();
  const [status, setStatus] = useState<ExternalDataStatus | null>(null);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingType, setUploadingType] = useState<ExternalDataFileType | null>(null);
  const [recentUploadAck, setRecentUploadAck] = useState<{
    fileType: ExternalDataFileType;
    fileName: string;
  } | null>(null);
  const [isCreatingLayer, setIsCreatingLayer] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSavingLayerName, setIsSavingLayerName] = useState(false);
  const [layerNameDraft, setLayerNameDraft] = useState("");
  const [isEditingLayerName, setIsEditingLayerName] = useState(false);
  const fileInputRefs = useRef<Partial<Record<ExternalDataFileType, HTMLInputElement | null>>>({});
  const layerNameInputRef = useRef<HTMLInputElement | null>(null);

  const loadStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/educator/classes/${classId}/external-data`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Failed to load external data status");
        return;
      }
      setStatus(payload);
      setActiveLayerId((current) => {
        if (current) return current;
        if (payload.layers?.length > 0) {
          const pending = [...payload.layers].reverse().find((l: ExternalDataLayer) => l.process_status === "pending");
          return pending?.id ?? payload.layers[payload.layers.length - 1].id;
        }
        return null;
      });
    } catch {
      setError("Failed to load external data status");
    } finally {
      setIsLoading(false);
    }
  }, [classId, supabase]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!recentUploadAck) return;
    const timer = window.setTimeout(() => setRecentUploadAck(null), 5000);
    return () => window.clearTimeout(timer);
  }, [recentUploadAck]);

  const activeLayer = status?.layers.find((l) => l.id === activeLayerId);
  const activeLayerFiles = status?.files.filter((f) => f.layer_id === activeLayerId) ?? [];
  const hasPersonDimInActiveLayer = activeLayerFiles.some((f) => f.file_type === REQUIRED_EXTERNAL_DATA_FILE_TYPE);

  useEffect(() => {
    if (activeLayer && !isEditingLayerName) {
      setLayerNameDraft(layerDisplayName(activeLayer));
    }
  }, [activeLayer, isEditingLayerName]);

  useEffect(() => {
    if (isEditingLayerName) {
      layerNameInputRef.current?.focus();
      layerNameInputRef.current?.select();
    }
  }, [isEditingLayerName]);

  async function handleCreateLayer() {
    setIsCreatingLayer(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/educator/classes/${classId}/external-data`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Failed to create layer");
        return;
      }
      setActiveLayerId(payload.layer.id);
      setLayerNameDraft(layerDisplayName(payload.layer));
      setIsEditingLayerName(true);
      await loadStatus();
    } catch {
      setError("Failed to create layer");
    } finally {
      setIsCreatingLayer(false);
    }
  }

  async function handleSaveLayerName() {
    if (!activeLayerId || !activeLayer) return;

    const trimmed = layerNameDraft.trim();
    if (!trimmed) {
      setError("Layer name cannot be empty.");
      setLayerNameDraft(layerDisplayName(activeLayer));
      setIsEditingLayerName(false);
      return;
    }

    if (trimmed === layerDisplayName(activeLayer)) {
      setIsEditingLayerName(false);
      return;
    }

    setIsSavingLayerName(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `/api/educator/classes/${classId}/external-data/layers/${activeLayerId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: trimmed }),
        },
      );
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Failed to rename layer");
        return;
      }
      setIsEditingLayerName(false);
      await loadStatus();
    } catch {
      setError("Failed to rename layer");
    } finally {
      setIsSavingLayerName(false);
    }
  }

  async function handleFileSelected(fileType: ExternalDataFileType, file: File) {
    if (!activeLayerId) {
      setError("Create a new data layer before uploading files.");
      return;
    }

    setUploadingType(fileType);
    setError(null);

    try {
      const headerText = await file.slice(0, 4096).text();
      const firstLine = headerText.split(/\r?\n/)[0] ?? "";
      const headerCheck = validateCsvHeaders(fileType, firstLine);
      if (!headerCheck.ok) {
        setError(`${EXTERNAL_DATA_FILE_LABELS[fileType]}: ${headerCheck.message}`);
        return;
      }

      const rowCount = Math.max(0, headerText.split(/\r?\n/).filter((l) => l.trim()).length - 1);

      const storagePath = await uploadClassExternalDataFile(
        supabase,
        classId,
        activeLayerId,
        fileType,
        file,
      );

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `/api/educator/classes/${classId}/external-data/layers/${activeLayerId}/files`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            file_type: fileType,
            file_name: file.name,
            storage_path: storagePath,
            row_count: rowCount,
          }),
        },
      );
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Failed to register file");
        return;
      }

      setRecentUploadAck({ fileType, fileName: file.name });
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingType(null);
    }
  }

  async function handleProcessLayer() {
    if (!activeLayerId) return;
    setIsProcessing(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `/api/educator/classes/${classId}/external-data/layers/${activeLayerId}/process`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        },
      );
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Processing failed");
        return;
      }
      await loadStatus();
    } catch {
      setError("Processing failed");
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <section className="rounded-2xl border border-black/6 bg-surface p-6 shadow-sm dark:border-white/10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">External learning data</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Upload learning analytics CSV files to enrich AI team matching. Upload all dataset files for
            best results; <strong>person_dim</strong> is required before processing.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleCreateLayer()}
          disabled={isCreatingLayer}
          className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {isCreatingLayer ? "Creating…" : "Add new data layer"}
        </button>
      </div>

      {status && (
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted">
          <span>
            Layers: <strong className="text-foreground">{status.layers.length}</strong>
          </span>
          <span>
            Students with external ID:{" "}
            <strong className="text-foreground">{status.enrolled_with_external_id_count}</strong>
          </span>
          <span>
            Matched insights:{" "}
            <strong className="text-foreground">{status.matched_student_count}</strong>
          </span>
          {status.last_insight_computed_at && (
            <span>
              Last computed:{" "}
              <strong className="text-foreground">
                {new Date(status.last_insight_computed_at).toLocaleString()}
              </strong>
            </span>
          )}
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-200" role="alert">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="mt-6 text-sm text-muted">Loading external data…</p>
      ) : (
        <>
          {activeLayer && (
            <div className="mt-4 rounded-xl border border-black/8 bg-background/60 px-4 py-3 dark:border-white/10">
              <div className="flex flex-wrap items-center gap-2">
                {isEditingLayerName ? (
                  <>
                    <label htmlFor="layer-name-input" className="sr-only">
                      Layer name
                    </label>
                    <input
                      id="layer-name-input"
                      ref={layerNameInputRef}
                      type="text"
                      value={layerNameDraft}
                      onChange={(e) => setLayerNameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleSaveLayerName();
                        if (e.key === "Escape") {
                          setLayerNameDraft(layerDisplayName(activeLayer));
                          setIsEditingLayerName(false);
                        }
                      }}
                      disabled={isSavingLayerName}
                      className="min-w-[12rem] rounded-lg border border-black/10 bg-background px-3 py-1.5 text-sm font-medium text-foreground dark:border-white/15"
                      placeholder="Layer name"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSaveLayerName()}
                      disabled={isSavingLayerName}
                      className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                    >
                      {isSavingLayerName ? "Saving…" : "Save name"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLayerNameDraft(layerDisplayName(activeLayer));
                        setIsEditingLayerName(false);
                      }}
                      className="rounded-lg border border-black/10 px-3 py-1.5 text-xs text-muted dark:border-white/15"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-foreground">
                      {layerDisplayName(activeLayer)}{" "}
                      <span className="font-normal text-muted">
                        (#{activeLayer.layer_number} · {activeLayer.process_status}
                        {activeLayer.process_error ? `: ${activeLayer.process_error}` : ""})
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsEditingLayerName(true)}
                      className="rounded-lg border border-black/10 px-2.5 py-1 text-xs text-muted transition hover:text-foreground dark:border-white/15"
                    >
                      Rename
                    </button>
                  </>
                )}
              </div>

              {status && status.layers.length > 1 && (
                <select
                  className="mt-2 rounded-lg border border-black/10 bg-background px-3 py-1.5 text-sm dark:border-white/15"
                  value={activeLayerId ?? ""}
                  onChange={(e) => {
                    setActiveLayerId(e.target.value);
                    setIsEditingLayerName(false);
                  }}
                >
                  {status.layers.map((layer) => (
                    <option key={layer.id} value={layer.id}>
                      {layerDisplayName(layer)} — {layer.process_status}
                    </option>
                  ))}
                </select>
              )}

              {activeLayer.process_status === "pending" && activeLayerFiles.length > 0 && (
                <div className="mt-3 rounded-lg border border-green-500/25 bg-green-500/8 px-3 py-2 dark:bg-green-500/10">
                  <p className="text-xs font-semibold uppercase tracking-wide text-green-800 dark:text-green-200">
                    Uploaded to this layer ({activeLayerFiles.length})
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {activeLayerFiles.map((file) => (
                      <li
                        key={file.id}
                        className="flex items-start gap-2 text-sm text-foreground"
                      >
                        <span className="mt-0.5 text-green-700 dark:text-green-300" aria-hidden>
                          ✓
                        </span>
                        <span>
                          <span className="font-medium">{file.file_name}</span>
                          <span className="text-muted">
                            {" "}
                            · {EXTERNAL_DATA_FILE_LABELS[file.file_type as ExternalDataFileType] ?? file.file_type}
                            {file.row_count > 0 ? ` · ${file.row_count} rows` : ""}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {!activeLayerId && (
            <p className="mt-4 text-sm text-muted">
              Click &ldquo;Add new data layer&rdquo; to start uploading CSV files.
            </p>
          )}

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {EXTERNAL_DATA_FILE_TYPES.map((fileType) => {
              const latest = status?.latest_by_type[fileType];
              const activeFile = activeLayerFiles.find((f) => f.file_type === fileType);
              const inActiveLayer = !!activeFile;
              const isRequired = fileType === REQUIRED_EXTERNAL_DATA_FILE_TYPE;
              const justUploaded = recentUploadAck?.fileType === fileType;

              return (
                <div
                  key={fileType}
                  className={`rounded-xl border bg-background/50 p-4 dark:border-white/10 ${
                    inActiveLayer
                      ? "border-green-500/35 ring-1 ring-green-500/15"
                      : "border-black/8"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {EXTERNAL_DATA_FILE_LABELS[fileType]}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {EXTERNAL_DATA_EXPECTED_FILENAMES[fileType]}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        inActiveLayer
                          ? "bg-green-500/15 text-green-800 dark:text-green-200"
                          : latest
                            ? "bg-amber-500/15 text-amber-900 dark:text-amber-100"
                            : "bg-black/5 text-muted dark:bg-white/10"
                      }`}
                    >
                      {inActiveLayer ? "Uploaded" : latest ? `Layer ${latest.layer_number}` : "Missing"}
                    </span>
                  </div>

                  <input
                    ref={(el) => {
                      fileInputRefs.current[fileType] = el;
                    }}
                    type="file"
                    accept=".csv,text/csv"
                    className="sr-only"
                    disabled={!activeLayerId || uploadingType === fileType}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleFileSelected(fileType, file);
                      e.target.value = "";
                    }}
                  />

                  <button
                    type="button"
                    disabled={!activeLayerId || uploadingType === fileType}
                    onClick={() => fileInputRefs.current[fileType]?.click()}
                    className="mt-3 w-full rounded-lg border border-dashed border-black/15 px-3 py-3 text-sm text-muted transition hover:border-brand/40 hover:text-foreground disabled:opacity-50 dark:border-white/20"
                  >
                    {uploadingType === fileType
                      ? "Uploading…"
                      : inActiveLayer
                        ? "Replace CSV"
                        : isRequired
                          ? "Drop CSV here (required)"
                          : "Drop CSV here"}
                  </button>

                  {inActiveLayer && activeFile && (
                    <div
                      className="mt-2 rounded-lg border border-green-500/20 bg-green-500/8 px-2.5 py-2 text-xs dark:bg-green-500/10"
                      role="status"
                    >
                      <p className="font-medium text-green-800 dark:text-green-200">
                        {justUploaded ? "Upload complete" : "Uploaded"}
                      </p>
                      <p className="mt-0.5 truncate text-foreground" title={activeFile.file_name}>
                        {activeFile.file_name}
                      </p>
                      {activeFile.row_count > 0 && (
                        <p className="mt-0.5 text-muted">{activeFile.row_count} data rows</p>
                      )}
                    </div>
                  )}

                  {!inActiveLayer && latest && (
                    <p className="mt-2 text-xs text-muted">
                      Latest: {latest.row_count} rows
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {activeLayerId && (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void handleProcessLayer()}
                disabled={isProcessing || !hasPersonDimInActiveLayer}
                className="rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
              >
                {isProcessing ? "Processing…" : "Process layer & recompute insights"}
              </button>
              {!hasPersonDimInActiveLayer && (
                <p className="text-sm text-muted">Upload person_dim to this layer before processing.</p>
              )}
            </div>
          )}

          {status && status.layers.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-foreground">Layer history</h3>
              <ul className="mt-2 space-y-1 text-sm text-muted">
                {status.layers.map((layer) => {
                  const layerFiles = status.files.filter((f) => f.layer_id === layer.id);
                  return (
                    <li key={layer.id}>
                      <span className="font-medium text-foreground">{layerDisplayName(layer)}</span>
                      {" — "}
                      {layer.process_status}
                      {layerFiles.length > 0 && (
                        <span>
                          {" "}
                          ({layerFiles.map((f) => f.file_name).join(", ")})
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
