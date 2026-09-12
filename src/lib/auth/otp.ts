import bcrypt from "bcryptjs";

/** Generates a 6-digit numeric OTP, e.g. "042817". */
export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, 10);
}

export function verifyOtp(otp: string, hash: string): Promise<boolean> {
  return bcrypt.compare(otp, hash);
}
