"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Upload,
  Star,
  Loader2,
  X,
  Copy,
  Share2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useLocalUser } from "@/lib/local/useLocalUser";
import { Lectures, Subjects } from "@/lib/local/repo";
import type { Lecture, SessionType, Subject } from "@/lib/local/types";
import { AI_ACTIONS, UNSORTED_UNIT } from "@/lib/local/types";
import { UnitBar, UnitSelect } from "@/components/UnitBar";
import { ocrImage } from "@/lib/extract";
import { apiGenerate } from "@/lib/api/client";

export function LecturesTab({ subjectId }: { subjectId: number }) {
  const username = useLocalUser();
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [uploading, setUploading] = useState(false);
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const [detail, setDetail] = useState<Lecture | null>(null);
  const [sessionType, setSessionType] = useState<SessionType>("theory");
  const [activeUnit, setActiveUnit] = useState<string | null>(null);
  const [uploadUnit, setUploadUnit] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!username) return;
    const all = await Lectures.forSubject(username, subjectId);
    const filtered = all
      .filter((l) => l.sessionType === sessionType)
      .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());
    setLectures(filtered);
    setSubject((await Subjects.get(username, subjectId)) ?? null);

    const urls: Record<number, string> = {};
    for (const l of filtered) {
      if (l.imageRef) urls[l.id] = l.imageRef;
    }
    setThumbs(urls);
  }, [username, subjectId, sessionType]);

  useEffect(() => {
    load();
  }, [load]);

  // When a unit is selected, new uploads default into it.
  useEffect(() => {
    setUploadUnit(activeUnit === UNSORTED_UNIT ? null : activeUnit);
  }, [activeUnit]);

  const onUpload = async (files: FileList) => {
    if (!username || !subject) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const code = await Lectures.nextCode(username, subject, sessionType);
        const created = await Lectures.create(username, subjectId, sessionType, code, file, uploadUnit);
        try {
          const text = await ocrImage(file);
          await Lectures.update(username, { ...created, ocrText: text });
        } catch {
          // OCR is best-effort; the lecture still saves without text
        }
      }
      load();
    } finally {
      setUploading(false);
    }
  };

  const toggleStar = async (id: number) => {
    if (!username) return;
    await Lectures.toggleStar(username, id);
    load();
    if (detail?.id === id) {
      const updated = await Lectures.get(username, id);
      if (updated) setDetail(updated);
    }
  };

  const remove = async (id: number) => {
    if (!username) return;
    await Lectures.remove(username, id);
    setDetail(null);
    load();
  };

  const units = subject?.units ?? [];
  const counts: Record<string, number> = {};
  for (const u of units) counts[u] = lectures.filter((l) => l.unit === u).length;
  const unsortedCount = lectures.filter((l) => !l.unit || !units.includes(l.unit)).length;
  const visible =
    activeUnit === null
      ? lectures
      : activeUnit === UNSORTED_UNIT
      ? lectures.filter((l) => !l.unit || !units.includes(l.unit))
      : lectures.filter((l) => l.unit === activeUnit);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex rounded-xl2 border border-line dark:border-white/10 p-1 bg-canvas">
          {(["theory", "lab", "tutorial"] as SessionType[]).map((s) => (
            <button
              key={s}
              onClick={() => setSessionType(s)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition ${
                sessionType === s ? "bg-brand-500 text-white" : "text-muted"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <UnitSelect units={units} value={uploadUnit} onChange={setUploadUnit} className="w-36" />
          <button className="btn-primary text-sm" onClick={() => fileInput.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload photo
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => e.target.files && onUpload(e.target.files)}
        />
      </div>

      <UnitBar
        units={units}
        active={activeUnit}
        onSelect={setActiveUnit}
        counts={counts}
        unsortedCount={unsortedCount}
        onCreate={async (name) => {
          if (!username) return;
          await Subjects.addUnit(username, subjectId, name);
          await load();
        }}
        onRename={async (from, to) => {
          if (!username) return;
          await Subjects.renameUnit(username, subjectId, from, to);
          if (activeUnit === from) setActiveUnit(to);
          await load();
        }}
        onDelete={async (name) => {
          if (!username) return;
          await Subjects.removeUnit(username, subjectId, name);
          await load();
        }}
      />

      {visible.length === 0 ? (
        <div className="card p-10 text-center text-sm text-muted">
          {lectures.length === 0 ? "No lectures uploaded yet." : `No lectures in ${activeUnit} yet.`}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {visible.map((l) => (
            <button
              key={l.id}
              onClick={() => setDetail(l)}
              className="card overflow-hidden text-left relative group"
            >
              {thumbs[l.id] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbs[l.id]} alt={l.lectureCode} className="w-full h-28 object-cover" />
              ) : (
                <div className="w-full h-28 bg-canvas" />
              )}
              {l.isStarred && (
                <Star className="absolute top-2 right-2 h-4 w-4 text-amber-400 fill-amber-400" />
              )}
              <div className="p-2.5">
                <p className="text-xs font-semibold text-ink dark:text-white truncate">{l.lectureCode}</p>
                <p className="text-[11px] text-muted truncate">
                  {l.unit ? `${l.unit} · ` : ""}
                  {l.ocrText ? "Reviewed" : "Pending OCR"}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {detail && (
        <LectureDetail
          lecture={detail}
          imageUrl={thumbs[detail.id]}
          onClose={() => setDetail(null)}
          onStar={() => toggleStar(detail.id)}
          onDelete={() => remove(detail.id)}
          onTextSaved={(text) => setDetail({ ...detail, ocrText: text })}
        />
      )}
    </div>
  );
}

function LectureDetail({
  lecture,
  imageUrl,
  onClose,
  onStar,
  onDelete,
  onTextSaved,
}: {
  lecture: Lecture;
  imageUrl?: string;
  onClose: () => void;
  onStar: () => void;
  onDelete: () => void;
  onTextSaved: (t: string) => void;
}) {
  const username = useLocalUser();
  const [text, setText] = useState(lecture.ocrText ?? "");
  const [saving, setSaving] = useState(false);
  const [aiRunning, setAiRunning] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<{ action: string; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setText(lecture.ocrText ?? "");
    setAiResult(null);
  }, [lecture.id]);

  const save = async () => {
    if (!username) return;
    setSaving(true);
    try {
      await Lectures.update(username, { ...lecture, ocrText: text });
      onTextSaved(text);
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (actionId: string) => {
    if (!username || !text.trim()) return;
    const action = AI_ACTIONS.find((a) => a.id === actionId);
    if (!action) return;
    setAiRunning(actionId);
    setError(null);
    setAiResult(null);
    try {
      const prompt = `${action.instruction}\n\n---\n\n${text}`;
      const result = await apiGenerate(prompt);
      setAiResult({ action: action.label, text: result });
    } catch (e: any) {
      setError(e?.message || "Something went wrong calling Gemini.");
    } finally {
      setAiRunning(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-end z-40">
      <div className="w-full max-w-xl bg-surface h-full overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-ink dark:text-white">{lecture.lectureCode}</h3>
          <div className="flex items-center gap-3">
            <button onClick={onStar} className={lecture.isStarred ? "text-amber-400" : "text-muted hover:text-ink"}>
              <Star className="h-5 w-5" fill={lecture.isStarred ? "currentColor" : "none"} />
            </button>
            <button onClick={onDelete} className="text-muted hover:text-red-500">
              <Trash2 className="h-5 w-5" />
            </button>
            <button onClick={onClose} className="text-muted hover:text-ink">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={lecture.lectureCode} className="w-full rounded-xl2 mb-5 max-h-64 object-cover" />
        )}

        <label className="label">OCR text (editable)</label>
        <textarea
          className="input min-h-[140px] mb-2"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn-secondary text-xs mb-6" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save text"}
        </button>

        <h4 className="font-semibold text-ink dark:text-white mb-3">AI actions</h4>
        <div className="flex flex-wrap gap-2 mb-4">
          {AI_ACTIONS.map((a) => (
            <button
              key={a.id}
              className="btn-secondary text-xs"
              onClick={() => runAction(a.id)}
              disabled={!!aiRunning || !text.trim()}
            >
              {aiRunning === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {a.label}
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

        {aiResult && (
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-brand-500">{aiResult.action}</p>
              <div className="flex gap-2">
                <button
                  className="text-muted hover:text-ink"
                  onClick={() => navigator.clipboard.writeText(aiResult.text)}
                  title="Copy"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  className="text-muted hover:text-ink"
                  onClick={() =>
                    navigator.share
                      ? navigator.share({ text: aiResult.text })
                      : navigator.clipboard.writeText(aiResult.text)
                  }
                  title="Share"
                >
                  <Share2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="text-sm whitespace-pre-wrap text-ink dark:text-white max-h-72 overflow-y-auto">
              {aiResult.text}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}