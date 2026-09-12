import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/lib/models/User";
import PendingSignup from "@/lib/models/PendingSignup";
import { verifyOtp } from "@/lib/auth/otp";
import { signSession, AUTH_COOKIE } from "@/lib/auth/session";

const MAX_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  try {
    const { email, otp } = await req.json();
    if (!email || typeof email !== "string" || !otp || typeof otp !== "string") {
      return NextResponse.json({ error: "Enter the code from your email." }, { status: 400 });
    }

    await connectToDatabase();
    const normalizedEmail = email.trim().toLowerCase();

    const pending = await PendingSignup.findOne({ email: normalizedEmail });
    if (!pending) {
      return NextResponse.json(
        { error: "That code has expired or wasn't found. Request a new one." },
        { status: 410 }
      );
    }

    if (pending.otpExpiresAt.getTime() < Date.now()) {
      await PendingSignup.deleteOne({ _id: pending._id });
      return NextResponse.json({ error: "That code expired. Request a new one." }, { status: 410 });
    }

    if (pending.attempts >= MAX_ATTEMPTS) {
      await PendingSignup.deleteOne({ _id: pending._id });
      return NextResponse.json(
        { error: "Too many incorrect attempts. Request a new code to try again." },
        { status: 429 }
      );
    }

    const match = await verifyOtp(otp.trim(), pending.otpHash);
    if (!match) {
      pending.attempts += 1;
      await pending.save();
      const remaining = MAX_ATTEMPTS - pending.attempts;
      return NextResponse.json(
        {
          error:
            remaining > 0
              ? `That code isn't right. ${remaining} attempt${remaining === 1 ? "" : "s"} left.`
              : "Too many incorrect attempts. Request a new code to try again.",
        },
        { status: 400 }
      );
    }

    // Re-check uniqueness in case someone else claimed the username/email
    // while this code was pending.
    const [existingUsername, existingEmail] = await Promise.all([
      User.findOne({ username: pending.username }),
      User.findOne({ email: pending.email }),
    ]);
    if (existingUsername || existingEmail) {
      await PendingSignup.deleteOne({ _id: pending._id });
      return NextResponse.json(
        { error: "That username or email was just taken. Please sign up again." },
        { status: 409 }
      );
    }

    const user = await User.create({
      username: pending.username,
      email: pending.email,
      passwordHash: pending.passwordHash,
      displayName: pending.displayName,
      emailVerified: true,
    });
    await PendingSignup.deleteOne({ _id: pending._id });

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
      { error: err?.message || "Something went wrong verifying your code." },
      { status: 500 }
    );
  }
}
