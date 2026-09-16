import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api/authUser";
import {
  Assignment,
  ChatMessage,
  Lecture,
  Note,
  Resource,
  Subject,
  Syllabus,
  bumpSeq,
  nextSeq,
} from "@/lib/db/models";
import { resolveGeminiKey, generateWithHistory } from "@/lib/gemini";

type Attachment = { name: string; text: string };

const CONTEXT_LIMIT = 60_000;
const ATTACHMENT_LIMIT = 30_000;

const clean = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const clipped = (value: unknown, limit: number) => clean(value).slice(0, limit);

/** Renders an item's unit as a heading suffix so the model can answer
 *  unit-scoped questions ("quiz me on Unit 3") by matching on these tags. */
const unitTag = (unit: unknown) => {
  const u = clean(unit);
  return u ? ` [${u}]` : "";
};

function buildContext(subjectName: string, data: {
  syllabus: any | null;
  notes: any[];
  resources: any[];
  lectures: any[];
  assignments: any[];
  units: string[];
}) {
  const sections: string[] = [];
  const add = (heading: string, value: unknown, limit = CONTEXT_LIMIT) => {
    const text = clean(value);
    if (text) sections.push(`=== ${heading} ===\n${text.slice(0, limit)}`);
  };

  // Reserve room for each material type. A huge syllabus or one long note
  // must not crowd out every resource and lecture, which was the browser
  // implementation's most frustrating failure mode.
  add("Syllabus", data.syllabus?.extractedText, 9_000);
  let noteBudget = 10_000;
  for (const note of data.notes) {
    const text = clipped(note.body, noteBudget);
    add(`Note${note.title ? `: ${note.title}` : ""}${unitTag(note.unit)}`, text);
    noteBudget -= text.length;
    if (noteBudget <= 0) break;
  }
  let resourceBudget = 18_000;
  for (const resource of data.resources) {
    const text = clipped(resource.extractedText, resourceBudget);
    add(`${resource.type || "Resource"}: ${resource.name || "Untitled"}${unitTag(resource.unit)}`, text);
    resourceBudget -= text.length;
    if (resourceBudget <= 0) break;
  }
  let lectureBudget = 17_000;
  for (const lecture of data.lectures) {
    const text = clipped(lecture.ocrText, lectureBudget);
    add(`Lecture ${lecture.lectureCode || ""} (${lecture.sessionType || "class"})${unitTag(lecture.unit)}`, text);
    lectureBudget -= text.length;
    if (lectureBudget <= 0) break;
  }
  if (data.assignments.length) {
    const rows = data.assignments.map((a) => {
      const due = a.deadline ? new Date(a.deadline).toLocaleDateString("en-CA") : "no deadline";
      return `- ${a.title} — due ${due}; ${a.status}${a.fileName ? `; file: ${a.fileName}` : ""}`;
    });
    add("Assignments", rows.join("\n"), 3_000);
  }

  const material = sections.join("\n\n").slice(0, CONTEXT_LIMIT);
  const unitsLine = data.units.length
    ? `This subject is organised into these units: ${data.units.join(", ")}. Each item below is tagged with its unit in square brackets; items with no tag are unsorted. When the student asks about a specific unit, use only the material tagged with that unit.`
    : "";
  return [
    `You are ClassVault's subject assistant for "${subjectName}".`,
    unitsLine,
    "Stay strictly within this subject. Treat the student's saved material and any file attached to the current question as the primary source of truth.",
    "If the saved material does not answer a question, say that clearly and then offer helpful subject-specific guidance. Never claim to have read a file whose extracted text is absent.",
    material ? `SAVED SUBJECT MATERIAL:\n${material}` : "There is no extracted saved material yet. You may still help with the current question or its attachment.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Subject-only chat. The server builds the grounding from the account's
 * records so it cannot be lost when a browser refreshes or client-side OCR
 * fails. Global AI deliberately uses its separate action-capable endpoint. */
export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }

  const subjectId = Number(body?.subjectId);
  const message = clipped(body?.message, 8_000);
  if (!Number.isInteger(subjectId) || subjectId < 0 || !message) {
    return NextResponse.json({ error: "A subject and message are required." }, { status: 400 });
  }

  const subject = await Subject.findOne({ userId: user, id: subjectId }).lean();
  if (!subject) return NextResponse.json({ error: "Subject not found." }, { status: 404 });

  const attachments: Attachment[] = Array.isArray(body?.attachments)
    ? body.attachments.slice(0, 3).map((item: any) => ({ name: clipped(item?.name, 160) || "Attachment", text: clipped(item?.text, ATTACHMENT_LIMIT) })).filter((item: Attachment) => item.text)
    : [];
  const attachmentText = attachments.map((a) => `=== Attached file: ${a.name} ===\n${a.text}`).join("\n\n").slice(0, ATTACHMENT_LIMIT);
  const visibleMessage = `${message}${attachments.length ? `\n\n[Attached: ${attachments.map((a) => a.name).join(", ")}]` : ""}`;

  const userMessageId = await nextSeq(user, "chat-messages");
  await ChatMessage.create({ userId: user, id: userMessageId, subjectId, role: "user", content: visibleMessage, createdAt: new Date().toISOString() });

  const [syllabus, notes, resources, lectures, assignments, savedMessages] = await Promise.all([
    Syllabus.findOne({ userId: user, subjectId }).lean(),
    Note.find({ userId: user, subjectId }).sort({ updatedAt: -1 }).lean(),
    Resource.find({ userId: user, subjectId }).sort({ uploadedAt: -1 }).lean(),
    Lecture.find({ userId: user, subjectId }).sort({ capturedAt: -1 }).lean(),
    Assignment.find({ userId: user, subjectId }).sort({ deadline: 1 }).lean(),
    ChatMessage.find({ userId: user, subjectId }).sort({ createdAt: -1 }).limit(14).lean(),
  ]);

  const context = buildContext(subject.name, {
    syllabus,
    notes,
    resources,
    lectures,
    assignments,
    units: Array.isArray((subject as any).units) ? (subject as any).units : [],
  });
  const history = [
    { role: "user" as const, text: context },
    { role: "model" as const, text: "Understood. I will keep this conversation scoped to that subject and its material." },
    ...savedMessages.reverse().map((m: any) => ({ role: (m.role === "user" ? "user" : "model") as "user" | "model", text: m.content })),
  ];
  if (attachmentText) history[history.length - 1].text += `\n\nCURRENT QUESTION ATTACHMENT:\n${attachmentText}`;

  try {
    const text = await generateWithHistory(history, await resolveGeminiKey(user));
    const assistantMessageId = await nextSeq(user, "chat-messages");
    await bumpSeq(user, "chat-messages", assistantMessageId);
    await ChatMessage.create({ userId: user, id: assistantMessageId, subjectId, role: "assistant", content: text, createdAt: new Date().toISOString() });
    return NextResponse.json({ text });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Something went wrong reaching Gemini." }, { status: 500 });
  }
}
