"use client";

import { useState } from "react";
import { LogOut, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { NotificationsBell } from "@/components/NotificationsBell";

export function TopBar({ crumbs }: { crumbs: string[] }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const initials = (user?.displayName || user?.username || "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="flex items-center justify-between px-8 py-5">
      <div className="flex items-center gap-1.5 text-sm">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span className={i === crumbs.length - 1 ? "font-semibold text-ink dark:text-white" : "text-muted"}>
              {c}
            </span>
            {i < crumbs.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-muted" />}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <NotificationsBell />

        <div className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            className="h-10 w-10 rounded-full bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-200 flex items-center justify-center text-xs font-bold"
          >
            {initials}
          </button>
          {open && (
            <div className="absolute right-0 mt-2 w-48 card p-1.5 z-20">
              <div className="px-2.5 py-2">
                <p className="text-sm font-semibold text-ink dark:text-white truncate">
                  {user?.displayName || user?.username}
                </p>
                <p className="text-xs text-muted truncate">@{user?.username}</p>
              </div>
              <button
                onClick={logout}
                className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
              >
                <LogOut className="h-4 w-4" /> Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
