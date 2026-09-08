// The fixed, deliberately small allow-list of things the global assistant
// (the "AI Chat" page, subjectId === GLOBAL_ASSISTANT_SUBJECT_ID) can
// actually *do* in the app, on top of just replying - e.g. "switch to dark
// mode" or "open DBMS". Gemini names one of these in its structured JSON
// reply (built server-side in /api/ai/assistant); runAssistantAction (the
// client-side dispatcher) is the only place that turns it into a real app
// change. Nothing outside this list - no free-form code, no destructive
// actions like deleting a subject - is ever exposed to it.
export type AssistantActionType =
  | "none"
  | "setTheme"
  | "navigateTab"
  | "openSubject"
  | "createNote"
  | "toggleNoteReminder"
  | "createAssignment"
  | "openAssignmentUpload";

/**
 * One instruction the global assistant chose to act on, parsed out of
 * Gemini's structured JSON reply.
 *
 * `value` is the type-specific target and means different things per
 * `type`:
 * - setTheme: "light" | "dark" | "system"
 * - navigateTab: a section label, e.g. "Settings"
 * - openSubject: a subject name or code
 * - everything else: unused, always null
 *
 * The note/assignment action types don't fit a single `value`, so they use
 * the extra named fields instead:
 * - createNote: subject + title, optional body
 * - toggleNoteReminder: subject + title - must match a note's subject+title
 *   exactly (case-insensitively) so the dispatcher can find which note
 *   "yes" refers to; there's no hidden id passed between turns, only what
 *   the assistant's own prior reply said out loud.
 * - createAssignment / openAssignmentUpload: subject + title + deadline (an
 *   ISO "yyyy-MM-dd" date string)
 */
export interface AssistantAction {
  type: AssistantActionType;
  value: string | null;
  subject: string | null;
  title: string | null;
  body: string | null;
  deadline: string | null;
}

export const NONE_ACTION: AssistantAction = {
  type: "none",
  value: null,
  subject: null,
  title: null,
  body: null,
  deadline: null,
};