import { Schema, models, model, Model } from "mongoose";
import { connectToDatabase } from "./mongodb";

// Every collection below mirrors a store from the old client-side IndexedDB
// layer (see src/lib/local/types.ts). Each document carries:
//   - userId: the owning account's username (all queries are scoped to it)
//   - id: a per-user auto-incrementing number, kept so the existing
//     frontend code (which keys everything off numeric ids) didn't need to
//     be rewritten to use Mongo ObjectIds.
//
// File-bearing collections (syllabus, resources, lectures, assignments)
// store the Cloudinary secure URL in *Ref fields, plus the Cloudinary
// public id + resource type so the asset can be cleaned up on delete.

const baseFields = {
  userId: { type: String, required: true, index: true },
  id: { type: Number, required: true },
};

function withBase(schema: Record<string, any>) {
  return { ...baseFields, ...schema };
}

function makeModel(name: string, fields: Record<string, any>): Model<any> {
  const schema = new Schema(withBase(fields), { minimize: false });
  schema.index({ userId: 1, id: 1 }, { unique: true });
  return models[name] || model(name, schema);
}

export const Semester = makeModel("Semester", {
  name: { type: String, required: true },
  semesterNumber: { type: Number, required: true },
  startDate: { type: String, required: true },
  endDate: { type: String, required: true },
  isActive: { type: Boolean, default: false },
  createdAt: { type: String, required: true },
});

export const Subject = makeModel("Subject", {
  semesterId: { type: Number, required: true },
  name: { type: String, required: true },
  code: { type: String, default: null },
  isPinned: { type: Boolean, default: false },
  createdAt: { type: String, required: true },
});

export const Teacher = makeModel("Teacher", {
  name: { type: String, required: true },
  createdAt: { type: String, required: true },
});

export const TimetableEntry = makeModel("TimetableEntry", {
  semesterId: { type: Number, required: true },
  subjectId: { type: Number, required: true },
  teacherId: { type: Number, default: null },
  day: { type: String, required: true },
  startMinutes: { type: Number, required: true },
  endMinutes: { type: Number, required: true },
  sessionType: { type: String, required: true },
  room: { type: String, default: null },
  createdAt: { type: String, required: true },
});

export const Syllabus = makeModel("Syllabus", {
  subjectId: { type: Number, required: true },
  fileName: { type: String, required: true },
  fileRef: { type: String, required: true },
  filePublicId: { type: String, default: null },
  fileResourceType: { type: String, default: null },
  extractedText: { type: String, default: null },
  uploadedAt: { type: String, required: true },
});

export const Resource = makeModel("Resource", {
  subjectId: { type: Number, required: true },
  name: { type: String, required: true },
  fileRef: { type: String, required: true },
  filePublicId: { type: String, default: null },
  fileResourceType: { type: String, default: null },
  type: { type: String, required: true },
  extractedText: { type: String, default: null },
  uploadedAt: { type: String, required: true },
});

export const Lecture = makeModel("Lecture", {
  subjectId: { type: Number, required: true },
  sessionType: { type: String, required: true },
  lectureCode: { type: String, required: true },
  imageRef: { type: String, required: true },
  imagePublicId: { type: String, default: null },
  imageResourceType: { type: String, default: null },
  capturedAt: { type: String, required: true },
  createdAt: { type: String, required: true },
  isStarred: { type: Boolean, default: false },
  ocrText: { type: String, default: null },
});

export const Assignment = makeModel("Assignment", {
  subjectId: { type: Number, required: true },
  title: { type: String, required: true },
  fileName: { type: String, default: null },
  fileRef: { type: String, default: null },
  filePublicId: { type: String, default: null },
  fileResourceType: { type: String, default: null },
  deadline: { type: String, required: true },
  status: { type: String, required: true },
  createdAt: { type: String, required: true },
});

export const Note = makeModel("Note", {
  subjectId: { type: Number, required: true },
  title: { type: String, default: null },
  body: { type: String, required: true },
  createdAt: { type: String, required: true },
  updatedAt: { type: String, required: true },
  remindMe: { type: Boolean, default: false },
});

export const ChatMessage = makeModel("ChatMessage", {
  subjectId: { type: Number, required: true },
  role: { type: String, required: true },
  content: { type: String, required: true },
  createdAt: { type: String, required: true },
});

export const AppSetting = makeModel("AppSetting", {
  themePreference: { type: String, default: "system" },
  geminiApiKey: { type: String, default: null },
});

// ---- per-user, per-resource id counters ----

const CounterSchema = new Schema({
  userId: { type: String, required: true },
  resource: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
});
CounterSchema.index({ userId: 1, resource: 1 }, { unique: true });
export const Counter = models.Counter || model("Counter", CounterSchema);

/** Atomically returns the next id for this user+resource, starting at 1. */
export async function nextSeq(userId: string, resource: string): Promise<number> {
  await connectToDatabase();
  const doc = await Counter.findOneAndUpdate(
    { userId, resource },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  return doc.seq;
}

/** Ensures future auto-assigned ids never collide with an explicitly-set id
 *  (used when a client upserts a record with an id it already knows about,
 *  e.g. an update, a toggle, or a backup import). */
export async function bumpSeq(userId: string, resource: string, atLeast: number) {
  await connectToDatabase();
  await Counter.findOneAndUpdate(
    { userId, resource },
    { $max: { seq: atLeast } },
    { upsert: true }
  );
}

// ---- resource registry used by the generic /api/data routes ----

export interface FileFieldSpec {
  urlField: string;
  publicIdField: string;
  resourceTypeField: string;
}

export interface ResourceConfig {
  slug: string;
  exportKey: string;
  model: Model<any>;
  fileFields?: FileFieldSpec[];
}

export const RESOURCES: ResourceConfig[] = [
  { slug: "semesters", exportKey: "semesters", model: Semester },
  { slug: "subjects", exportKey: "subjects", model: Subject },
  { slug: "teachers", exportKey: "teachers", model: Teacher },
  { slug: "timetable-entries", exportKey: "timetableEntries", model: TimetableEntry },
  {
    slug: "syllabus",
    exportKey: "syllabus",
    model: Syllabus,
    fileFields: [{ urlField: "fileRef", publicIdField: "filePublicId", resourceTypeField: "fileResourceType" }],
  },
  {
    slug: "resources",
    exportKey: "resources",
    model: Resource,
    fileFields: [{ urlField: "fileRef", publicIdField: "filePublicId", resourceTypeField: "fileResourceType" }],
  },
  {
    slug: "lectures",
    exportKey: "lectures",
    model: Lecture,
    fileFields: [{ urlField: "imageRef", publicIdField: "imagePublicId", resourceTypeField: "imageResourceType" }],
  },
  {
    slug: "assignments",
    exportKey: "assignments",
    model: Assignment,
    fileFields: [{ urlField: "fileRef", publicIdField: "filePublicId", resourceTypeField: "fileResourceType" }],
  },
  { slug: "notes", exportKey: "notes", model: Note },
  { slug: "chat-messages", exportKey: "chatMessages", model: ChatMessage },
  { slug: "settings", exportKey: "appSettings", model: AppSetting },
];

export function findResourceConfig(slug: string): ResourceConfig | undefined {
  return RESOURCES.find((r) => r.slug === slug);
}

/** Field names a client is allowed to write, derived from the schema itself
 *  (everything except Mongo/internal bookkeeping fields). */
export function writableFields(cfg: ResourceConfig): string[] {
  return Object.keys(cfg.model.schema.paths).filter(
    (k) => !["_id", "__v", "id", "userId"].includes(k)
  );
}
