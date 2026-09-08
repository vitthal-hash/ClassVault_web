import { Semesters, Subjects, Notes, Assignments } from "@/lib/local/repo";
import type { ThemePreference } from "@/lib/local/types";
import type { AssistantAction } from "./types";

/** Minimal shape of what we need from next/navigation's router - kept
 *  narrow so this module doesn't have to import next/navigation itself. */
export interface AssistantRouter {
  push: (href: string) => void;
}

export interface AssistantDispatchContext {
  username: string;
  router: AssistantRouter;
  setTheme: (t: ThemePreference) => void | Promise<void>;
}

const TAB_PATHS: Record<string, string> = {
  home: "/home",
  semester: "/semester",
  subjects: "/subjects",
  "ai chat": "/ai-chat",
  search: "/search",
  revision: "/revision",
  settings: "/settings",
};

/**
 * Carries out an AssistantAction the global assistant decided on - e.g.
 * actually switching the theme or navigating to a tab/subject.
 *
 * This is deliberately the ONLY place that turns an assistant reply into a
 * real change: the /api/ai/assistant route just parses what Gemini asked
 * for, it never touches settings, navigation, notes, or assignments
 * itself. The action types it can receive are the fixed allow-list in
 * AssistantActionType - nothing destructive (deleting a subject, clearing
 * data, etc.) is ever exposed to the assistant.
 */
export async function runAssistantAction(
  action: AssistantAction,
  ctx: AssistantDispatchContext
): Promise<void> {
  switch (action.type) {
    case "none":
      return;
    case "setTheme":
      return applyTheme(action.value, ctx);
    case "navigateTab":
      return navigateTab(action.value, ctx);
    case "openSubject":
      return openSubject(action.value, ctx);
    case "createNote":
      return createNote(action, ctx);
    case "toggleNoteReminder":
      return toggleNoteReminder(action, ctx);
    case "createAssignment":
      return createAssignment(action, ctx);
    case "openAssignmentUpload":
      return openAssignmentUpload(action, ctx);
  }
}

async function applyTheme(value: string | null, ctx: AssistantDispatchContext) {
  const preference = ((): ThemePreference | null => {
    switch (value?.trim().toLowerCase()) {
      case "light":
        return "light";
      case "dark":
        return "dark";
      case "system":
        return "system";
      default:
        return null;
    }
  })();
  if (!preference) return;
  await ctx.setTheme(preference);
  // No follow-up message - the assistant's own spoken reply already
  // confirms this ("Switched to dark mode").
}

function navigateTab(value: string | null, ctx: AssistantDispatchContext) {
  const label = value?.trim().toLowerCase();
  if (!label) return;
  const path = TAB_PATHS[label];
  if (path) ctx.router.push(path);
}

/** Exact name/code match first, then falls back to a substring match so
 *  "open dbms lab notes" still finds a subject named "DBMS". */
async function resolveSubject(name: string | null | undefined, username: string) {
  const needle = name?.trim().toLowerCase();
  if (!needle) return null;
  const semester = await Semesters.activeOne(username);
  if (!semester) return null;
  const subjects = await Subjects.forSemester(username, semester.id);
  const exact = subjects.find(
    (s) => s.name.toLowerCase() === needle || s.code?.toLowerCase() === needle
  );
  if (exact) return exact;
  return subjects.find((s) => s.name.toLowerCase().includes(needle)) ?? null;
}

async function openSubject(value: string | null, ctx: AssistantDispatchContext) {
  const subject = await resolveSubject(value, ctx.username);
  if (subject) ctx.router.push(`/subjects/${subject.id}`);
}

// ---------------------------------------------------------------
// Notes
// ---------------------------------------------------------------

/** Creates the note right away - low-risk and trivially undoable, so
 *  unlike assignments there's no confirm-first step. The assistant's own
 *  reply is what tells the student it happened. */
async function createNote(action: AssistantAction, ctx: AssistantDispatchContext) {
  const title = action.title?.trim();
  if (!title) return;
  const subject = await resolveSubject(action.subject, ctx.username);
  if (!subject) return;
  const body = action.body?.trim();
  await Notes.create(ctx.username, subject.id, title, body && body.length > 0 ? body : title);
}

/** Handles the "yes" to the reminder question a createNote reply just
 *  asked. Matches purely on subject+title text the assistant itself
 *  restated - see AssistantAction's doc comment for why. */
async function toggleNoteReminder(action: AssistantAction, ctx: AssistantDispatchContext) {
  const title = action.title?.trim();
  if (!title) return;
  const subject = await resolveSubject(action.subject, ctx.username);
  if (!subject) return;
  const notes = await Notes.forSubject(ctx.username, subject.id);
  const note = notes.find((n) => (n.title ?? "").trim().toLowerCase() === title.toLowerCase());
  if (!note) return;
  await Notes.update(ctx.username, { ...note, remindMe: true });
}

// ---------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------

/** Parses the "yyyy-mm-dd" the assistant is instructed to send. Returns
 *  null (rather than guessing) if it isn't parseable at all. */
function parseDeadline(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** The "no file for now" branch of the assignment flow: saves the
 *  assignment as a deadline-only entry, which the student can attach a
 *  file to later from the Assignments tab. */
async function createAssignment(action: AssistantAction, ctx: AssistantDispatchContext) {
  const title = action.title?.trim();
  const deadline = parseDeadline(action.deadline);
  if (!title || !deadline) return;
  const subject = await resolveSubject(action.subject, ctx.username);
  if (!subject) return;
  await Assignments.create(ctx.username, subject.id, title, deadline, null);
}

/** The "yes, attach a file" branch: opens the subject's Assignments tab
 *  with the add-assignment form already open and pre-filled with the
 *  title and deadline already captured in chat - the file picker itself
 *  has to happen through a real click (browsers won't let a script open
 *  it), so the student just needs to tap "Attach" from there. */
async function openAssignmentUpload(action: AssistantAction, ctx: AssistantDispatchContext) {
  const title = action.title?.trim();
  const deadline = parseDeadline(action.deadline);
  if (!title || !deadline) return;
  const subject = await resolveSubject(action.subject, ctx.username);
  if (!subject) return;

  const params = new URLSearchParams({
    tab: "assignments",
    newAssignment: "1",
    title,
    deadline: deadline.slice(0, 10),
  });
  ctx.router.push(`/subjects/${subject.id}?${params.toString()}`);
}