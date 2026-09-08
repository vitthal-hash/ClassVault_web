import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/lib/models/User";
import { signSession, AUTH_COOKIE } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
    }

    await connectToDatabase();

    const normalized = String(username).trim().toLowerCase();
    const user = await User.findOne({ username: normalized });
    if (!user) {
      return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
    }

    const token = signSession({ username: user.username, displayName: user.displayName });
    const res = NextResponse.json({ username: user.username, displayName: user.displayName });
    res.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Something went wrong logging you in." },
      { status: 500 }
    );
  }
}
