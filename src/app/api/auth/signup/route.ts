import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/lib/models/User";
import { signSession, AUTH_COOKIE } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  try {
    const { username, password, displayName } = await req.json();

    if (!username || typeof username !== "string" || username.trim().length < 3) {
      return NextResponse.json(
        { error: "Username must be at least 3 characters." },
        { status: 400 }
      );
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const normalized = username.trim().toLowerCase();
    const existing = await User.findOne({ username: normalized });
    if (existing) {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username: normalized,
      passwordHash,
      displayName: displayName?.trim() || normalized,
    });

    const token = signSession({ username: user.username, displayName: user.displayName });
    const res = NextResponse.json({
      username: user.username,
      displayName: user.displayName,
    });
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
      { error: err?.message || "Something went wrong creating your account." },
      { status: 500 }
    );
  }
}
