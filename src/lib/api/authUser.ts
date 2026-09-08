import { NextRequest } from "next/server";
import { verifySession, AUTH_COOKIE } from "@/lib/auth/session";

/** Resolves the username of the caller from the session cookie. Every
 *  /api/data and /api/upload route scopes its DB/Cloudinary work to this
 *  value - it is never trusted from the request body. */
export function getUserFromRequest(req: NextRequest): string | null {
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  const session = verifySession(token);
  return session?.username ?? null;
}
