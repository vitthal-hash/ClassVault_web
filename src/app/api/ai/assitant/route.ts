import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api/authUser";
import { connectToDatabase } from "@/lib/db/mongodb";
import { ChatMessage, Semester, Subject, nextSeq, bumpSeq } from "@/lib/db/models";
import { resolveGeminiKey, generateRaw } from "@/lib/gemini";
import type { AssistantAction, AssistantActionType } from "@/lib/assistant/types";
import { NONE_ACTION } from "@/lib/assistant/types";

// Sentinel subjectId reserved for the global assistant's own thread -
// mirrors GLOBAL_ASSISTANT_SUBJECT_ID in src/lib/local/types.ts. Real
// subjects are always >= 1, so this can never collide with one.
const GLOBAL_ASSISTANT_SUBJECT_ID = -1;
const HISTORY_TURNS = 12;

const ACTION_TYPES: AssistantActionType[] = [
  "none",
  "setTheme",
  "navigateTab",
  "openSubject",
  "createNote",
  "toggleNoteReminder",
  "createAssignment",
  "openAssignmentUpload",
];

// POST /api/ai/assistant - the floating/global "ClassVault" bot, available
// from the AI Chat page. Unlike /api/ai/chat (grounded in one subject's own
// uploaded material, no side effects), this endpoint can also ask the
// client to change app state (theme, navigation, notes, assignments) via a
// structured JSON reply from Gemini. Body: { message: string }.
export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) return NextResponse.json({ error: "message is required." }, { status: 400 });

  await connectToDatabase();

  // Save the student's turn first, so it's part of the history a moment
  // from now, and so it's not lost if the Gemini call below fails.
  const userMsgId = await nextSeq(user, "chat-messages");
  await ChatMessage.create({
    userId: user,
    id: userMsgId,
    subjectId: GLOBAL_ASSISTANT_SUBJECT_ID,
    role: "user",
    content: message,
    createdAt: new Date().toISOString(),
  });

  const allMessages = await ChatMessage.find({ userId: user, subjectId: GLOBAL_ASSISTANT_SUBJECT_ID })
    .sort({ id: 1 })
    .lean();
  const recentHistory = allMessages.slice(-HISTORY_TURNS) as any[];

  const subjectNames = await currentSubjectNames(user);
  const prompt = buildPrompt(recentHistory, subjectNames);

  let replyText: string;
  let action: AssistantAction = NONE_ACTION;
  try {
    const apiKey = await resolveGeminiKey(user);
    const raw = await generateRaw(prompt, apiKey);
    const parsed = parseReply(raw);
    replyText = parsed.text;
    action = parsed.action;
  } catch (err: any) {
    replyText = err?.message || "Something went wrong reaching Gemini.";
  }

  const assistantMsgId = await nextSeq(user, "chat-messages");
  await bumpSeq(user, "chat-messages", assistantMsgId);
  await ChatMessage.create({
    userId: user,
    id: assistantMsgId,
    subjectId: GLOBAL_ASSISTANT_SUBJECT_ID,
    role: "assistant",
    content: replyText,
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ text: replyText, action });
}

/** Subjects in the currently active semester - used only to tell Gemini
 *  what "open <subject>" could validly refer to. It never sees anything
 *  beyond names, no uploaded material. */
async function currentSubjectNames(user: string): Promise<string[]> {
  const semester = await Semester.findOne({ userId: user, isActive: true }).lean();
  if (!semester) return [];
  const subjects = await Subject.find({ userId: user, semesterId: (semester as any).id }).lean();
  return subjects.map((s: any) => s.name as string);
}

function buildPrompt(history: any[], subjectNames: string[]): string {
  const parts = [SYSTEM_PROMPT, "", actionInstructions(subjectNames)];
  if (history.length > 0) {
    parts.push("\n--- Conversation so far ---");
    for (const m of history) {
      parts.push(`${m.role === "user" ? "Student" : "You"}: ${m.content}`);
    }
    parts.push("--- end of conversation ---");
  }
  return parts.join("\n");
}

const SYSTEM_PROMPT =
  'You are "ClassVault," the built-in study assistant of the ClassVault app. ' +
  "Always speak as ClassVault in the first person - never call yourself Gemini, " +
  "an AI language model, or anything else, and never break character.\n\n" +
  "Scope: you only help with study and academic topics - explaining concepts, " +
  "working through problems, exam/assignment prep, study strategies, and " +
  "questions about how to use ClassVault itself. If someone asks something " +
  "outside that (general chit-chat, news, personal advice unrelated to " +
  "studying, etc.), briefly and politely decline and steer them back to " +
  "study help - do not answer the off-topic question first.\n\n" +
  "Your replies are shown as plain text in a chat bubble, not rendered as " +
  "markdown, so write in plain flowing sentences: no asterisks, no markdown " +
  "headers, no numbered or bulleted lists using symbols. If you need to list " +
  "a few things, say them in a sentence instead. Keep answers reasonably " +
  "concise unless the student asks for a full walkthrough.";

/** Describes the small, fixed set of app-control actions available and the
 *  exact JSON shape to answer in. Kept deliberately narrow - no destructive
 *  actions, no free-form commands - so a bad or hallucinated response can
 *  only ever land on something harmless like `type: "none"`. */
function actionInstructions(subjectNames: string[]): string {
  const subjectsLine = subjectNames.length > 0 ? subjectNames.join(", ") : "none set up yet";
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;

  return (
    "You can also control the ClassVault app itself, on top of replying. " +
    "Respond with ONLY a JSON object - no markdown code fences, no text " +
    "before or after it - in exactly this shape:\n" +
    '{"reply": "<what you say>", "action": {"type": "<none|setTheme|' +
    "navigateTab|openSubject|createNote|toggleNoteReminder|" +
    'createAssignment|openAssignmentUpload>", "value": ' +
    '"<target, or null>", "subject": "<subject name, or null>", ' +
    '"title": "<note/assignment title, or null>", "body": ' +
    '"<note content, or null>", "deadline": "<yyyy-mm-dd, or ' +
    'null>"}}\n' +
    'Only fill the fields a given action actually needs - leave the ' +
    "rest null.\n\n" +
    `Subjects that exist right now: ${subjectsLine}. Today's date is ` +
    `${todayStr}, use it to resolve relative dates like "next Friday".\n\n` +
    'Rules for "action":\n' +
    '- "setTheme": use when asked to change the theme/appearance. ' +
    'value is "light", "dark", or "system".\n' +
    '- "navigateTab": use when asked to go to / open / show one of ' +
    "the app's main sections. value is one of: Home, Semester, " +
    "Subjects, AI Chat, Search, Revision, Settings.\n" +
    '- "openSubject": use when asked to open a specific subject\'s ' +
    "workspace. value is the subject's name. If it isn't in the " +
    "list above, still set the action (the app will tell the " +
    'student it wasn\'t found) rather than refusing.\n' +
    '- "createNote": use when asked to add/create a note in a ' +
    "subject. Set subject and title. If the student gave actual " +
    "note content, put it in body - otherwise leave body null (the " +
    "app will just use the title as the note's content). The note " +
    'is created immediately, so write "reply" as if it\'s already ' +
    "done, explicitly naming the subject and the exact title back " +
    'to the student (e.g. "Added a note in DBMS titled Recursion ' +
    'Basics") - that exact subject+title is how a later turn finds ' +
    "the note again, there is no hidden id. Then ask if they want " +
    "to be reminded about it before that subject's next lecture.\n" +
    '- "toggleNoteReminder": use ONLY when the student is answering ' +
    "yes to a reminder question you just asked in your immediately " +
    "preceding reply. Copy the subject and exact title from that " +
    "prior reply into this action - never invent your own. If they " +
    'say no, use action "none" instead and just acknowledge.\n' +
    "- Adding an assignment is a two-step conversation, mirroring " +
    'notes: on the FIRST ask (e.g. "add an assignment for DBMS due ' +
    'next Friday"), do NOT create anything yet - use action "none", ' +
    'and in "reply" state the subject, title, and the deadline you ' +
    "resolved to an actual date back to the student in plain words, " +
    "then ask whether they want to attach a file for it right now. " +
    "On the student's answer, look back at the subject/title/" +
    "deadline you stated in that prior reply (same continuity rule " +
    "as notes) and:\n" +
    '  - if they say no (or want to add the file later): use ' +
    '"createAssignment" with subject, title, and deadline ' +
    "(yyyy-mm-dd). This actually saves the assignment with no file " +
    'attached - say so plainly, e.g. "Saved it - you can attach ' +
    'the file anytime from the Assignments tab."\n' +
    "  - if they say yes: use \"openAssignmentUpload\" with the same " +
    "subject, title, and deadline. This opens the subject's " +
    "Assignments tab with the add-assignment form already filled in " +
    'and ready - say something like "Opening it up so you can pick ' +
    'the file."\n' +
    '- "none": use for anything else, including plain questions, or ' +
    "when an action needs a subject/title the student hasn't given " +
    'yet (ask for it in "reply" instead of guessing) - value is ' +
    "null.\n\n" +
    'Always fill "reply" with a normal, spoken-style answer ' +
    'regardless of the action. Never mention the JSON format, field ' +
    'names, or "action" itself to the student.'
  );
}

/** Parses Gemini's JSON reply into text + action. Falls back to treating
 *  the whole response as plain text (action: none) if it isn't valid JSON
 *  or isn't the expected shape - a malformed response should still reach
 *  the student, not get swallowed. */
function parseReply(raw: string): { text: string; action: AssistantAction } {
  try {
    let cleaned = raw.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned
        .replace(/^```(json)?/i, "")
        .replace(/```$/, "")
        .trim();
    }

    const decoded = JSON.parse(cleaned);
    const text = typeof decoded.reply === "string" ? decoded.reply.trim() : "";
    if (!text) return { text: raw.trim(), action: NONE_ACTION };

    const actionMap = decoded.action ?? {};
    const typeName = typeof actionMap.type === "string" ? actionMap.type : "none";
    const type =
      ACTION_TYPES.find((t) => t.toLowerCase() === typeName.toLowerCase()) ?? "none";

    return {
      text,
      action: {
        type,
        value: typeof actionMap.value === "string" ? actionMap.value : null,
        subject: typeof actionMap.subject === "string" ? actionMap.subject : null,
        title: typeof actionMap.title === "string" ? actionMap.title : null,
        body: typeof actionMap.body === "string" ? actionMap.body : null,
        deadline: typeof actionMap.deadline === "string" ? actionMap.deadline : null,
      },
    };
  } catch {
    return { text: raw.trim(), action: NONE_ACTION };
  }
}