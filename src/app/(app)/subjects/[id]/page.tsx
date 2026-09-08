"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Pin, Tag, X } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { useLocalUser } from "@/lib/local/useLocalUser";
import { Subjects } from "@/lib/local/repo";
import type { Subject, SubjectSection } from "@/lib/local/types";
import { colorFor } from "@/lib/palette";
import { ScheduleTab } from "@/components/subject-tabs/ScheduleTab";
import { SyllabusTab } from "@/components/subject-tabs/SyllabusTab";
import { ResourcesTab } from "@/components/subject-tabs/ResourcesTab";
import { LecturesTab } from "@/components/subject-tabs/LecturesTab";
import { AssignmentsTab } from "@/components/subject-tabs/AssignmentsTab";
import { NotesTab } from "@/components/subject-tabs/NotesTab";
import { ChatPanel } from "@/components/ChatPanel";

const TABS: { id: SubjectSection; label: string }[] = [
  { id: "theory", label: "Theory" },
  { id: "lab", label: "Lab" },
  { id: "tutorial", label: "Tutorial" },
  { id: "resources", label: "Resources" },
  { id: "lectures", label: "Lectures" },
  { id: "assignments", label: "Assignments" },
  { id: "syllabus", label: "Syllabus" },
  { id: "notes", label: "Notes" },
  { id: "aiChat", label: "AI Chat" },
];

const TAB_IDS = new Set(TABS.map((t) => t.id));

export default function SubjectWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const subjectId = Number(params.id);
  const username = useLocalUser();
  const [subject, setSubject] = useState<Subject | null>(null);
  // Supports deep links from the ClassVault assistant, e.g.
  // /subjects/3?tab=assignments&newAssignment=1&title=...&deadline=...
  const requestedTab = searchParams.get("tab");
  const [tab, setTab] = useState<SubjectSection>(
    requestedTab && TAB_IDS.has(requestedTab as SubjectSection) ? (requestedTab as SubjectSection) : "theory"
  );
  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState("");

  const load = useCallback(async () => {
    if (!username) return;
    const s = await Subjects.get(username, subjectId);
    if (!s) {
      router.push("/subjects");
      return;
    }
    setSubject(s);
    setCode(s.code ?? "");
  }, [username, subjectId, router]);

  useEffect(() => {
    load();
  }, [load]);

  const togglePin = async () => {
    if (!username) return;
    await Subjects.togglePin(username, subjectId);
    load();
  };

  const saveCode = async () => {
    if (!username || !subject) return;
    await Subjects.update(username, { ...subject, code: code.trim() || null });
    setShowCode(false);
    load();
  };

  if (!subject) return null;

  return (
    <div>
      <TopBar crumbs={["Workspace", "Subjects", subject.name]} />
      <div className="px-8 pb-14">
        <div className="flex items-center gap-4 mb-6">
          <div
            className="h-14 w-14 rounded-xl2 flex items-center justify-center text-white text-lg font-bold shrink-0"
            style={{ background: colorFor(subject.id) }}
          >
            {subject.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-ink dark:text-white truncate">{subject.name}</h1>
            {subject.code && <p className="text-sm text-muted">{subject.code}</p>}
          </div>
          <button onClick={() => setShowCode(true)} className="btn-secondary text-sm">
            <Tag className="h-4 w-4" /> Code
          </button>
          <button
            onClick={togglePin}
            className={subject.isPinned ? "btn-primary text-sm" : "btn-secondary text-sm"}
          >
            <Pin className="h-4 w-4" fill={subject.isPinned ? "currentColor" : "none"} />
            {subject.isPinned ? "Pinned" : "Pin"}
          </button>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-line dark:border-white/10 mb-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition ${
                tab === t.id
                  ? "border-brand-500 text-brand-500"
                  : "border-transparent text-muted hover:text-ink dark:hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "theory" && <ScheduleTab subjectId={subject.id} sessionType="theory" />}
        {tab === "lab" && <ScheduleTab subjectId={subject.id} sessionType="lab" />}
        {tab === "tutorial" && <ScheduleTab subjectId={subject.id} sessionType="tutorial" />}
        {tab === "resources" && <ResourcesTab subjectId={subject.id} />}
        {tab === "lectures" && <LecturesTab subjectId={subject.id} />}
        {tab === "assignments" && (
          <AssignmentsTab
            subjectId={subject.id}
            initialTitle={searchParams.get("title") ?? undefined}
            initialDeadline={searchParams.get("deadline") ?? undefined}
            autoOpen={searchParams.get("newAssignment") === "1"}
          />
        )}
        {tab === "syllabus" && <SyllabusTab subjectId={subject.id} />}
        {tab === "notes" && <NotesTab subjectId={subject.id} />}
        {tab === "aiChat" && <ChatPanel subjectId={subject.id} subjectName={subject.name} />}
      </div>

      {showCode && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-30 p-4">
          <div className="card w-full max-w-xs p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-ink dark:text-white">Subject code</h3>
              <button onClick={() => setShowCode(false)} className="text-muted hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>
            <input
              className="input mb-4"
              placeholder="e.g. DBMS"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <button className="btn-primary w-full justify-center" onClick={saveCode}>
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}