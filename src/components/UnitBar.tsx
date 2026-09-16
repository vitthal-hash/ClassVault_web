"use client";

import { useState } from "react";
import { FolderPlus, Folder, Check, X, Pencil, Trash2, Loader2 } from "lucide-react";
import { UNSORTED_UNIT } from "@/lib/local/types";

interface Props {
  units: string[];
  /** Currently selected unit, or null for "All". */
  active: string | null;
  onSelect: (unit: string | null) => void;
  counts: Record<string, number>;
  unsortedCount: number;
  onCreate: (name: string) => Promise<void>;
  onRename: (from: string, to: string) => Promise<void>;
  onDelete: (name: string) => Promise<void>;
}

/**
 * Horizontal unit/folder bar shared by the Resources, Lectures and Notes
 * tabs. Units are flat by design - coursework is organised as "Unit 1..N",
 * which nesting would only complicate. Deleting a unit never deletes the
 * items inside it; they fall back to Unsorted.
 */
export function UnitBar({
  units,
  active,
  onSelect,
  counts,
  unsortedCount,
  onCreate,
  onRename,
  onDelete,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const total = Object.values(counts).reduce((a, b) => a + b, 0) + unsortedCount;

  const submitCreate = async () => {
    if (!draft.trim()) {
      setCreating(false);
      return;
    }
    setBusy(true);
    try {
      await onCreate(draft.trim());
      setDraft("");
      setCreating(false);
    } finally {
      setBusy(false);
    }
  };

  const submitRename = async (from: string) => {
    if (!editDraft.trim() || editDraft.trim() === from) {
      setEditing(null);
      return;
    }
    setBusy(true);
    try {
      await onRename(from, editDraft.trim());
      setEditing(null);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async (name: string) => {
    const ok = window.confirm(
      `Delete the unit "${name}"?\n\nAnything inside it will be moved to ${UNSORTED_UNIT} — nothing is deleted.`
    );
    if (!ok) return;
    setBusy(true);
    try {
      await onDelete(name);
      if (active === name) onSelect(null);
    } finally {
      setBusy(false);
    }
  };

  const chip = (label: string, count: number, selected: boolean, onClick: () => void) => (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition whitespace-nowrap ${
        selected
          ? "bg-brand-500 border-brand-500 text-white"
          : "bg-surface border-line text-muted hover:text-ink dark:hover:text-white"
      }`}
    >
      {label}
      <span className={selected ? "text-white/70" : "text-muted"}>{count}</span>
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {chip("All", total, active === null, () => onSelect(null))}

      {units.map((u) =>
        editing === u ? (
          <span key={u} className="inline-flex items-center gap-1">
            <input
              autoFocus
              className="input !py-1.5 !px-2.5 text-xs w-32"
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitRename(u);
                if (e.key === "Escape") setEditing(null);
              }}
            />
            <button onClick={() => submitRename(u)} className="text-emerald-500" disabled={busy}>
              <Check className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setEditing(null)} className="text-muted">
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ) : (
          <span key={u} className="group inline-flex items-center">
            {chip(u, counts[u] ?? 0, active === u, () => onSelect(u))}
            <span className="hidden group-hover:inline-flex items-center gap-1 ml-1">
              <button
                onClick={() => {
                  setEditing(u);
                  setEditDraft(u);
                }}
                className="text-muted hover:text-ink dark:hover:text-white"
                title={`Rename ${u}`}
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                onClick={() => confirmDelete(u)}
                className="text-muted hover:text-red-500"
                title={`Delete ${u}`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          </span>
        )
      )}

      {unsortedCount > 0 &&
        chip(UNSORTED_UNIT, unsortedCount, active === UNSORTED_UNIT, () => onSelect(UNSORTED_UNIT))}

      {creating ? (
        <span className="inline-flex items-center gap-1">
          <input
            autoFocus
            className="input !py-1.5 !px-2.5 text-xs w-32"
            placeholder="Unit 1"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitCreate();
              if (e.key === "Escape") setCreating(false);
            }}
          />
          <button onClick={submitCreate} className="text-emerald-500" disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </button>
          <button onClick={() => setCreating(false)} className="text-muted">
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border border-dashed border-line text-muted hover:text-brand-500 hover:border-brand-500 transition"
        >
          <FolderPlus className="h-3.5 w-3.5" /> New unit
        </button>
      )}
    </div>
  );
}

/** Small select used in upload/create forms to pick a destination unit. */
export function UnitSelect({
  units,
  value,
  onChange,
  className = "",
}: {
  units: string[];
  value: string | null;
  onChange: (unit: string | null) => void;
  className?: string;
}) {
  if (units.length === 0) return null;
  return (
    <div className={`relative ${className}`}>
      <Folder className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
      <select
        className="input !pl-9 appearance-none"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">{UNSORTED_UNIT}</option>
        {units.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </select>
    </div>
  );
}
