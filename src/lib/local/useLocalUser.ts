"use client";

import { useAuth } from "@/lib/auth/AuthContext";

/** Convenience hook: the username that keys every IndexedDB collection. */
export function useLocalUser() {
  const { user } = useAuth();
  return user?.username ?? null;
}
