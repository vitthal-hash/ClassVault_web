"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { FileText, Upload, Loader2, Eye } from "lucide-react";
import { useLocalUser } from "@/lib/local/useLocalUser";
import { SyllabusRepo } from "@/lib/local/repo";
import type { Syllabus } from "@/lib/local/types";
import { extractPdfText } from "@/lib/extract";

export function SyllabusTab({ subjectId }: { subjectId: number }) {
  const username = useLocalUser();
  const [syllabus, setSyllabus] = useState<Syllabus | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showText, setShowText] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!username) return;
    setSyllabus(await SyllabusRepo.forSubject(username, subjectId));
  }, [username, subjectId]);

  useEffect(() => {
    load();
  }, [load]);

  const onUpload = async (file: File) => {
    if (!username) return;
    setUploading(true);
    try {
      let text: string | null = null;
      if (file.type === "application/pdf") {
        text = await extractPdfText(file);
      }
      await SyllabusRepo.upsert(username, subjectId, file, text);
      load();
    } finally {
      setUploading(false);
    }
  };

  const openFile = () => {
    if (!syllabus) return;
    window.open(syllabus.fileRef, "_blank");
  };

  return (
    <div className="card p-6">
      {!syllabus ? (
        <div className="text-center py-10">
          <FileText className="h-8 w-8 text-brand-500 mx-auto mb-3" />
          <p className="text-sm text-muted mb-4">No syllabus uploaded yet.</p>
          <button
            className="btn-primary"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload syllabus (PDF)
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
          />
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-brand-50 dark:bg-brand-500/15 flex items-center justify-center">
                <FileText className="h-5 w-5 text-brand-500" />
              </div>
              <div>
                <p className="font-semibold text-ink dark:text-white">{syllabus.fileName}</p>
                <p className="text-xs text-muted">
                  Uploaded {new Date(syllabus.uploadedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary text-xs" onClick={openFile}>
                <Eye className="h-3.5 w-3.5" /> View
              </button>
              <button
                className="btn-secondary text-xs"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Replace
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
              />
            </div>
          </div>
          {syllabus.extractedText && (
            <div>
              <button
                className="text-sm font-semibold text-brand-500 hover:underline"
                onClick={() => setShowText((s) => !s)}
              >
                {showText ? "Hide extracted text" : "View extracted text"}
              </button>
              {showText && (
                <div className="mt-3 max-h-72 overflow-y-auto rounded-xl bg-canvas dark:bg-[#101223] p-4 text-sm text-ink dark:text-white whitespace-pre-wrap">
                  {syllabus.extractedText}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
