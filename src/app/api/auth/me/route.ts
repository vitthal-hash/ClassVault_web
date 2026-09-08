import { NextRequest, NextResponse } from "next/server";
import { verifySession, AUTH_COOKIE } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (!token) return NextResponse.json({ user: null });
  const session = verifySession(token);
  if (!session) return NextResponse.json({ user: null });
  return NextResponse.json({ user: session });
}
