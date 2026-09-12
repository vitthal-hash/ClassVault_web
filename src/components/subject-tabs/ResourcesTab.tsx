"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Upload, FileText, Image as ImageIcon, Presentation, FileType, Trash2, Loader2, Sparkles } from "lucide-react";
import { useLocalUser } from "@/lib/local/useLocalUser";
import { Resources } from "@/lib/local/repo";
import type { Resource, ResourceType } from "@/lib/local/types";
import { resourceTypeFromExtension } from "@/lib/local/types";
import { extractPdfText, extractDocxText, extractPptxText, ocrImage } from "@/lib/extract";

const ICONS: Record<ResourceType, any> = {
  pdf: FileText,
  ppt: Presentation,
  word: FileType,
  image: ImageIcon,
};

export function ResourcesTab({ subjectId }: { subjectId: number }) {
  const username = useLocalUser();
  const [items, setItems] = useState<Resource[]>([]);
  const [uploading, setUploading] = useState(false);
  const [extractingId, setExtractingId] = useState<number | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!username) return;
    const all = await Resources.forSubject(username, subjectId);
    setItems(all.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()));
  }, [username, subjectId]);

  useEffect(() => {
    load();
  }, [load]);

  const onUpload = async (files: FileList) => {
    if (!username) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const type = resourceTypeFromExtension(file.name);
        if (!type) continue;
        let text: string | null = null;
        try {
          if (type === "pdf") text = await extractPdfText(file);
          else if (type === "image") text = await ocrImage(file);
          else if (type === "word") text = await extractDocxText(file);
          else if (type === "ppt") text = await extractPptxText(file);
        } catch {
          // Extraction is best-effort (e.g. legacy binary .doc/.ppt files
          // can't be parsed this way) — upload still succeeds without text,
          // it just won't be visible to the subject AI assistant.
        }
        await Resources.create(username, subjectId, file, type, text);
      }
      load();
    } finally {
      setUploading(false);
    }
  };

  const openFile = (r: Resource) => {
    // Browsers can render PDFs and images natively, so those open directly.
    // PPT/DOC/DOCX have no built-in browser viewer and would otherwise just
    // download - route those through Microsoft's Office Online viewer so
    // they display inline instead.
    if (r.type === "ppt" || r.type === "word") {
      const viewerUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(
        r.fileRef
      )}`;
      window.open(viewerUrl, "_blank");
    } else {
      window.open(r.fileRef, "_blank");
    }
  };

  const remove = async (id: number) => {
    if (!username) return;
    await Resources.remove(username, id);
    load();
  };

  const reextract = async (r: Resource) => {
    setExtractingId(r.id);
    setExtractError(null);
    try {
      await Resources.reextract(r);
      load();
    } catch (e: any) {
      setExtractError(e?.message || `Could not extract text from ${r.name}.`);
    } finally {
      setExtractingId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted">PDFs, PPTs, Word docs, and images for this subject.</p>
        <button className="btn-primary text-sm" onClick={() => fileInput.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Upload files
        </button>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept=".pdf,.ppt,.pptx,.doc,.docx,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={(e) => e.target.files && onUpload(e.target.files)}
        />
      </div>

      {extractError && <p className="text-sm text-red-500 mb-3">{extractError}</p>}

      {items.length === 0 ? (
        <div className="card p-10 text-center text-sm text-muted">No resources uploaded yet.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map((r) => {
            const Icon = ICONS[r.type];
            return (
              <div key={r.id} className="card p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-brand-50 dark:bg-brand-500/15 flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-brand-500" />
                </div>
                <button onClick={() => openFile(r)} className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-ink dark:text-white truncate">{r.name}</p>
                  <p className="text-xs text-muted">
                    {r.type.toUpperCase()} · {new Date(r.uploadedAt).toLocaleDateString()}
                    {r.extractedText ? " · Visible to AI" : " · Not readable by AI yet"}
                  </p>
                </button>
                {!r.extractedText && (
                  <button
                    onClick={() => reextract(r)}
                    disabled={extractingId === r.id}
                    className="text-muted hover:text-brand-500"
                    title="Extract text so the subject AI can read this file"
                  >
                    {extractingId === r.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </button>
                )}
                <button onClick={() => remove(r.id)} className="text-muted hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}