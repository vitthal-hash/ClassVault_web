"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, CheckCircle2, Circle, Trash2, X } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { useLocalUser } from "@/lib/local/useLocalUser";
import { Semesters } from "@/lib/local/repo";
import type { Semester } from "@/lib/local/types";

export default function SemesterPage() {
  const username = useLocalUser();
  const [list, setList] = useState<Semester[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [num, setNum] = useState(1);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!username) return;
    const all = await Semesters.all(username);
    setList(all.sort((a, b) => b.semesterNumber - a.semesterNumber));
  }, [username]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (list.length > 0) setNum(Math.max(...list.map((s) => s.semesterNumber)) + 1);
    setName((n) => n || `Semester ${list.length + 1}`);
  }, [list]);

  const create = async () => {
    if (!username) return;
    setError(null);
    if (!name.trim() || !start || !end) {
      setError("Fill in name, start date, and end date.");
      return;
    }
    if (new Date(end) <= new Date(start)) {
      setError("End date must be after start date.");
      return;
    }
    await Semesters.create(username, {
      name: name.trim(),
      semesterNumber: num,
      startDate: new Date(start).toISOString(),
      endDate: new Date(end).toISOString(),
    });
    setShowForm(false);
    setName("");
    setStart("");
    setEnd("");
    load();
  };

  const setActive = async (id: number) => {
    if (!username) return;
    await Semesters.setActive(username, id);
    load();
  };

  const remove = async (id: number) => {
    if (!username) return;
    if (!confirm("Delete this semester? Subjects and data linked to it will remain but be unreachable from Home.")) return;
    await Semesters.remove(username, id);
    load();
  };

  return (
    <div>
      <TopBar crumbs={["Workspace", "Semester"]} />
      <div className="px-8 pb-14">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-ink dark:text-white">Semesters</h1>
            <p className="text-sm text-muted mt-1">
              Everything else — subjects, timetable, lectures — hangs off the active semester.
            </p>
          </div>
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" /> New semester
          </button>
        </div>

        {list.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-muted">No semesters yet. Create your first one to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.map((s) => (
              <div key={s.id} className="card p-5 relative">
                <div className="flex items-start justify-between mb-3">
                  <button
                    onClick={() => setActive(s.id)}
                    className="flex items-center gap-2 text-sm font-semibold"
                    title="Set as active"
                  >
                    {s.isActive ? (
                      <CheckCircle2 className="h-5 w-5 text-brand-500" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted" />
                    )}
                  </button>
                  <button
                    onClick={() => remove(s.id)}
                    className="text-muted hover:text-red-500 transition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <h3 className="text-lg font-bold text-ink dark:text-white">{s.name}</h3>
                <p className="text-xs text-muted mb-3">Semester {s.semesterNumber}</p>
                <p className="text-sm text-muted">
                  {new Date(s.startDate).toLocaleDateString()} –{" "}
                  {new Date(s.endDate).toLocaleDateString()}
                </p>
                {s.isActive && (
                  <span className="absolute top-5 right-5 text-[10px] font-bold uppercase tracking-wide bg-brand-50 text-brand-600 px-2 py-1 rounded-full">
                    Active
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-30 p-4">
          <div className="card w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-ink dark:text-white">New semester</h3>
              <button onClick={() => setShowForm(false)} className="text-muted hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Name</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="label">Semester number</label>
                <input
                  type="number"
                  className="input"
                  value={num}
                  onChange={(e) => setNum(Number(e.target.value))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Start date</label>
                  <input
                    type="date"
                    className="input"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">End date</label>
                  <input
                    type="date"
                    className="input"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                </div>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button className="btn-primary w-full justify-center" onClick={create}>
                Create semester
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
