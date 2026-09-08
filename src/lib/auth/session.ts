import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "classvault-dev-secret-change-me";
export const AUTH_COOKIE = "classvault_session";

export interface SessionPayload {
  username: string;
  displayName?: string;
}

export function signSession(payload: SessionPayload) {
  return jwt.sign(payload, SECRET, { expiresIn: "30d" });
}

export function verifySession(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, SECRET) as SessionPayload;
  } catch {
    return null;
  }
}
