"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, X, Trash2, Bell, BellOff } from "lucide-react";
import { useLocalUser } from "@/lib/local/useLocalUser";
import { Notes, Subjects } from "@/lib/local/repo";
import type { Note } from "@/lib/local/types";
import { UNSORTED_UNIT } from "@/lib/local/types";
import { UnitBar, UnitSelect } from "@/components/UnitBar";

export function NotesTab({ subjectId }: { subjectId: number }) {
  const username = useLocalUser();
  const [items, setItems] = useState<Note[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [units, setUnits] = useState<string[]>([]);
  const [activeUnit, setActiveUnit] = useState<string | null>(null);
  const [formUnit, setFormUnit] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!username) return;
    const [all, subject] = await Promise.all([
      Notes.forSubject(username, subjectId),
      Subjects.get(username, subjectId),
    ]);
    setItems(all);
    setUnits(subject?.units ?? []);
  }, [username, subjectId]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!username || !body.trim()) return;
    await Notes.create(username, subjectId, title.trim() || null, body.trim(), formUnit);
    setTitle("");
    setBody("");
    setShowForm(false);
    load();
  };

  const remove = async (id: number) => {
    if (!username) return;
    await Notes.remove(username, id);
    load();
  };

  const toggleRemind = async (n: Note) => {
    if (!username) return;
    await Notes.update(username, { ...n, remindMe: !n.remindMe });
    load();
  };

  const counts: Record<string, number> = {};
  for (const u of units) counts[u] = items.filter((i) => i.unit === u).length;
  const unsortedCount = items.filter((i) => !i.unit || !units.includes(i.unit)).length;
  const visible =
    activeUnit === null
      ? items
      : activeUnit === UNSORTED_UNIT
      ? items.filter((i) => !i.unit || !units.includes(i.unit))
      : items.filter((i) => i.unit === activeUnit);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted">Quick, free-form notes for this subject — saved on this device.</p>
        <button
          className="btn-primary text-sm"
          onClick={() => {
            setFormUnit(activeUnit === UNSORTED_UNIT ? null : activeUnit);
            setShowForm(true);
          }}
        >
          <Plus className="h-4 w-4" /> New note
        </button>
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
          {items.length === 0 ? "No notes yet." : `No notes in ${activeUnit} yet.`}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {visible.map((n) => (
            <div key={n.id} className="card p-4">
              <div className="flex items-start justify-between mb-1.5">
                <p className="font-semibold text-ink dark:text-white text-sm">
                  {n.title || n.body.slice(0, 40)}
                </p>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => toggleRemind(n)} className={n.remindMe ? "text-brand-500" : "text-muted"}>
                    {n.remindMe ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => remove(n.id)} className="text-muted hover:text-red-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-muted whitespace-pre-wrap line-clamp-4">{n.body}</p>
              <p className="text-[11px] text-muted mt-2">
                {n.unit ? `${n.unit} · ` : ""}Updated {new Date(n.updatedAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-30 p-4">
          <div className="card w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-ink dark:text-white">New note</h3>
              <button onClick={() => setShowForm(false)} className="text-muted hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <input
                className="input"
                placeholder="Title (optional)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <UnitSelect units={units} value={formUnit} onChange={setFormUnit} />
              <textarea
                className="input min-h-[120px]"
                placeholder="What was taught in this lecture..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                autoFocus
              />
              <button className="btn-primary w-full justify-center" onClick={create}>
                Save note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
