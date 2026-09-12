import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/lib/models/User";
import PendingSignup from "@/lib/models/PendingSignup";
import { generateOtp, hashOtp } from "@/lib/auth/otp";
import { sendOtpEmail } from "@/lib/email/brevo";

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const { username, email, password, displayName } = await req.json();

    if (!username || typeof username !== "string" || username.trim().length < 3) {
      return NextResponse.json({ error: "Username must be at least 3 characters." }, { status: 400 });
    }
    if (!email || typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    await connectToDatabase();

    const normalizedUsername = username.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();

    const [existingUsername, existingEmail] = await Promise.all([
      User.findOne({ username: normalizedUsername }),
      User.findOne({ email: normalizedEmail }),
    ]);
    if (existingUsername) {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }
    if (existingEmail) {
      return NextResponse.json(
        { error: "An account with that email already exists. Try logging in instead." },
        { status: 409 }
      );
    }

    // If they've already requested a code very recently for this email,
    // don't fire another Brevo send - just tell them to wait/check inbox.
    const existingPending = await PendingSignup.findOne({ email: normalizedEmail });
    if (existingPending && Date.now() - existingPending.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
      return NextResponse.json(
        { error: "A code was just sent. Please wait a few seconds before requesting another." },
        { status: 429 }
      );
    }

    const otp = generateOtp();
    const [otpHash, passwordHash] = await Promise.all([hashOtp(otp), bcrypt.hash(password, 10)]);

    await PendingSignup.findOneAndUpdate(
      { email: normalizedEmail },
      {
        email: normalizedEmail,
        username: normalizedUsername,
        displayName: displayName?.trim() || normalizedUsername,
        passwordHash,
        otpHash,
        otpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
        attempts: 0,
        lastSentAt: new Date(),
        createdAt: new Date(),
      },
      { upsert: true, setDefaultsOnInsert: true }
    );

    await sendOtpEmail(normalizedEmail, otp, displayName?.trim());

    return NextResponse.json({ email: normalizedEmail });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Something went wrong starting signup." },
      { status: 500 }
    );
  }
}
