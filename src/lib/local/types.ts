// Types mirroring the original Flutter/Isar models 1:1, adapted for the web.
// Everything here is stored client-side (IndexedDB), scoped per logged-in user.

export type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export const WEEKDAYS: Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export const weekdayLabel = (d: Weekday) =>
  d.charAt(0).toUpperCase() + d.slice(1);

export const weekdayFromDate = (dt: Date): Weekday => {
  const idx = (dt.getDay() + 6) % 7; // JS: 0=Sun..6=Sat -> Mon-first
  return WEEKDAYS[idx];
};

export type SessionType = "theory" | "lab" | "tutorial";

export const sessionLabel = (s: SessionType) =>
  s === "theory" ? "Theory" : s === "lab" ? "Lab" : "Tutorial";

export const sessionCodeInitial = (s: SessionType) =>
  s === "theory" ? "T" : s === "lab" ? "L" : "TU";

export type SubjectSection =
  | "theory"
  | "lab"
  | "tutorial"
  | "resources"
  | "lectures"
  | "assignments"
  | "syllabus"
  | "notes"
  | "aiChat";

export type AiAction =
  | "explain"
  | "summarize"
  | "keyPoints"
  | "importantQuestions"
  | "generateNotes";

export const AI_ACTIONS: { id: AiAction; label: string; instruction: string }[] = [
  {
    id: "explain",
    label: "Explain",
    instruction:
      "Explain the following lecture content in simple, clear terms for a student studying it, as if teaching it from scratch. Use plain language and short paragraphs.",
  },
  {
    id: "summarize",
    label: "Summarize",
    instruction:
      "Summarize the following lecture content into a concise summary a student could review in under a minute. Keep the core ideas, drop filler.",
  },
  {
    id: "keyPoints",
    label: "Key Points",
    instruction:
      "Extract the key points from the following lecture content as a short bulleted list. Each bullet should be one self-contained idea.",
  },
  {
    id: "importantQuestions",
    label: "Important Questions",
    instruction:
      "Based on the following lecture content, write a list of likely exam-style important questions a student should be able to answer, covering the main concepts.",
  },
  {
    id: "generateNotes",
    label: "Generate Notes",
    instruction:
      "Turn the following lecture content into clean, well-organized study notes with headings and bullet points, suitable for revision later.",
  },
];

export type ThemePreference = "system" | "light" | "dark";
export type ChatRole = "user" | "assistant";
export type AssignmentStatus = "pending" | "submitted";
export type ResourceType = "pdf" | "ppt" | "word" | "image";

export const resourceTypeFromExtension = (name: string): ResourceType | null => {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf") return "pdf";
  if (ext === "ppt" || ext === "pptx") return "ppt";
  if (ext === "doc" || ext === "docx") return "word";
  if (["jpg", "jpeg", "png", "webp"].includes(ext)) return "image";
  return null;
};

export interface Semester {
  id: number;
  name: string;
  semesterNumber: number;
  startDate: string; // ISO
  endDate: string; // ISO
  isActive: boolean;
  createdAt: string;
}

export interface Subject {
  id: number;
  semesterId: number;
  name: string;
  code?: string | null;
  isPinned: boolean;
  /** Student-defined units/folders for this subject, in display order.
   *  Stored on the subject (rather than derived from the items that use
   *  them) so an empty unit can be created up front and filled later. */
  units?: string[];
  createdAt: string;
}

export interface Teacher {
  id: number;
  name: string;
  createdAt: string;
}

export interface TimetableEntry {
  id: number;
  semesterId: number;
  subjectId: number;
  teacherId?: number | null;
  day: Weekday;
  startMinutes: number;
  endMinutes: number;
  sessionType: SessionType;
  room?: string | null;
  createdAt: string;
}

export interface Syllabus {
  id: number;
  subjectId: number; // unique
  fileName: string;
  fileRef: string; // key into file blob store
  extractedText?: string | null;
  uploadedAt: string;
}

export interface Resource {
  id: number;
  subjectId: number;
  name: string;
  fileRef: string;
  type: ResourceType;
  /** Name of the unit/folder this belongs to, or null/absent for
   *  "Unsorted". Matched by name against Subject.units. */
  unit?: string | null;
  extractedText?: string | null;
  uploadedAt: string;
}

export interface Lecture {
  id: number;
  subjectId: number;
  sessionType: SessionType;
  lectureCode: string;
  imageRef: string;
  unit?: string | null;
  capturedAt: string;
  createdAt: string;
  isStarred: boolean;
  ocrText?: string | null;
}

export interface Assignment {
  id: number;
  subjectId: number;
  title: string;
  fileName?: string | null;
  fileRef?: string | null;
  deadline: string;
  status: AssignmentStatus;
  createdAt: string;
}

export interface Note {
  id: number;
  subjectId: number;
  title?: string | null;
  unit?: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
  remindMe: boolean;
}

export interface ChatMessage {
  id: number;
  subjectId: number; // -1 sentinel for the global assistant
  role: ChatRole;
  content: string;
  createdAt: string;
}

export interface AppSettings {
  id: 0;
  themePreference: ThemePreference;
  geminiApiKey?: string | null;
}

export const GLOBAL_ASSISTANT_SUBJECT_ID = -1;

export function timeRangeLabel(startMinutes: number, endMinutes: number) {
  const fmt = (m: number) => {
    const h = Math.floor(m / 60)
      .toString()
      .padStart(2, "0");
    const mm = (m % 60).toString().padStart(2, "0");
    return `${h}:${mm}`;
  };
  return `${fmt(startMinutes)} - ${fmt(endMinutes)}`;
}

export function isAssignmentOverdue(a: Assignment) {
  return a.status === "pending" && new Date(a.deadline).getTime() < Date.now();
}

/** Label used in the UI for items that haven't been put in a unit yet. */
export const UNSORTED_UNIT = "Unsorted";
