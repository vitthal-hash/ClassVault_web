"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Sparkles,
  Home,
  BookOpen,
  MessageCircle,
  Search,
  CalendarDays,
  Settings,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useLocalUser } from "@/lib/local/useLocalUser";
import { Semesters } from "@/lib/local/repo";
import type { Semester } from "@/lib/local/types";

const NAV = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/subjects", label: "Subjects", icon: BookOpen },
  { href: "/ai-chat", label: "AI Chat", icon: MessageCircle },
  { href: "/search", label: "Search", icon: Search },
  { href: "/semester", label: "Semester", icon: CalendarDays },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const username = useLocalUser();
  const [active, setActive] = useState<Semester | null>(null);

  useEffect(() => {
    if (!username) return;
    Semesters.activeOne(username).then(setActive);
  }, [username, pathname]);

  const initials = (user?.displayName || user?.username || "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="w-64 shrink-0 h-screen sticky top-0 flex flex-col border-r border-line bg-surface dark:bg-[#131426] dark:border-white/5 px-4 py-5">
      <div className="flex items-center gap-2 px-2 mb-6">
        <div className="h-9 w-9 rounded-xl bg-brand-500 flex items-center justify-center shadow-soft">
          <Sparkles className="h-4.5 w-4.5 text-white" />
        </div>
        <span className="text-lg font-extrabold text-ink dark:text-white">
          Class<span className="text-brand-500">Vault</span>
        </span>
      </div>

      <Link
        href="/semester"
        className="flex items-center gap-3 rounded-xl2 border border-line dark:border-white/10 px-3 py-2.5 mb-6 hover:bg-canvas dark:hover:bg-white/5 transition"
      >
        <div className="h-8 w-8 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center text-xs font-bold text-brand-600 dark:text-brand-200">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink dark:text-white truncate">
            Academic workspace
          </p>
          <p className="text-xs text-muted flex items-center gap-0.5 truncate">
            {active ? active.name : "No active semester"}
            <ChevronRight className="h-3 w-3" />
          </p>
        </div>
      </Link>

      <nav className="flex-1 space-y-1">
        {NAV.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== "/home" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl2 px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-brand-300"
                  : "text-muted hover:bg-canvas dark:hover:bg-white/5 hover:text-ink dark:hover:text-white"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="pt-3 border-t border-line dark:border-white/10 mt-3">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="h-8 w-8 rounded-full bg-brand-500 text-white flex items-center justify-center text-xs font-bold">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink dark:text-white truncate">
              {user?.displayName || user?.username}
            </p>
            <p className="text-xs text-muted truncate">@{user?.username}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
