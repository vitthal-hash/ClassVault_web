"use client";

// Small fetch wrappers around the generic /api/data/:resource routes and
// /api/upload. The session cookie (httpOnly) rides along automatically on
// same-origin requests, so nothing here needs to know the current username -
// the server derives it from the cookie on every call.

/** Thrown by request() for any non-2xx response, carrying the HTTP status
 *  so callers (like apiGet below) can tell "this specific record doesn't
 *  exist" (404 from our own API, expected/handleable) apart from "this
 *  route doesn't exist at all" or a real server error (should surface,
 *  never silently become null). */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(err.error || `Request failed (${res.status})`, res.status);
  }
  if (res.status === 204) return null as T;
  return res.json();
}

export const apiList = <T>(resource: string) => request<T[]>(`/api/data/${resource}`).then((r) => r ?? []);

export const apiGet = async <T>(resource: string, id: number): Promise<T | null> => {
  try {
    return await request<T>(`/api/data/${resource}/${id}`);
  } catch (e) {
    // A 404 here means "no record with this id" (our own API always
    // returns that as a normal JSON response) - genuinely absent, not an
    // error. Anything else (401, 500, or the route not existing at all)
    // is a real problem and should surface rather than look like "not
    // found".
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
};

export const apiUpsert = <T>(resource: string, record: Record<string, any>) =>
  request<T>(`/api/data/${resource}`, { method: "POST", body: JSON.stringify(record) });

export const apiRemove = (resource: string, id: number) =>
  request<void>(`/api/data/${resource}/${id}`, { method: "DELETE" });

export async function apiUpload(file: File): Promise<{
  url: string;
  publicId: string;
  resourceType: string;
  name: string;
  type: string;
}> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd, credentials: "same-origin" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Upload failed.");
  }
  return res.json();
}

export async function apiDeleteFile(publicId?: string | null, resourceType?: string | null) {
  if (!publicId) return;
  try {
    await fetch("/api/upload", {
      method: "DELETE",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicId, resourceType }),
    });
  } catch {
    // best-effort cleanup
  }
}

export async function apiWipeAccount() {
  await request("/api/account/wipe", { method: "POST" });
}

// Gemini AI calls. These hit our own server routes (not Google's API
// directly) so the API key - whether the per-account one saved in
// Settings or the GEMINI_API_KEY fallback from .env.local - is resolved
// server-side and never sent to or stored in the browser.

export const apiGenerate = (prompt: string) =>
  request<{ text: string }>("/api/ai/generate", {
    method: "POST",
    body: JSON.stringify({ prompt }),
  }).then((r) => r.text);

export const apiChat = (history: { role: "user" | "model"; text: string }[]) =>
  request<{ text: string }>("/api/ai/chat", {
    method: "POST",
    body: JSON.stringify({ history }),
  }).then((r) => r.text);

export const apiSubjectChat = (
  subjectId: number,
  message: string,
  attachments: { name: string; text: string }[] = []
) =>
  request<{ text: string }>("/api/ai/subject-chat", {
    method: "POST",
    body: JSON.stringify({ subjectId, message, attachments }),
  }).then((r) => r.text);

// The global "ClassVault" assistant (AI Chat page). Unlike apiChat above,
// this one can also ask the app to actually do something - change the
// theme, open a subject, add a note/assignment - via the `action` field.
// See src/lib/assistant/{types,dispatcher}.ts for the shape and how it's
// carried out.
export const apiAssistant = (message: string) =>
  request<{ text: string; action: import("@/lib/assistant/types").AssistantAction }>(
    "/api/ai/assistant",
    { method: "POST", body: JSON.stringify({ message }) }
  );
