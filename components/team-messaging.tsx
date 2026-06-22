"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createStudentBrowserClient } from "@/lib/supabase/student-browser-client";

interface Message {
  id: string;
  team_id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  created_at: string;
}

interface TeamMessagingProps {
  teamId: string;
  teamName: string;
}

export function TeamMessaging({ teamId, teamName }: TeamMessagingProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createStudentBrowserClient();
  const coachId = "00000000-0000-0000-0000-000000000001";

  // Track per-message visibility timestamps and accumulated seconds
  const startTimesRef = useRef<Record<string, number>>({});
  const accumRef = useRef<Record<string, number>>({});
  const observedIdsRef = useRef<Set<string>>(new Set());

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Fetch messages using the existing Security Definer RPC — no backend required
  const fetchMessages = useCallback(async (isInitialLoad = false) => {
    try {
      const { data, error: rpcError } = await supabase.rpc("get_team_messages");

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
      
      // If it's the first time we load, scroll to show latest messages
      if (isInitialLoad) {
        // Use a small timeout to ensure DOM has rendered
        setTimeout(scrollToBottom, 100);
      }
    } catch (err: unknown) {
      console.error("Error fetching messages:", err);
      setError("Failed to load messages");
    }
  }, [supabase]);

  // Poll for new messages every 5 seconds (simple real-time alternative)
  useEffect(() => {
    void fetchMessages(true); // Treat first fetch as initial load
    const interval = setInterval(() => {
      void fetchMessages(false); // Background polls don't scroll
    }, 5000);
    return () => clearInterval(interval);
  }, [teamId, fetchMessages]);

  // Observe coach messages and measure how many seconds each student spends reading them.
  useEffect(() => {
    if (!messages || messages.length === 0) return;

    const coachMessageElements: Element[] = Array.from(document.querySelectorAll('[data-coach-message="true"]')) as Element[];

    // Create observer
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const id = (entry.target as HTMLElement).dataset.messageId;
        if (!id) return;

        if (entry.isIntersecting) {
          // start timing
          startTimesRef.current[id] = Date.now();
          observedIdsRef.current.add(id);
        } else {
          // stop timing and add to accumulator
          const start = startTimesRef.current[id];
          if (start) {
            const delta = Math.round((Date.now() - start) / 1000);
            accumRef.current[id] = (accumRef.current[id] ?? 0) + delta;
            delete startTimesRef.current[id];
          }
        }
      });
    }, { threshold: 0.5 });

    // Observe current coach message elements
    coachMessageElements.forEach((el) => observer.observe(el));

    // Flush accumulated read times to the DB when navigating away/unmounting
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

        // Insert reading times (RLS will verify team membership)
        await supabase.from("message_read_times").insert(inserts);
        // Reset accumulators
        accumRef.current = {};
      } catch (err) {
        // Non-fatal: logging only
        console.error("Failed to persist message read times:", err);
      }
    };

    window.addEventListener("beforeunload", flush);
    return () => {
      observer.disconnect();
      // finalize any in-progress timers
      Object.entries(startTimesRef.current).forEach(([id, start]) => {
        accumRef.current[id] = (accumRef.current[id] ?? 0) + Math.round((Date.now() - start) / 1000);
      });
      void flush();
      window.removeEventListener("beforeunload", flush);
    };
  }, [messages, supabase, teamId]);


  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = newMessage.trim();
    if (!trimmed) return;

    setIsLoading(true);
    setError(null);

    try {
      // Insert directly into the messages table.
      // The RLS policy "Users can send messages to their team" enforces that:
      //   - sender_id == auth.uid()
      //   - team_id matches the user's own team
      const { error: insertError } = await supabase.from("messages").insert({
        team_id: teamId,
        content: trimmed,
        // sender_id is enforced server-side via RLS; we still pass it for clarity
        sender_id: (await supabase.auth.getUser()).data.user?.id,
      });

      if (insertError) {
        const msg =
          typeof insertError === "object" &&
          insertError !== null &&
          "message" in insertError
            ? String((insertError as { message: string }).message)
            : "Failed to send message";
        throw new Error(msg);
      }

      setNewMessage("");
      // Immediately refresh so the sender sees their own message
      await fetchMessages(false);
      // Always scroll to bottom after user sends a message
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

      {/* Messages Container */}
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
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {message.content}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message Input */}
      <form onSubmit={sendMessage} className="flex gap-3">
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
          disabled={isLoading || !newMessage.trim()}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? "Sending..." : "Send"}
        </button>
      </form>

      <p className="text-xs text-muted mt-2">
        Messages are visible to all team members. Keep it professional and
        collaborative!
      </p>
    </section>
  );
}