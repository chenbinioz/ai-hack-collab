"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createStudentBrowserClient } from "@/lib/supabase/student-browser-client";
import { CHAT_FILES_BUCKET, IMAGE_MIME_TYPES } from "@/lib/files/constants";
import { getSignedDownloadUrl, uploadChatFile } from "@/lib/files/storage";
import { formatFileSize, validateFile } from "@/lib/files/validation";

interface Message {
  id: string;
  team_id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  created_at: string;
  attachment_id: string | null;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  storage_path: string | null;
}

interface TeamMessagingProps {
  teamId: string;
  teamName: string;
}

function MessageAttachment({
  message,
  supabase,
}: {
  message: Message;
  supabase: ReturnType<typeof createStudentBrowserClient>;
}) {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!message.storage_path || !message.attachment_id) return;

    let cancelled = false;

    void getSignedDownloadUrl(supabase, CHAT_FILES_BUCKET, message.storage_path)
      .then((url) => {
        if (!cancelled) setDownloadUrl(url);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [message.storage_path, message.attachment_id, supabase]);

  if (!message.attachment_id || !message.file_name) return null;

  const isImage = message.mime_type && IMAGE_MIME_TYPES.has(message.mime_type);

  if (loadError) {
    return (
      <p className="mt-2 text-xs text-muted">Could not load attachment</p>
    );
  }

  if (!downloadUrl) {
    return (
      <p className="mt-2 text-xs text-muted">Loading attachment...</p>
    );
  }

  if (isImage) {
    return (
      <div className="mt-2">
        <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={downloadUrl}
            alt={message.file_name}
            className="max-h-48 rounded-lg border border-black/10 object-contain dark:border-white/10"
          />
        </a>
        <p className="mt-1 text-xs text-muted">
          {message.file_name}
          {message.size_bytes ? ` · ${formatFileSize(message.size_bytes)}` : ""}
        </p>
      </div>
    );
  }

  return (
    <a
      href={downloadUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 inline-flex items-center gap-2 rounded-lg border border-black/10 bg-background px-3 py-2 text-sm text-brand hover:bg-black/[0.02] dark:border-white/10 dark:hover:bg-white/[0.04]"
    >
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      <span className="truncate">{message.file_name}</span>
      {message.size_bytes ? (
        <span className="text-xs text-muted">({formatFileSize(message.size_bytes)})</span>
      ) : null}
    </a>
  );
}

export function TeamMessaging({ teamId, teamName }: TeamMessagingProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createStudentBrowserClient();
  const coachId = "00000000-0000-0000-0000-000000000001";

  const startTimesRef = useRef<Record<string, number>>({});
  const accumRef = useRef<Record<string, number>>({});
  const observedIdsRef = useRef<Set<string>>(new Set());

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchMessages = useCallback(async (isInitialLoad = false) => {
    try {
      const { data, error: rpcError } = await supabase.rpc("get_team_messages", {
        p_team_id: teamId,
      });

      if (rpcError) {
        const msg =
          typeof rpcError === "object" && rpcError !== null && "message" in rpcError
            ? String((rpcError as { message: string }).message)
            : "Failed to load messages";
        setError(msg);
        return;
      }

      setMessages((data as Message[]) || []);
      setError(null);

      if (isInitialLoad) {
        setTimeout(scrollToBottom, 100);
      }
    } catch (err: unknown) {
      console.error("Error fetching messages:", err);
      setError("Failed to load messages");
    }
  }, [supabase, teamId]);

  useEffect(() => {
    void fetchMessages(true);
    const interval = setInterval(() => {
      void fetchMessages(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [teamId, fetchMessages]);

  useEffect(() => {
    if (!messages || messages.length === 0) return;

    const coachMessageElements: Element[] = Array.from(
      document.querySelectorAll('[data-coach-message="true"]'),
    ) as Element[];

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const id = (entry.target as HTMLElement).dataset.messageId;
        if (!id) return;

        if (entry.isIntersecting) {
          startTimesRef.current[id] = Date.now();
          observedIdsRef.current.add(id);
        } else {
          const start = startTimesRef.current[id];
          if (start) {
            const delta = Math.round((Date.now() - start) / 1000);
            accumRef.current[id] = (accumRef.current[id] ?? 0) + delta;
            delete startTimesRef.current[id];
          }
        }
      });
    }, { threshold: 0.5 });

    coachMessageElements.forEach((el) => observer.observe(el));

    const flush = async () => {
      try {
        const entries = Object.entries(accumRef.current).filter(([, seconds]) => seconds > 0);
        if (entries.length === 0) return;

        const userResult = await supabase.auth.getUser();
        const studentId = userResult.data.user?.id;
        if (!studentId) return;

        const inserts = entries.map(([message_id, seconds]) => ({
          student_id: studentId,
          team_id: teamId,
          message_id,
          seconds,
        }));

        await supabase.from("message_read_times").insert(inserts);
        accumRef.current = {};
      } catch (err) {
        console.error("Failed to persist message read times:", err);
      }
    };

    window.addEventListener("beforeunload", flush);
    return () => {
      observer.disconnect();
      Object.entries(startTimesRef.current).forEach(([id, start]) => {
        accumRef.current[id] = (accumRef.current[id] ?? 0) + Math.round((Date.now() - start) / 1000);
      });
      void flush();
      window.removeEventListener("beforeunload", flush);
    };
  }, [messages, supabase, teamId]);

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const validation = validateFile(file);
    if (!validation.valid) {
      setError(validation.error ?? "Invalid file");
      return;
    }
    setSelectedFile(file);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const canSend = newMessage.trim().length > 0 || selectedFile !== null;

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = newMessage.trim();
    if (!trimmed && !selectedFile) return;

    setIsLoading(true);
    setError(null);

    try {
      const messageId = crypto.randomUUID();
      let storagePath: string | null = null;
      let fileName: string | null = null;
      let mimeType: string | null = null;
      let sizeBytes: number | null = null;

      if (selectedFile) {
        storagePath = await uploadChatFile(supabase, teamId, messageId, selectedFile);
        fileName = selectedFile.name;
        mimeType = selectedFile.type;
        sizeBytes = selectedFile.size;
      }

      const { error: rpcError } = await supabase.rpc("send_team_message", {
        p_team_id: teamId,
        p_content: trimmed,
        p_message_id: messageId,
        p_file_name: fileName,
        p_mime_type: mimeType,
        p_size_bytes: sizeBytes,
        p_storage_path: storagePath,
      });

      if (rpcError) {
        const msg =
          typeof rpcError === "object" && rpcError !== null && "message" in rpcError
            ? String((rpcError as { message: string }).message)
            : "Failed to send message";
        throw new Error(msg);
      }

      setNewMessage("");
      setSelectedFile(null);
      await fetchMessages(false);
      setTimeout(scrollToBottom, 100);
    } catch (err: unknown) {
      console.error("Error sending message:", err);
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <section className="mt-6 rounded-2xl border border-black/10 bg-surface p-6 shadow-sm dark:border-white/10 sm:p-8">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-foreground">
          Team Chat - {teamName}
        </h2>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="h-96 overflow-y-auto border border-black/10 rounded-lg p-4 mb-4 bg-background">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <div key={message.id} className="flex flex-col">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm text-foreground">
                    {message.sender_name}
                  </span>
                  <span className="text-xs text-muted">
                    {formatTime(message.created_at)}
                  </span>
                </div>
                <div
                  className="bg-surface rounded-lg p-3 border border-black/5"
                  data-message-id={message.id}
                  data-coach-message={message.sender_id === coachId ? "true" : "false"}
                >
                  {message.content.trim() ? (
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {message.content}
                    </p>
                  ) : null}
                  <MessageAttachment message={message} supabase={supabase} />
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {selectedFile && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-black/10 bg-background px-3 py-2 text-sm dark:border-white/10">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-foreground">{selectedFile.name}</p>
            <p className="text-xs text-muted">{formatFileSize(selectedFile.size)}</p>
          </div>
          <button
            type="button"
            onClick={() => setSelectedFile(null)}
            className="text-xs text-red-600 hover:text-red-700 dark:text-red-400"
          >
            Remove
          </button>
        </div>
      )}

      <form onSubmit={sendMessage} className="flex gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv"
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
          disabled={isLoading}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="shrink-0 rounded-lg border border-black/10 bg-background px-3 py-2 text-foreground transition hover:bg-black/[0.03] disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/[0.06]"
          aria-label="Attach file"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
            />
          </svg>
        </button>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 px-4 py-2 border border-black/10 rounded-lg bg-background text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20"
          maxLength={1000}
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !canSend}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? "Sending..." : "Send"}
        </button>
      </form>

      <p className="text-xs text-muted mt-2">
        Messages are visible to all team members. Attach one file per message (max 10 MB).
      </p>
    </section>
  );
}
