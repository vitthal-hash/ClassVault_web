import { connectToDatabase } from "@/lib/db/mongodb";
import { AppSetting } from "@/lib/db/models";

// Server-only Gemini client. Never imported by a "use client" component -
// requests go through the /api/ai/* routes instead, so the API key is
// never sent to (or bundled into) the browser.
//
// Key resolution priority, per logged-in user:
//   1. The per-account key saved in Settings (stored in MongoDB).
//   2. GEMINI_API_KEY from .env.local (or your hosting provider's env
//      vars) - a plain server-side variable, deliberately NOT prefixed
//      with NEXT_PUBLIC_ so it's never exposed to client JS.

const DEFAULT_MODEL = "gemini-3.1-flash-lite";

/** Looks up the caller's saved Gemini key (if any) and falls back to the
 *  deploy-time key from .env.local. Returns "" if neither is configured. */
export async function resolveGeminiKey(username: string): Promise<string> {
  await connectToDatabase();
  const setting = await AppSetting.findOne({ userId: username, id: 0 }).lean();
  const perUserKey = (setting as any)?.geminiApiKey;
  return perUserKey || process.env.GEMINI_API_KEY || "";
}

function extractText(data: any): string {
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
  if (!text) throw new Error("Gemini returned an empty response.");
  return text as string;
}

export async function generateRaw(prompt: string, apiKey: string, model = DEFAULT_MODEL) {
  if (!apiKey) {
    throw new Error(
      "No Gemini API key configured yet. Add one in Settings, or set GEMINI_API_KEY in .env.local."
    );
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini request failed (${res.status}): ${body.slice(0, 300)}`);
  }

  return extractText(await res.json());
}

export async function generateWithHistory(
  history: { role: "user" | "model"; text: string }[],
  apiKey: string,
  model = DEFAULT_MODEL
) {
  if (!apiKey) {
    throw new Error(
      "No Gemini API key configured yet. Add one in Settings, or set GEMINI_API_KEY in .env.local."
    );
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: history.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
      }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini request failed (${res.status}): ${body.slice(0, 300)}`);
  }
  return extractText(await res.json());
}