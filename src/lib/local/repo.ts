"use client";

import { apiList, apiGet, apiUpsert, apiRemove, apiUpload, apiDeleteFile, apiWipeAccount } from "@/lib/api/client";
import type {
  Semester,
  Subject,
  Teacher,
  TimetableEntry,
  Syllabus,
  Resource,
  Lecture,
  Assignment,
  Note,
  ChatMessage,
  AppSettings,
} from "./types";

// Same per-collection helper shape as the old IndexedDB-backed repo, so none
// of the pages/components that call these need to change. `user` is kept in
// every signature for compatibility, but the server actually scopes every
// request to whoever the session cookie says is logged in - it's never
// trusted from the client.
//
// Structured data (semesters, subjects, notes, chat history, etc.) is stored
// in MongoDB. Heavy files (lecture photos, PDFs, syllabus/resource/
// assignment docs) go to Cloudinary - only the resulting URL + a small
// public id are stored in Mongo alongside the record.

export const Semesters = {
  all: (user: string) => apiList<Semester>("semesters"),
  get: (user: string, id: number) => apiGet<Semester>("semesters", id),
  async create(user: string, data: Omit<Semester, "id" | "createdAt" | "isActive">) {
    const existing = await Semesters.all(user);
    for (const s of existing) {
      if (s.isActive) await apiUpsert<Semester>("semesters", { ...s, isActive: false });
    }
    return apiUpsert<Semester>("semesters", {
      ...data,
      isActive: true,
      createdAt: new Date().toISOString(),
    });
  },
  async setActive(user: string, id: number) {
    const all = await Semesters.all(user);
    for (const s of all) {
      await apiUpsert<Semester>("semesters", { ...s, isActive: s.id === id });
    }
  },
  async remove(user: string, id: number) {
    await apiRemove("semesters", id);
  },
  async activeOne(user: string) {
    const all = await Semesters.all(user);
    return all.find((s) => s.isActive) ?? all[0] ?? null;
  },
};

export const Subjects = {
  all: (user: string) => apiList<Subject>("subjects"),
  get: (user: string, id: number) => apiGet<Subject>("subjects", id),
  async forSemester(user: string, semesterId: number) {
    const all = await Subjects.all(user);
    return all.filter((s) => s.semesterId === semesterId);
  },
  async findOrCreate(user: string, semesterId: number, name: string) {
    const existing = (await Subjects.forSemester(user, semesterId)).find(
      (s) => s.name.trim().toLowerCase() === name.trim().toLowerCase()
    );
    if (existing) return existing;
    return apiUpsert<Subject>("subjects", {
      semesterId,
      name: name.trim(),
      code: null,
      isPinned: false,
      createdAt: new Date().toISOString(),
    });
  },
  async update(user: string, subject: Subject) {
    return apiUpsert<Subject>("subjects", subject);
  },
  async togglePin(user: string, id: number) {
    const s = await Subjects.get(user, id);
    if (!s) return;
    return apiUpsert<Subject>("subjects", { ...s, isPinned: !s.isPinned });
  },
  async remove(user: string, id: number) {
    await apiRemove("subjects", id);
  },
};

export const Teachers = {
  all: (user: string) => apiList<Teacher>("teachers"),
  get: (user: string, id: number) => apiGet<Teacher>("teachers", id),
  async findOrCreate(user: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const all = await Teachers.all(user);
    const existing = all.find((t) => t.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing;
    return apiUpsert<Teacher>("teachers", { name: trimmed, createdAt: new Date().toISOString() });
  },
};

export const TimetableEntries = {
  all: (user: string) => apiList<TimetableEntry>("timetable-entries"),
  async forSubject(user: string, subjectId: number) {
    const all = await TimetableEntries.all(user);
    return all.filter((t) => t.subjectId === subjectId);
  },
  async forSemester(user: string, semesterId: number) {
    const all = await TimetableEntries.all(user);
    return all.filter((t) => t.semesterId === semesterId);
  },
  async create(user: string, data: Omit<TimetableEntry, "id" | "createdAt">) {
    return apiUpsert<TimetableEntry>("timetable-entries", {
      ...data,
      createdAt: new Date().toISOString(),
    });
  },
  async remove(user: string, id: number) {
    await apiRemove("timetable-entries", id);
  },
};

export const SyllabusRepo = {
  all: (user: string) => apiList<Syllabus>("syllabus"),
  async forSubject(user: string, subjectId: number) {
    const all = await SyllabusRepo.all(user);
    return all.find((s) => s.subjectId === subjectId) ?? null;
  },
  async upsert(user: string, subjectId: number, file: File, extractedText: string | null) {
    const uploaded = await apiUpload(file);
    const existing = await SyllabusRepo.forSubject(user, subjectId);
    const record: any = {
      ...(existing ? { id: existing.id } : {}),
      subjectId,
      fileName: file.name,
      fileRef: uploaded.url,
      filePublicId: uploaded.publicId,
      fileResourceType: uploaded.resourceType,
      extractedText,
      uploadedAt: new Date().toISOString(),
    };
    const saved = await apiUpsert<Syllabus>("syllabus", record);
    // Clean up the file it's replacing so Cloudinary storage doesn't creep up.
    if (existing && (existing as any).filePublicId) {
      apiDeleteFile((existing as any).filePublicId, (existing as any).fileResourceType);
    }
    return saved;
  },
};

export const Resources = {
  all: (user: string) => apiList<Resource>("resources"),
  async forSubject(user: string, subjectId: number) {
    const all = await Resources.all(user);
    return all.filter((r) => r.subjectId === subjectId);
  },
  async create(
    user: string,
    subjectId: number,
    file: File,
    type: Resource["type"],
    extractedText: string | null
  ) {
    const uploaded = await apiUpload(file);
    return apiUpsert<Resource>("resources", {
      subjectId,
      name: file.name,
      fileRef: uploaded.url,
      filePublicId: uploaded.publicId,
      fileResourceType: uploaded.resourceType,
      type,
      extractedText,
      uploadedAt: new Date().toISOString(),
    });
  },
  async remove(user: string, id: number) {
    // The server deletes the Cloudinary asset automatically when the record goes.
    await apiRemove("resources", id);
  },
};

export const Lectures = {
  all: (user: string) => apiList<Lecture>("lectures"),
  get: (user: string, id: number) => apiGet<Lecture>("lectures", id),
  async forSubject(user: string, subjectId: number) {
    const all = await Lectures.all(user);
    return all.filter((l) => l.subjectId === subjectId);
  },
  async starred(user: string, subjectIds?: number[]) {
    const all = await Lectures.all(user);
    return all.filter((l) => l.isStarred && (!subjectIds || subjectIds.includes(l.subjectId)));
  },
  async create(
    user: string,
    subjectId: number,
    sessionType: Lecture["sessionType"],
    lectureCode: string,
    file: File
  ) {
    const uploaded = await apiUpload(file);
    return apiUpsert<Lecture>("lectures", {
      subjectId,
      sessionType,
      lectureCode,
      imageRef: uploaded.url,
      imagePublicId: uploaded.publicId,
      imageResourceType: uploaded.resourceType,
      capturedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      isStarred: false,
      ocrText: null,
    });
  },
  async update(user: string, lecture: Lecture) {
    return apiUpsert<Lecture>("lectures", lecture);
  },
  async toggleStar(user: string, id: number) {
    const l = await Lectures.get(user, id);
    if (!l) return;
    return apiUpsert<Lecture>("lectures", { ...l, isStarred: !l.isStarred });
  },
  async remove(user: string, id: number) {
    await apiRemove("lectures", id);
  },
  async nextCode(
    user: string,
    subject: { id: number; code?: string | null; name: string },
    sessionType: Lecture["sessionType"]
  ) {
    const existing = await Lectures.forSubject(user, subject.id);
    const sameType = existing.filter((l) => l.sessionType === sessionType);
    const count = (sameType.length + 1).toString().padStart(3, "0");
    const prefix = (subject.code && subject.code.trim()) || subject.name.slice(0, 4).toUpperCase();
    const initial = sessionType === "theory" ? "T" : sessionType === "lab" ? "L" : "TU";
    return `${prefix}_${initial}_${count}`;
  },
};

export const Assignments = {
  all: (user: string) => apiList<Assignment>("assignments"),
  async forSubject(user: string, subjectId: number) {
    const all = await Assignments.all(user);
    return all
      .filter((a) => a.subjectId === subjectId)
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
  },
  async create(user: string, subjectId: number, title: string, deadline: string, file?: File | null) {
    let fileRef: string | undefined;
    let filePublicId: string | undefined;
    let fileResourceType: string | undefined;
    if (file) {
      const uploaded = await apiUpload(file);
      fileRef = uploaded.url;
      filePublicId = uploaded.publicId;
      fileResourceType = uploaded.resourceType;
    }
    return apiUpsert<Assignment>("assignments", {
      subjectId,
      title,
      deadline,
      status: "pending",
      fileName: file?.name ?? null,
      fileRef: fileRef ?? null,
      filePublicId: filePublicId ?? null,
      fileResourceType: fileResourceType ?? null,
      createdAt: new Date().toISOString(),
    });
  },
  async toggleStatus(user: string, id: number) {
    const all = await Assignments.all(user);
    const a = all.find((x) => x.id === id);
    if (!a) return;
    return apiUpsert<Assignment>("assignments", {
      ...a,
      status: a.status === "pending" ? "submitted" : "pending",
    });
  },
  async remove(user: string, id: number) {
    await apiRemove("assignments", id);
  },
};

export const Notes = {
  all: (user: string) => apiList<Note>("notes"),
  async forSubject(user: string, subjectId: number) {
    const all = await Notes.all(user);
    return all
      .filter((n) => n.subjectId === subjectId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },
  async create(user: string, subjectId: number, title: string | null, body: string) {
    const now = new Date().toISOString();
    return apiUpsert<Note>("notes", { subjectId, title, body, createdAt: now, updatedAt: now, remindMe: false });
  },
  async update(user: string, note: Note) {
    return apiUpsert<Note>("notes", { ...note, updatedAt: new Date().toISOString() });
  },
  async remove(user: string, id: number) {
    await apiRemove("notes", id);
  },
};

export const ChatMessages = {
  async forSubject(user: string, subjectId: number) {
    const all = await apiList<ChatMessage>("chat-messages");
    return all
      .filter((m) => m.subjectId === subjectId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  },
  async add(user: string, subjectId: number, role: ChatMessage["role"], content: string) {
    return apiUpsert<ChatMessage>("chat-messages", {
      subjectId,
      role,
      content,
      createdAt: new Date().toISOString(),
    });
  },
};

export const Settings = {
  async get(user: string): Promise<AppSettings> {
    const all = await apiList<AppSettings>("settings");
    return all.find((s) => s.id === 0) ?? { id: 0, themePreference: "system", geminiApiKey: null };
  },
  async update(user: string, patch: Partial<AppSettings>) {
    const current = await Settings.get(user);
    return apiUpsert<AppSettings>("settings", { ...current, ...patch, id: 0 });
  },
};

export async function wipeAllData(user: string) {
  await apiWipeAccount();
}

// ---- backup / restore ----
// File contents themselves live in Cloudinary, but unlike the old
// IndexedDB export, the URLs are tiny strings - so they're included here.
// A restored backup still points at the same Cloudinary files as long as
// they weren't deleted from the original account.

const EXPORT_RESOURCES: { slug: string; key: string }[] = [
  { slug: "semesters", key: "semesters" },
  { slug: "subjects", key: "subjects" },
  { slug: "teachers", key: "teachers" },
  { slug: "timetable-entries", key: "timetableEntries" },
  { slug: "syllabus", key: "syllabus" },
  { slug: "resources", key: "resources" },
  { slug: "lectures", key: "lectures" },
  { slug: "assignments", key: "assignments" },
  { slug: "notes", key: "notes" },
  { slug: "chat-messages", key: "chatMessages" },
  { slug: "settings", key: "appSettings" },
];

export async function getAllForExport(user: string) {
  const out: Record<string, unknown> = { exportedAt: new Date().toISOString(), version: 2 };
  for (const { slug, key } of EXPORT_RESOURCES) {
    out[key] = await apiList(slug);
  }
  return out;
}

export async function importAll(user: string, data: Record<string, any>) {
  for (const { slug, key } of EXPORT_RESOURCES) {
    const rows = data[key];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (row && typeof row.id !== "undefined") {
        await apiUpsert(slug, row);
      }
    }
  }
}
