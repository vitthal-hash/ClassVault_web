"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Plus, X, FileText, CheckCircle2, Circle } from "lucide-react";
import { useLocalUser } from "@/lib/local/useLocalUser";
import { Assignments } from "@/lib/local/repo";
import type { Assignment } from "@/lib/local/types";
import { isAssignmentOverdue } from "@/lib/local/types";

export function AssignmentsTab({
  subjectId,
  initialTitle,
  initialDeadline,
  autoOpen,
}: {
  subjectId: number;
  /** Pre-fills the "New assignment" form - used when the ClassVault
   *  assistant hands off here after the student agreed to attach a file. */
  initialTitle?: string;
  /** yyyy-mm-dd, matching the <input type="date"> value shape. */
  initialDeadline?: string;
  /** Opens the "New assignment" form immediately on mount. */
  autoOpen?: boolean;
}) {
  const username = useLocalUser();
  const [items, setItems] = useState<Assignment[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState(initialTitle ?? "");
  const [deadline, setDeadline] = useState(initialDeadline ?? "");
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    if (!username) return;
    setItems(await Assignments.forSubject(username, subjectId));
  }, [username, subjectId]);

  useEffect(() => {
    load();
  }, [load]);

  // Runs once, on the deep-link from the assistant's "attach a file"
  // hand-off - opens the form with the title/deadline it already
  // collected in chat, ready for the student to tap "Attach".
  useEffect(() => {
    if (autoOpen) setShowForm(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = async () => {
    if (!username || !title.trim() || !deadline) return;
    await Assignments.create(username, subjectId, title.trim(), new Date(deadline).toISOString(), file);
    setTitle("");
    setDeadline("");
    setFile(null);
    setShowForm(false);
    load();
  };

  const toggle = async (id: number) => {
    if (!username) return;
    await Assignments.toggleStatus(username, id);
    load();
  };

  const openFile = (a: Assignment) => {
    if (!a.fileRef) return;
    // Browsers render PDFs natively, but have no built-in viewer for
    // .doc/.docx - route those through Microsoft's Office Online viewer
    // so they display inline instead of just downloading.
    const isWord = /\.docx?$/i.test(a.fileName ?? "");
    if (isWord) {
      const viewerUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(
        a.fileRef
      )}`;
      window.open(viewerUrl, "_blank");
    } else {
      window.open(a.fileRef, "_blank");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted">Sorted by soonest deadline first.</p>
        <button className="btn-primary text-sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" /> New assignment
        </button>
      </div>

      {items.length === 0 ? (
        <div className="card p-10 text-center text-sm text-muted">No assignments yet.</div>
      ) : (
        <div className="space-y-2">
          {items.map((a) => {
            const overdue = isAssignmentOverdue(a);
            return (
              <div key={a.id} className="card p-4 flex items-center gap-3">
                <button onClick={() => toggle(a.id)} className={a.status === "submitted" ? "text-green-500" : "text-muted"}>
                  {a.status === "submitted" ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink dark:text-white truncate">{a.title}</p>
                  <p className={`text-xs ${overdue ? "text-red-500" : "text-muted"}`}>
                    Due {new Date(a.deadline).toLocaleDateString()} {overdue ? "· Overdue" : ""}
                  </p>
                </div>
                {a.fileRef && (
                  <button onClick={() => openFile(a)} className="text-muted hover:text-brand-500">
                    <FileText className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => toggle(a.id)}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    a.status === "submitted"
                      ? "bg-green-50 dark:bg-green-500/15 text-green-600 dark:text-green-400"
                      : overdue
                      ? "bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400"
                      : "bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {a.status === "submitted" ? "Submitted" : overdue ? "Overdue" : "Pending"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-30 p-4">
          <div className="card w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-ink dark:text-white">New assignment</h3>
              <button onClick={() => setShowForm(false)} className="text-muted hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Title</label>
                <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <label className="label">Deadline</label>
                <input
                  type="date"
                  className="input"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
              <div>
                <label className="label">File (optional)</label>
                <button className="btn-secondary w-full justify-center" onClick={() => fileInput.current?.click()}>
                  {file ? file.name : "Attach PDF/Word"}
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <button className="btn-primary w-full justify-center" onClick={create}>
                Save assignment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}