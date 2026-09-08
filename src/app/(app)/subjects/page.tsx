"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Pin, ChevronRight, Upload, BookOpen } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { useLocalUser } from "@/lib/local/useLocalUser";
import { Semesters, Subjects } from "@/lib/local/repo";
import type { Semester, Subject } from "@/lib/local/types";
import { colorFor } from "@/lib/palette";

export default function SubjectsPage() {
  const username = useLocalUser();
  const [semester, setSemester] = useState<Semester | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");

  const load = useCallback(async () => {
    if (!username) return;
    const active = await Semesters.activeOne(username);
    setSemester(active);
    if (active) setSubjects(await Subjects.forSemester(username, active.id));
  }, [username]);

  useEffect(() => {
    load();
  }, [load]);

  const addSubject = async () => {
    if (!username || !semester || !name.trim()) return;
    await Subjects.findOrCreate(username, semester.id, name.trim());
    setName("");
    setShowAdd(false);
    load();
  };

  const togglePin = async (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    if (!username) return;
    await Subjects.togglePin(username, id);
    load();
  };

  if (!semester) {
    return (
      <div>
        <TopBar crumbs={["Workspace", "Subjects"]} />
        <div className="px-8">
          <div className="card p-10 text-center max-w-lg mx-auto mt-10">
            <BookOpen className="h-8 w-8 text-brand-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-ink dark:text-white mb-1">
              You need an active semester first
            </h2>
            <p className="text-sm text-muted mb-5">
              Subjects live inside a semester. Create one to continue.
            </p>
            <Link href="/semester" className="btn-primary">
              Go to Semester
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <TopBar crumbs={["Workspace", "Subjects"]} />
      <div className="px-8 pb-14">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-ink dark:text-white">Subjects</h1>
            <p className="text-sm text-muted mt-1">{semester.name}</p>
          </div>
          <div className="flex gap-2">
            <Link href="/subjects/upload-timetable" className="btn-secondary">
              <Upload className="h-4 w-4" /> Set up timetable
            </Link>
            <button className="btn-primary" onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4" /> New subject
            </button>
          </div>
        </div>

        {subjects.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-muted mb-4">
              No subjects yet. Set up your timetable (upload or type it in) to auto-create them, or add one manually.
            </p>
            <Link href="/subjects/upload-timetable" className="btn-primary inline-flex">
              <Upload className="h-4 w-4" /> Set up timetable
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjects.map((s) => (
              <Link
                key={s.id}
                href={`/subjects/${s.id}`}
                className="card p-5 flex items-center gap-4 group"
              >
                <div
                  className="h-11 w-11 rounded-xl2 flex items-center justify-center text-white font-bold shrink-0"
                  style={{ background: colorFor(s.id) }}
                >
                  {s.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ink dark:text-white truncate">{s.name}</p>
                  {s.code && <p className="text-xs text-muted">{s.code}</p>}
                </div>
                <button
                  onClick={(e) => togglePin(s.id, e)}
                  className={s.isPinned ? "text-brand-500" : "text-muted hover:text-ink"}
                >
                  <Pin className="h-4 w-4" fill={s.isPinned ? "currentColor" : "none"} />
                </button>
                <ChevronRight className="h-4 w-4 text-muted group-hover:text-brand-500 transition" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-30 p-4">
          <div className="card w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-ink dark:text-white mb-4">New subject</h3>
            <input
              className="input mb-4"
              placeholder="e.g. Database Management Systems"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <button className="btn-secondary flex-1 justify-center" onClick={() => setShowAdd(false)}>
                Cancel
              </button>
              <button className="btn-primary flex-1 justify-center" onClick={addSubject}>
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}