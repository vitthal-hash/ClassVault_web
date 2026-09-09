import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api/authUser";
import { resolveGeminiKey, generateRaw } from "@/lib/gemini";

// POST /api/ai/generate - single-shot Gemini call backing apiGenerate
// (currently used by LecturesTab for OCR'd-lecture insight generation).
// Body: { prompt: string }. The API key is resolved server-side (per-user
// Settings, then GEMINI_API_KEY from .env.local) and never touches the
// client.
export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return NextResponse.json({ error: "prompt is required." }, { status: 400 });
  }

  try {
    const apiKey = await resolveGeminiKey(user);
    const text = await generateRaw(prompt, apiKey);
    return NextResponse.json({ text });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Something went wrong reaching Gemini." },
      { status: 500 }
    );
  }
}