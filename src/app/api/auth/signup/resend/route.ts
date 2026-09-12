import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import PendingSignup from "@/lib/models/PendingSignup";
import { generateOtp, hashOtp } from "@/lib/auth/otp";
import { sendOtpEmail } from "@/lib/email/brevo";

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Missing email." }, { status: 400 });
    }

    await connectToDatabase();
    const normalizedEmail = email.trim().toLowerCase();

    const pending = await PendingSignup.findOne({ email: normalizedEmail });
    if (!pending) {
      return NextResponse.json(
        { error: "That signup session has expired. Please start signup again." },
        { status: 410 }
      );
    }

    const waited = Date.now() - pending.lastSentAt.getTime();
    if (waited < RESEND_COOLDOWN_MS) {
      return NextResponse.json(
        { error: `Please wait ${Math.ceil((RESEND_COOLDOWN_MS - waited) / 1000)}s before requesting another code.` },
        { status: 429 }
      );
    }

    const otp = generateOtp();
    pending.otpHash = await hashOtp(otp);
    pending.otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
    pending.attempts = 0;
    pending.lastSentAt = new Date();
    await pending.save();

    await sendOtpEmail(normalizedEmail, otp, pending.displayName);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Something went wrong resending your code." },
      { status: 500 }
    );
  }
}
