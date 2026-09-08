import type { SessionType, Weekday } from "./local/types";

export interface ParsedRow {
  id: string; // client-side temp id for the review table
  day: Weekday | null;
  startMinutes: number | null;
  endMinutes: number | null;
  subjectName: string;
  sessionType: SessionType;
  teacherName: string | null;
  room: string | null;
  sourceLine: string | null;
}

const DAY_RE = /\b(mon|monday|tue|tues|tuesday|wed|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday|sun|sunday)\b/i;
const TIME_RANGE_RE =
  /(\d{1,2})[:.]?(\d{2})?\s*(am|pm)?\s*(?:-|to|–)\s*(\d{1,2})[:.]?(\d{2})?\s*(am|pm)?/i;
const SESSION_RE = /\b(theory|lab|laboratory|practical|tutorial|tut)\b/i;
const TEACHER_RE = /\b(prof\.?|dr\.?|mr\.?|mrs\.?|ms\.?)\s+([A-Z][a-zA-Z.\s]{1,30}?)(?=\s{2,}|$|[,;()])/i;

function dayFromText(raw: string): Weekday | null {
  const t = raw.trim().toLowerCase();
  const days: Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  for (const d of days) {
    if (d === t || (d.startsWith(t) && t.length >= 3)) return d;
  }
  return null;
}

function sessionFromText(raw: string): SessionType {
  const t = raw.trim().toLowerCase();
  if (t.startsWith("lab") || t.startsWith("pract")) return "lab";
  if (t.startsWith("tut")) return "tutorial";
  return "theory";
}

function toMinutes(hourStr?: string, minStr?: string, ampm?: string): number | null {
  if (!hourStr) return null;
  let hour = parseInt(hourStr, 10) || 0;
  const minute = parseInt(minStr || "0", 10) || 0;
  if (ampm) {
    const isPm = ampm.toLowerCase() === "pm";
    if (isPm && hour < 12) hour += 12;
    if (!isPm && hour === 12) hour = 0;
  } else if (hour < 8) {
    hour += 12;
  }
  return hour * 60 + minute;
}

export function parseTimetableText(rawText: string): ParsedRow[] {
  const lines = rawText
    .split(/[\r\n]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const rows: ParsedRow[] = [];
  let counter = 0;

  for (const line of lines) {
    const looksRelevant = DAY_RE.test(line) || /\d/.test(line);
    if (!looksRelevant) continue;

    let working = line;

    const dayMatch = working.match(DAY_RE);
    const day = dayMatch ? dayFromText(dayMatch[0]) : null;

    const timeMatch = working.match(TIME_RANGE_RE);
    let start: number | null = null;
    let end: number | null = null;
    if (timeMatch) {
      start = toMinutes(timeMatch[1], timeMatch[2], timeMatch[3]);
      end = toMinutes(timeMatch[4], timeMatch[5], timeMatch[6]);
      working = working.replace(timeMatch[0], " ");
    }

    let sessionType: SessionType = "theory";
    const sessionMatch = working.match(SESSION_RE);
    if (sessionMatch) {
      sessionType = sessionFromText(sessionMatch[0]);
      working = working.replace(sessionMatch[0], " ");
    }

    let teacher: string | null = null;
    const teacherMatch = working.match(TEACHER_RE);
    if (teacherMatch) {
      teacher = teacherMatch[0].trim();
      working = working.replace(teacherMatch[0], " ");
    }

    working = working.replace(new RegExp(DAY_RE.source, "gi"), " ");

    const subjectName = working
      .replace(/[|:•\-–—]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();

    if (!subjectName && !day && !timeMatch) continue;

    rows.push({
      id: `row_${counter++}`,
      day,
      startMinutes: start,
      endMinutes: end,
      subjectName: subjectName || "Untitled Subject",
      sessionType,
      teacherName: teacher,
      room: null,
      sourceLine: line,
    });
  }

  return rows;
}