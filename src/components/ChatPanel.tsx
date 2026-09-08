"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, Sparkles, User } from "lucide-react";
import { useLocalUser } from "@/lib/local/useLocalUser";
import { ChatMessages, Subjects, SyllabusRepo, Resources, Lectures } from "@/lib/local/repo";
import type { ChatMessage } from "@/lib/local/types";
import { GLOBAL_ASSISTANT_SUBJECT_ID } from "@/lib/local/types";
import { apiChat, apiAssistant } from "@/lib/api/client";
import { useTheme } from "@/lib/theme/ThemeContext";
import { runAssistantAction } from "@/lib/assistant/dispatcher";

/**
 * subjectId: a real subject id for subject-scoped chat, or the global
 * sentinel (-1) for the floating ClassVault assistant, which isn't
 * grounded in any one subject's material - and, unlike subject-scoped
 * chat, can also act on the app itself (theme, navigation, notes,
 * assignments) via the assistant dispatcher.
 */
export function ChatPanel({ subjectId, subjectName }: { subjectId: number; subjectName?: string }) {
  const username = useLocalUser();
  const router = useRouter();
  const { setTheme } = useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isGlobalAssistant = subjectId === GLOBAL_ASSISTANT_SUBJECT_ID;

  const load = useCallback(async () => {
    if (!username) return;
    setMessages(await ChatMessages.forSubject(username, subjectId));
  }, [username, subjectId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const buildContext = async (): Promise<string> => {
    if (!username || subjectId < 0) {
      return "You are ClassVault's helpful study assistant, embedded in an academic organizer web app.";
    }
    const subject = await Subjects.get(username, subjectId);
    const syllabus = await SyllabusRepo.forSubject(username, subjectId);
    const resources = await Resources.forSubject(username, subjectId);
    const lectures = await Lectures.forSubject(username, subjectId);

    let ctx = `You are a study assistant grounded ONLY in the material for the subject "${subject?.name}". Use the context below to answer the student's questions. If something isn't covered by the material, say so rather than guessing.\n\n`;
    if (syllabus?.extractedText) ctx += `SYLLABUS:\n${syllabus.extractedText.slice(0, 4000)}\n\n`;
    for (const r of resources.slice(0, 8)) {
      if (r.extractedText) ctx += `RESOURCE (${r.name}):\n${r.extractedText.slice(0, 2000)}\n\n`;
    }
    for (const l of lectures.slice(0, 15)) {
      if (l.ocrText) ctx += `LECTURE (${l.lectureCode}):\n${l.ocrText.slice(0, 1500)}\n\n`;
    }
    return ctx.slice(0, 24000);
  };

  const send = async () => {
    if (!username || !input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    setError(null);

    if (isGlobalAssistant) {
      // The server persists both turns itself (it needs the student's
      // message to build the assistant's own conversation history), so
      // just show the student's message right away for a snappy feel,
      // then reload the real history once the reply comes back.
      setMessages((prev) => [
        ...prev,
        {
          id: -Date.now(),
          subjectId,
          role: "user",
          content: text,
          createdAt: new Date().toISOString(),
        },
      ]);
      setSending(true);
      try {
        const result = await apiAssistant(text);
        if (!result) throw new Error("No response from the assistant.");
        setMessages(await ChatMessages.forSubject(username, subjectId));
        if (result.action && result.action.type !== "none") {
          await runAssistantAction(result.action, { username, router, setTheme });
        }
      } catch (e: any) {
        setError(e?.message || "Something went wrong reaching ClassVault.");
        setMessages(await ChatMessages.forSubject(username, subjectId));
      } finally {
        setSending(false);
      }
      return;
    }

    await ChatMessages.add(username, subjectId, "user", text);
    const updated = await ChatMessages.forSubject(username, subjectId);
    setMessages(updated);
    setSending(true);
    try {
      const context = await buildContext();
      const history = [
        { role: "user" as const, text: context },
        { role: "model" as const, text: "Understood, I'll answer using that context." },
        ...updated.map((m) => ({ role: (m.role === "user" ? "user" : "model") as "user" | "model", text: m.content })),
      ];
      const reply = await apiChat(history);
      await ChatMessages.add(username, subjectId, "assistant", reply);
      setMessages(await ChatMessages.forSubject(username, subjectId));
    } catch (e: any) {
      setError(e?.message || "Something went wrong reaching Gemini.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-160px)]">
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted py-16">
            <Sparkles className="h-7 w-7 text-brand-500 mx-auto mb-2" />
            {subjectId < 0
              ? "Ask me anything about ClassVault or your studies."
              : `Ask anything about ${subjectName ?? "this subject"} — I'll answer using its syllabus, resources, and lectures.`}
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
            {m.role === "assistant" && (
              <div className="h-8 w-8 rounded-full bg-brand-500 flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
            )}
            <div
              className={`max-w-[75%] rounded-xl2 px-4 py-2.5 text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-brand-500 text-white"
                  : "bg-canvas dark:bg-[#1c1e34] text-ink dark:text-white"
              }`}
            >
              {m.content}
            </div>
            {m.role === "user" && (
              <div className="h-8 w-8 rounded-full bg-canvas dark:bg-[#1c1e34] flex items-center justify-center shrink-0">
                <User className="h-4 w-4 text-muted" />
              </div>
            )}
          </div>
        ))}
        {sending && (
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-full bg-brand-500 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div className="rounded-xl2 px-4 py-2.5 bg-canvas dark:bg-[#1c1e34]">
              <Loader2 className="h-4 w-4 animate-spin text-muted" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-sm text-red-500 mt-2">{error}</p>}

      <div className="flex items-center gap-2 mt-4 border-t border-line dark:border-white/10 pt-4">
        <input
          className="input"
          placeholder="Type a message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button className="btn-primary" onClick={send} disabled={sending || !input.trim()}>
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}