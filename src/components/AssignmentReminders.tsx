"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { useLocalUser } from "@/lib/local/useLocalUser";
import { Assignments } from "@/lib/local/repo";

const DAY = 24 * 60 * 60 * 1000;

/** Browser reminders while ClassVault is open. Notification permission is
 * requested only after the student explicitly clicks the banner. */
export function AssignmentReminders() {
  const username = useLocalUser();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if ("Notification" in window) setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (!username) return;
    const check = async () => {
      // Re-read the live permission each tick rather than trusting the
      // `permission` state snapshot below, since the student may have
      // granted it from the notifications bell after this component mounted.
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      const assignments = await Assignments.all(username);
      const now = Date.now();
      for (const assignment of assignments) {
        if (assignment.status !== "pending") continue;
        const due = new Date(assignment.deadline).getTime();
        const remaining = due - now;
        if (remaining > DAY || remaining < -DAY) continue;
        const key = `classvault-reminder-${assignment.id}-${new Date(assignment.deadline).toDateString()}`;
        if (sessionStorage.getItem(key)) continue;
        new Notification(remaining < 0 ? "Assignment overdue" : "Assignment due soon", {
          body: `${assignment.title}${remaining < 0 ? " is overdue." : " is due within 24 hours."}`,
          tag: key,
        });
        sessionStorage.setItem(key, "sent");
      }
    };
    check();
    const timer = window.setInterval(check, 15 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [username, permission]);

  if (permission !== "default" || dismissed) return null;
  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm card p-4 shadow-xl flex gap-3">
      <Bell className="h-5 w-5 shrink-0 text-brand-500 mt-0.5" />
      <div className="min-w-0"><p className="text-sm font-semibold text-ink dark:text-white">Never miss an assignment</p><p className="text-xs text-muted mt-1">Enable browser reminders for assignments due within 24 hours.</p><button className="text-xs font-semibold text-brand-500 mt-2" onClick={async () => setPermission(await Notification.requestPermission())}>Enable reminders</button></div>
      <button aria-label="Dismiss reminders prompt" className="text-muted hover:text-ink self-start" onClick={() => setDismissed(true)}><X className="h-4 w-4" /></button>
    </div>
  );
}
