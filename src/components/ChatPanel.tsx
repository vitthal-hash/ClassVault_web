"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, Sparkles, User, Paperclip, X } from "lucide-react";
import { useLocalUser } from "@/lib/local/useLocalUser";
import { ChatMessages } from "@/lib/local/repo";
import type { ChatMessage } from "@/lib/local/types";
import { AI_ACTIONS, GLOBAL_ASSISTANT_SUBJECT_ID } from "@/lib/local/types";
import { apiSubjectChat, apiAssistant } from "@/lib/api/client";
import { extractDocxText, extractPdfText, extractPptxText, ocrImage } from "@/lib/extract";
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
  const [attachments, setAttachments] = useState<{ name: string; text: string }[]>([]);
  const [extracting, setExtracting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
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

  const addFiles = async (files: FileList | null) => {
    if (!files || isGlobalAssistant) return;
    setError(null);
    setExtracting(true);
    try {
      const extracted = await Promise.all(Array.from(files).slice(0, 3).map(async (file) => {
        if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} is over the 10 MB chat limit.`);
        let text = "";
        if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) text = await extractPdfText(file);
        else if (file.type.startsWith("image/")) text = await ocrImage(file);
        else if (/\.docx$/i.test(file.name)) text = await extractDocxText(file);
        else if (/\.pptx$/i.test(file.name)) text = await extractPptxText(file);
        else if (/\.(txt|md|csv)$/i.test(file.name)) text = await file.text();
        else throw new Error(`${file.name} is unsupported. Attach a PDF, image, DOCX, PPTX, TXT, MD, or CSV file.`);
        if (!text.trim()) throw new Error(`No readable text was found in ${file.name}.`);
        return { name: file.name, text: text.slice(0, 30_000) };
      }));
      setAttachments((current) => [...current, ...extracted].slice(0, 3));
    } catch (e: any) {
      setError(e?.message || "Could not read that attachment.");
    } finally {
      setExtracting(false);
      if (fileInput.current) fileInput.current.value = "";
    }
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

    const attached = attachments;
    setAttachments([]);
    setMessages((prev) => [...prev, { id: -Date.now(), subjectId, role: "user", content: `${text}${attached.length ? `\n\n[Attached: ${attached.map((a) => a.name).join(", ")}]` : ""}`, createdAt: new Date().toISOString() }]);
    setSending(true);
    try {
      await apiSubjectChat(subjectId, text, attached);
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
              : `Ask about ${subjectName ?? "this subject"}. I use its syllabus, notes, resources, lectures, and assignments — or attach a file just for this chat.`}
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
                  : "bg-canvas dark:bg-surface2 text-ink dark:text-white"
              }`}
            >
              {m.content}
            </div>
            {m.role === "user" && (
              <div className="h-8 w-8 rounded-full bg-canvas dark:bg-surface2 flex items-center justify-center shrink-0">
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
            <div className="rounded-xl2 px-4 py-2.5 bg-canvas dark:bg-surface2">
              <Loader2 className="h-4 w-4 animate-spin text-muted" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-sm text-red-500 mt-2">{error}</p>}

      {!isGlobalAssistant && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {AI_ACTIONS.map((action) => (
            <button
              key={action.id}
              className="btn-secondary shrink-0 text-xs"
              disabled={sending || extracting}
              title={action.instruction}
              onClick={() => setInput(action.instruction)}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {!isGlobalAssistant && attachments.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <span key={attachment.name} className="inline-flex items-center gap-1 rounded-full bg-brand-50 dark:bg-brand-500/15 px-3 py-1 text-xs text-brand-600 dark:text-brand-300">
              <Paperclip className="h-3 w-3" /> {attachment.name}
              <button aria-label={`Remove ${attachment.name}`} onClick={() => setAttachments((items) => items.filter((item) => item !== attachment))}><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-4 border-t border-line dark:border-white/10 pt-4">
        {!isGlobalAssistant && (
          <>
            <button className="btn-secondary px-3" title="Attach a file to this subject chat" onClick={() => fileInput.current?.click()} disabled={sending || extracting || attachments.length >= 3}>
              {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
            </button>
            <input ref={fileInput} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.pptx,.txt,.md,.csv" className="hidden" onChange={(e) => addFiles(e.target.files)} />
          </>
        )}
        <input
          className="input"
          placeholder="Type a message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button className="btn-primary" onClick={send} disabled={sending || extracting || !input.trim()}>
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
