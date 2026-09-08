"use client";

import { useEffect, useState, useCallback } from "react";
import { Trash2, Clock } from "lucide-react";
import { useLocalUser } from "@/lib/local/useLocalUser";
import { TimetableEntries, Teachers } from "@/lib/local/repo";
import type { SessionType, TimetableEntry } from "@/lib/local/types";
import { timeRangeLabel, weekdayLabel, WEEKDAYS } from "@/lib/local/types";

export function ScheduleTab({ subjectId, sessionType }: { subjectId: number; sessionType: SessionType }) {
  const username = useLocalUser();
  const [entries, setEntries] = useState<(TimetableEntry & { teacherName?: string })[]>([]);

  const load = useCallback(async () => {
    if (!username) return;
    const all = await TimetableEntries.forSubject(username, subjectId);
    const teachers = await Teachers.all(username);
    const tMap = new Map(teachers.map((t) => [t.id, t.name]));
    const filtered = all
      .filter((e) => e.sessionType === sessionType)
      .sort((a, b) => WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day) || a.startMinutes - b.startMinutes)
      .map((e) => ({ ...e, teacherName: e.teacherId ? tMap.get(e.teacherId) : undefined }));
    setEntries(filtered);
  }, [username, subjectId, sessionType]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (id: number) => {
    if (!username) return;
    await TimetableEntries.remove(username, id);
    load();
  };

  if (entries.length === 0) {
    return (
      <div className="card p-10 text-center">
        <Clock className="h-7 w-7 text-muted mx-auto mb-2" />
        <p className="text-sm text-muted">
          No {sessionType} slots yet. Upload or edit your timetable to add some.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((e) => (
        <div key={e.id} className="card p-4 flex items-center gap-4">
          <div className="w-24 shrink-0">
            <p className="text-sm font-semibold text-ink dark:text-white">{weekdayLabel(e.day)}</p>
            <p className="text-xs text-muted">{timeRangeLabel(e.startMinutes, e.endMinutes)}</p>
          </div>
          <div className="flex-1 min-w-0">
            {e.teacherName && <p className="text-sm text-ink dark:text-white">{e.teacherName}</p>}
            {e.room && <p className="text-xs text-muted">Room {e.room}</p>}
          </div>
          <button onClick={() => remove(e.id)} className="text-muted hover:text-red-500">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
