import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api/authUser";
import { resolveGeminiKey, generateWithHistory } from "@/lib/gemini";

// POST /api/ai/chat - multi-turn Gemini call backing ChatPanel's
// subject-scoped assistant (grounded in that subject's own uploaded
// material, no side effects - see /api/ai/assistant for the global,
// action-capable ClassVault bot). Body:
// { history: { role: "user" | "model"; text: string }[] }. The API key is
// resolved server-side (per-user Settings, then GEMINI_API_KEY from
// .env.local) and never touches the client.
export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const history = Array.isArray(body?.history) ? body.history : null;
  if (!history || history.length === 0) {
    return NextResponse.json({ error: "history is required." }, { status: 400 });
  }

  try {
    const apiKey = await resolveGeminiKey(user);
    const text = await generateWithHistory(history, apiKey);
    return NextResponse.json({ text });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Something went wrong reaching Gemini." },
      { status: 500 }
    );
  }
}