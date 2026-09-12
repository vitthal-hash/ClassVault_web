import { Schema, models, model } from "mongoose";

/**
 * Holds a signup attempt that hasn't been confirmed with an OTP yet.
 * No User document is created until `/api/auth/signup/verify` succeeds -
 * this is where the (hashed) intended account details live in the
 * meantime. Documents expire automatically via the TTL index below, so a
 * student who never verifies doesn't leave anything behind and can freely
 * retry signup with the same email/username later.
 */
export interface IPendingSignup {
  _id: string;
  email: string;
  username: string;
  displayName?: string;
  passwordHash: string;
  otpHash: string;
  otpExpiresAt: Date;
  attempts: number;
  lastSentAt: Date;
  createdAt: Date;
}

const PendingSignupSchema = new Schema<IPendingSignup>({
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  username: { type: String, required: true, trim: true, lowercase: true },
  displayName: { type: String },
  passwordHash: { type: String, required: true },
  otpHash: { type: String, required: true },
  otpExpiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
  lastSentAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now, expires: 60 * 30 }, // auto-purged 30 min after creation
});

export default models.PendingSignup || model<IPendingSignup>("PendingSignup", PendingSignupSchema);
