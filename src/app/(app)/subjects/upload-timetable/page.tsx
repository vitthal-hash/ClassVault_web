"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, Trash2, Plus, ArrowLeft, PencilLine, FileImage } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { useLocalUser } from "@/lib/local/useLocalUser";
import { Semesters, Subjects, Teachers, TimetableEntries } from "@/lib/local/repo";
import { parseTimetableText, ParsedRow } from "@/lib/timetableParser";
import { ocrImage, extractPdfText } from "@/lib/extract";
import { WEEKDAYS, weekdayLabel } from "@/lib/local/types";
import type { SessionType, Weekday } from "@/lib/local/types";

function blankRow(): ParsedRow {
  return {
    id: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    day: "monday",
    startMinutes: 9 * 60,
    endMinutes: 10 * 60,
    subjectName: "",
    sessionType: "theory",
    teacherName: null,
    room: null,
    sourceLine: null,
  };
}

export default function UploadTimetablePage() {
  const username = useLocalUser();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  // Whether we've moved past the "how do you want to add your timetable"
  // choice into the row editor - true whether rows came from an uploaded
  // file or were started from scratch.
  const [started, setStarted] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (file: File) => {
    setError(null);
    setExtracting(true);
    setProgress(0);
    try {
      let text = "";
      if (file.type === "application/pdf") {
        text = await extractPdfText(file);
      } else if (file.type.startsWith("image/")) {
        text = await ocrImage(file, setProgress);
      } else {
        setError("Please upload an image or PDF of your timetable.");
        return;
      }
      setRows(parseTimetableText(text));
      setStarted(true);
    } catch (e: any) {
      setError(e?.message || "Couldn't extract text from that file.");
    } finally {
      setExtracting(false);
    }
  };

  const startManually = () => {
    setError(null);
    setRows([blankRow()]);
    setStarted(true);
  };

  const updateRow = (id: string, patch: Partial<ParsedRow>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRow = (id: string) => {
    setRows((rs) => rs.filter((r) => r.id !== id));
  };

  const addManualRow = () => {
    setRows((rs) => [...rs, blankRow()]);
  };

  const save = async () => {
    if (!username) return;
    setSaving(true);
    setError(null);
    try {
      const semester = await Semesters.activeOne(username);
      if (!semester) {
        setError("Create a semester first.");
        return;
      }
      const complete = rows.filter(
        (r) => r.day && r.startMinutes != null && r.endMinutes != null && r.subjectName.trim()
      );
      if (complete.length === 0) {
        setError("No complete rows to save. Fill in day/time/subject on at least one row.");
        return;
      }
      for (const row of complete) {
        const subject = await Subjects.findOrCreate(username, semester.id, row.subjectName);
        let teacherId: number | undefined;
        if (row.teacherName) {
          const teacher = await Teachers.findOrCreate(username, row.teacherName);
          teacherId = teacher?.id;
        }
        await TimetableEntries.create(username, {
          semesterId: semester.id,
          subjectId: subject.id,
          teacherId: teacherId ?? null,
          day: row.day as Weekday,
          startMinutes: row.startMinutes as number,
          endMinutes: row.endMinutes as number,
          sessionType: row.sessionType,
          room: row.room,
        });
      }
      router.push("/subjects");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <TopBar crumbs={["Workspace", "Subjects", "Upload timetable"]} />
      <div className="px-8 pb-14 max-w-4xl">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-muted hover:text-ink mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <h1 className="text-2xl font-bold text-ink dark:text-white mb-1">Set up your timetable</h1>
        <p className="text-sm text-muted mb-6">
          Upload a photo or PDF and we&apos;ll extract the schedule automatically, or type it in
          yourself — either way you&apos;ll review every row before it&apos;s saved.
        </p>

        {!started && (
          <div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="card p-8 text-center flex flex-col items-center">
                {extracting ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin text-brand-500 mb-3" />
                    <p className="text-sm text-muted">
                      Extracting text… {progress > 0 ? `${Math.round(progress * 100)}%` : ""}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="h-12 w-12 rounded-2xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center mb-4">
                      <FileImage className="h-5 w-5 text-brand-500" />
                    </div>
                    <h2 className="font-semibold text-ink dark:text-white mb-1">
                      Upload a photo or PDF
                    </h2>
                    <p className="text-xs text-muted mb-5">
                      We&apos;ll read it on-device and auto-fill the rows for you.
                    </p>
                    <button className="btn-primary" onClick={() => fileInput.current?.click()}>
                      <Upload className="h-4 w-4" /> Choose file
                    </button>
                    <input
                      ref={fileInput}
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
                    />
                  </>
                )}
              </div>

              <div className="card p-8 text-center flex flex-col items-center">
                <div className="h-12 w-12 rounded-2xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center mb-4">
                  <PencilLine className="h-5 w-5 text-brand-500" />
                </div>
                <h2 className="font-semibold text-ink dark:text-white mb-1">Enter it manually</h2>
                <p className="text-xs text-muted mb-5">
                  No photo needed — add each class straight into the table.
                </p>
                <button className="btn-secondary" onClick={startManually}>
                  <Plus className="h-4 w-4" /> Start from scratch
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-red-500 mt-4">{error}</p>}
          </div>
        )}

        {started && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-ink dark:text-white">
                Review your rows ({rows.length})
              </h2>
              <button className="btn-secondary text-xs" onClick={addManualRow}>
                <Plus className="h-3.5 w-3.5" /> Add row
              </button>
            </div>

            {rows.length === 0 && (
              <div className="card p-8 text-center text-sm text-muted mb-3">
                No rows yet — add one to get started.
              </div>
            )}

            <div className="space-y-3">
              {rows.map((row) => (
                <div key={row.id} className="card p-4 grid grid-cols-1 md:grid-cols-6 gap-2 items-center">
                  <select
                    className="input md:col-span-1"
                    value={row.day ?? ""}
                    onChange={(e) => updateRow(row.id, { day: (e.target.value || null) as Weekday | null })}
                  >
                    <option value="">Day</option>
                    {WEEKDAYS.map((d) => (
                      <option key={d} value={d}>
                        {weekdayLabel(d)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="time"
                    className="input md:col-span-1"
                    value={row.startMinutes != null ? minutesToInput(row.startMinutes) : ""}
                    onChange={(e) => updateRow(row.id, { startMinutes: inputToMinutes(e.target.value) })}
                  />
                  <input
                    type="time"
                    className="input md:col-span-1"
                    value={row.endMinutes != null ? minutesToInput(row.endMinutes) : ""}
                    onChange={(e) => updateRow(row.id, { endMinutes: inputToMinutes(e.target.value) })}
                  />
                  <input
                    className="input md:col-span-2"
                    placeholder="Subject"
                    value={row.subjectName}
                    onChange={(e) => updateRow(row.id, { subjectName: e.target.value })}
                  />
                  <select
                    className="input md:col-span-1"
                    value={row.sessionType}
                    onChange={(e) => updateRow(row.id, { sessionType: e.target.value as SessionType })}
                  >
                    <option value="theory">Theory</option>
                    <option value="lab">Lab</option>
                    <option value="tutorial">Tutorial</option>
                  </select>
                  <input
                    className="input md:col-span-2"
                    placeholder="Teacher (optional)"
                    value={row.teacherName ?? ""}
                    onChange={(e) => updateRow(row.id, { teacherName: e.target.value || null })}
                  />
                  <input
                    className="input md:col-span-2"
                    placeholder="Room (optional)"
                    value={row.room ?? ""}
                    onChange={(e) => updateRow(row.id, { room: e.target.value || null })}
                  />
                  <button
                    onClick={() => removeRow(row.id)}
                    className="text-muted hover:text-red-500 justify-self-end md:col-span-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  {row.sourceLine && (
                    <p className="text-xs text-muted md:col-span-6 truncate">
                      Source: &ldquo;{row.sourceLine}&rdquo;
                    </p>
                  )}
                </div>
              ))}
            </div>

            {error && <p className="text-sm text-red-500 mt-4">{error}</p>}

            <div className="flex gap-2 mt-6">
              <button
                className="btn-secondary"
                onClick={() => {
                  setStarted(false);
                  setRows([]);
                }}
              >
                Start over
              </button>
              <button className="btn-primary" onClick={save} disabled={saving || rows.length === 0}>
                {saving ? "Saving…" : `Save ${rows.length} row${rows.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function minutesToInput(m: number) {
  const h = Math.floor(m / 60).toString().padStart(2, "0");
  const mm = (m % 60).toString().padStart(2, "0");
  return `${h}:${mm}`;
}
function inputToMinutes(v: string): number | null {
  if (!v) return null;
  const [h, m] = v.split(":").map(Number);
  return h * 60 + m;
}