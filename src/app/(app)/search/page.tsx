"use client";

import { useState } from "react";
import Link from "next/link";
import { Search as SearchIcon, FileText, BookOpen, StickyNote, ClipboardList, Image as ImageIcon } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { useLocalUser } from "@/lib/local/useLocalUser";
import {
  Subjects,
  Resources,
  Lectures,
  Notes,
  Assignments,
  SyllabusRepo,
} from "@/lib/local/repo";

interface Hit {
  kind: "subject" | "resource" | "lecture" | "note" | "assignment" | "syllabus";
  title: string;
  subtitle: string;
  href: string;
}

export default function SearchPage() {
  const username = useLocalUser();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Hit[] | null>(null);

  const runSearch = async (q: string) => {
    if (!username || !q.trim()) {
      setResults(null);
      return;
    }
    const needle = q.trim().toLowerCase();
    const hits: Hit[] = [];

    const subjects = await Subjects.all(username);
    const subjectMap = new Map(subjects.map((s) => [s.id, s]));
    for (const s of subjects) {
      if (s.name.toLowerCase().includes(needle) || s.code?.toLowerCase().includes(needle)) {
        hits.push({ kind: "subject", title: s.name, subtitle: s.code || "Subject", href: `/subjects/${s.id}` });
      }
    }

    const resources = await Resources.all(username);
    for (const r of resources) {
      if (
        r.name.toLowerCase().includes(needle) ||
        r.extractedText?.toLowerCase().includes(needle)
      ) {
        const subj = subjectMap.get(r.subjectId);
        hits.push({
          kind: "resource",
          title: r.name,
          subtitle: subj ? `Resource · ${subj.name}` : "Resource",
          href: `/subjects/${r.subjectId}`,
        });
      }
    }

    const lectures = await Lectures.all(username);
    for (const l of lectures) {
      if (l.lectureCode.toLowerCase().includes(needle) || l.ocrText?.toLowerCase().includes(needle)) {
        const subj = subjectMap.get(l.subjectId);
        hits.push({
          kind: "lecture",
          title: l.lectureCode,
          subtitle: subj ? `Lecture · ${subj.name}` : "Lecture",
          href: `/subjects/${l.subjectId}`,
        });
      }
    }

    const notes = await Notes.all(username);
    for (const n of notes) {
      if (n.body.toLowerCase().includes(needle) || n.title?.toLowerCase().includes(needle)) {
        const subj = subjectMap.get(n.subjectId);
        hits.push({
          kind: "note",
          title: n.title || n.body.slice(0, 40),
          subtitle: subj ? `Note · ${subj.name}` : "Note",
          href: `/subjects/${n.subjectId}`,
        });
      }
    }

    const assignments = await Assignments.all(username);
    for (const a of assignments) {
      if (a.title.toLowerCase().includes(needle)) {
        const subj = subjectMap.get(a.subjectId);
        hits.push({
          kind: "assignment",
          title: a.title,
          subtitle: subj ? `Assignment · ${subj.name}` : "Assignment",
          href: `/subjects/${a.subjectId}`,
        });
      }
    }

    for (const s of subjects) {
      const syl = await SyllabusRepo.forSubject(username, s.id);
      if (syl && (syl.fileName.toLowerCase().includes(needle) || syl.extractedText?.toLowerCase().includes(needle))) {
        hits.push({ kind: "syllabus", title: syl.fileName, subtitle: `Syllabus · ${s.name}`, href: `/subjects/${s.id}` });
      }
    }

    setResults(hits);
  };

  const iconFor = (k: Hit["kind"]) => {
    switch (k) {
      case "subject":
        return BookOpen;
      case "resource":
        return FileText;
      case "lecture":
        return ImageIcon;
      case "note":
        return StickyNote;
      case "assignment":
        return ClipboardList;
      case "syllabus":
        return FileText;
    }
  };

  return (
    <div>
      <TopBar crumbs={["Workspace", "Search"]} />
      <div className="px-8 pb-14 max-w-2xl">
        <div className="relative mb-6">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            className="input !pl-11"
            placeholder="Search subjects, lectures, resources, notes, assignments…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              runSearch(e.target.value);
            }}
            autoFocus
          />
        </div>

        {results === null ? (
          <p className="text-sm text-muted text-center py-16">
            Search across everything in your active workspace.
          </p>
        ) : results.length === 0 ? (
          <p className="text-sm text-muted text-center py-16">No results for &ldquo;{query}&rdquo;.</p>
        ) : (
          <div className="space-y-2">
            {results.map((r, i) => {
              const Icon = iconFor(r.kind);
              return (
                <Link key={i} href={r.href} className="card p-4 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-brand-50 dark:bg-brand-500/15 flex items-center justify-center shrink-0">
                    <Icon className="h-4.5 w-4.5 text-brand-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink dark:text-white truncate">{r.title}</p>
                    <p className="text-xs text-muted truncate">{r.subtitle}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
