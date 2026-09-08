import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AUTH_COOKIE } from "@/lib/auth/session";

export default function RootPage() {
  const hasSession = Boolean(cookies().get(AUTH_COOKIE)?.value);
  redirect(hasSession ? "/home" : "/login");
}
