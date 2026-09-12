"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellRing, AlertCircle, Clock } from "lucide-react";
import { useLocalUser } from "@/lib/local/useLocalUser";
import { Assignments, Subjects } from "@/lib/local/repo";

const DUE_SOON_MS = 3 * 24 * 60 * 60 * 1000; // show anything due within 3 days
const POLL_MS = 60 * 1000;

type Item = {
  id: number;
  title: string;
  subjectId: number;
  subjectName: string;
  deadline: string;
  overdue: boolean;
};

/** Real notification dropdown, backed by the same assignment data as the
 *  rest of the app - no separate "notifications" store, so it's never out
 *  of sync with what's actually due. For alerts that fire even while this
 *  tab is in the background, students can opt into the browser's own
 *  Notification API (see the link at the bottom of the panel); that still
 *  requires the tab to be open somewhere - true push-when-closed would need
 *  a service worker and a server-side scheduler, which is a bigger addition. */
export function NotificationsBell() {
  const username = useLocalUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!username) return;
    const [assignments, subjects] = await Promise.all([Assignments.all(username), Subjects.all(username)]);
    const nameFor = new Map(subjects.map((s) => [s.id, s.name]));
    const now = Date.now();
    const due: Item[] = [];
    for (const a of assignments) {
      if (a.status !== "pending") continue;
      const due_at = new Date(a.deadline).getTime();
      if (due_at - now > DUE_SOON_MS) continue;
      due.push({
        id: a.id,
        title: a.title,
        subjectId: a.subjectId,
        subjectName: nameFor.get(a.subjectId) ?? "Subject",
        deadline: a.deadline,
        overdue: due_at < now,
      });
    }
    due.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
    setItems(due);
  }, [username]);

  useEffect(() => {
    if ("Notification" in window) setPermission(Notification.permission);
    load();
    const timer = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (open && panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const goTo = (item: Item) => {
    setOpen(false);
    router.push(`/subjects/${item.subjectId}?tab=assignments`);
  };

  const enableAlerts = async () => {
    if (!("Notification" in window)) return;
    setPermission(await Notification.requestPermission());
  };

  const overdueCount = items.filter((i) => i.overdue).length;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="h-10 w-10 rounded-full border border-line dark:border-white/10 flex items-center justify-center relative hover:bg-canvas dark:hover:bg-white/5 transition"
        aria-label={items.length ? `${items.length} assignment reminders` : "Notifications"}
      >
        {items.length ? <BellRing className="h-4.5 w-4.5 text-brand-500" /> : <Bell className="h-4.5 w-4.5 text-muted" />}
        {items.length > 0 && (
          <span
            className={`absolute top-1.5 right-1.5 h-4 min-w-[16px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center ${
              overdueCount > 0 ? "bg-red-500" : "bg-amber-500"
            }`}
          >
            {items.length > 9 ? "9+" : items.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 card p-2 z-20 max-h-[70vh] overflow-y-auto">
          <div className="px-2.5 py-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-ink dark:text-white">Assignment reminders</p>
            {items.length > 0 && <span className="text-xs text-muted">{items.length}</span>}
          </div>

          {items.length === 0 ? (
            <p className="px-2.5 pb-3 text-sm text-muted">Nothing due in the next 3 days. You're all caught up.</p>
          ) : (
            <div className="space-y-1">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => goTo(item)}
                  className="w-full text-left flex items-start gap-2.5 rounded-lg px-2.5 py-2 hover:bg-canvas dark:hover:bg-white/5 transition"
                >
                  {item.overdue ? (
                    <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  ) : (
                    <Clock className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  )}
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink dark:text-white truncate">{item.title}</span>
                    <span className="block text-xs text-muted truncate">
                      {item.subjectName} · {item.overdue ? "Overdue" : `Due ${new Date(item.deadline).toLocaleDateString()}`}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {permission === "default" && (
            <button
              onClick={enableAlerts}
              className="w-full mt-1 text-xs font-semibold text-brand-500 hover:underline px-2.5 py-2 text-left"
            >
              Enable desktop alerts for new deadlines
            </button>
          )}
        </div>
      )}
    </div>
  );
}
