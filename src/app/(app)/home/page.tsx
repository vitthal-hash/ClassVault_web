"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  FileText,
  Star,
  ClipboardList,
  Zap,
  Sparkles,
  ChevronRight,
  Pin,
} from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { useAuth } from "@/lib/auth/AuthContext";
import { useLocalUser } from "@/lib/local/useLocalUser";
import {
  Semesters,
  Subjects,
  TimetableEntries,
  Teachers,
  Lectures,
  Assignments,
} from "@/lib/local/repo";
import type { Semester, Subject, TimetableEntry } from "@/lib/local/types";
import { weekdayFromDate } from "@/lib/local/types";
import { colorFor } from "@/lib/palette";

interface TodayClass extends TimetableEntry {
  subjectName: string;
  teacherName?: string;
}

export default function HomePage() {
  const { user } = useAuth();
  const username = useLocalUser();
  const router = useRouter();

  const [semester, setSemester] = useState<Semester | null>(null);
  const [todayClasses, setTodayClasses] = useState<TodayClass[]>([]);
  const [pendingReview, setPendingReview] = useState(0);
  const [starredCount, setStarredCount] = useState(0);
  const [dueThisWeek, setDueThisWeek] = useState(0);
  const [dueTomorrow, setDueTomorrow] = useState(0);
  const [pinned, setPinned] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!username) return;
    setLoading(true);
    const active = await Semesters.activeOne(username);
    setSemester(active);
    if (!active) {
      setLoading(false);
      return;
    }

    const [subjects, entries, teachers, lectures, assignments] = await Promise.all([
      Subjects.forSemester(username, active.id),
      TimetableEntries.forSemester(username, active.id),
      Teachers.all(username),
      Lectures.all(username),
      Assignments.all(username),
    ]);

    const subjectMap = new Map(subjects.map((s) => [s.id, s]));
    const teacherMap = new Map(teachers.map((t) => [t.id, t]));
    const today = weekdayFromDate(new Date());
    const todays = entries
      .filter((e) => e.day === today)
      .map((e) => ({
        ...e,
        subjectName: subjectMap.get(e.subjectId)?.name ?? "Unknown",
        teacherName: e.teacherId ? teacherMap.get(e.teacherId)?.name : undefined,
      }))
      .sort((a, b) => a.startMinutes - b.startMinutes);
    setTodayClasses(todays);

    const subjectIds = new Set(subjects.map((s) => s.id));
    const semesterLectures = lectures.filter((l) => subjectIds.has(l.subjectId));
    setPendingReview(semesterLectures.filter((l) => !l.ocrText).length);
    setStarredCount(semesterLectures.filter((l) => l.isStarred).length);

    const semesterAssignments = assignments.filter((a) => subjectIds.has(a.subjectId));
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const dayMs = 24 * 60 * 60 * 1000;
    setDueThisWeek(
      semesterAssignments.filter(
        (a) => a.status === "pending" && new Date(a.deadline).getTime() - now <= weekMs && new Date(a.deadline).getTime() >= now
      ).length
    );
    setDueTomorrow(
      semesterAssignments.filter(
        (a) => a.status === "pending" && new Date(a.deadline).getTime() - now <= dayMs && new Date(a.deadline).getTime() >= now
      ).length
    );

    setPinned(subjects.filter((s) => s.isPinned));
    setLoading(false);
  }, [username]);

  useEffect(() => {
    load();
  }, [load]);

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const firstName = (user?.displayName || user?.username || "there").split(" ")[0];

  if (!loading && !semester) {
    return (
      <div>
        <TopBar crumbs={["Workspace", "Home"]} />
        <div className="px-8 pb-10">
          <div className="card p-10 text-center max-w-lg mx-auto mt-10">
            <Sparkles className="h-8 w-8 text-brand-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-ink dark:text-white mb-1">
              Let's set up your semester
            </h2>
            <p className="text-sm text-muted mb-5">
              Create a semester to start organizing subjects, lectures, and assignments.
            </p>
            <Link href="/semester" className="btn-primary">
              Create a semester
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <TopBar crumbs={["Workspace", "Home"]} />
      <div className="px-8 pb-14">
        <p className="text-xs font-bold tracking-wide text-brand-500 uppercase mb-1">
          {dateLabel}
        </p>
        <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
          <div>
            <h1 className="text-4xl font-extrabold text-ink dark:text-white flex items-center gap-2">
              Good {greeting()}, {firstName}
              <Sparkles className="h-7 w-7 text-amber-400" />
            </h1>
            <p className="text-muted mt-1.5">
              A clear desk for a clear mind. Here&apos;s what&apos;s moving in your semester.
            </p>
          </div>
          <button onClick={() => router.push("/subjects")} className="btn-primary">
            <Zap className="h-4 w-4" /> Quick capture
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<CalendarClock className="h-5 w-5" />}
            iconBg="bg-brand-100 text-brand-600"
            label="Today's classes"
            value={todayClasses.length}
            sub={todayClasses[0] ? `Next at ${minutesToClock(todayClasses[0].startMinutes)}` : "No classes today"}
          />
          <StatCard
            icon={<FileText className="h-5 w-5" />}
            iconBg="bg-amber-100 text-amber-600"
            label="Pending review"
            value={pendingReview}
            sub="Lectures need OCR"
          />
          <StatCard
            icon={<Star className="h-5 w-5" />}
            iconBg="bg-sky-100 text-sky-600"
            label="Revision stack"
            value={starredCount}
            sub="Starred lectures"
          />
          <StatCard
            icon={<ClipboardList className="h-5 w-5" />}
            iconBg="bg-rose-100 text-rose-600"
            label="Due this week"
            value={dueThisWeek}
            sub={dueTomorrow > 0 ? `${dueTomorrow} due tomorrow` : "Nothing due tomorrow"}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-ink dark:text-white">Today&apos;s classes</h2>
              <Link
                href="/semester"
                className="text-sm font-semibold text-brand-500 flex items-center gap-1 hover:underline"
              >
                View schedule <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            {todayClasses.length === 0 ? (
              <p className="text-sm text-muted py-8 text-center">
                No classes scheduled today. Enjoy the breathing room.
              </p>
            ) : (
              <div className="divide-y divide-line dark:divide-white/10">
                {todayClasses.map((c) => (
                  <Link
                    key={c.id}
                    href={`/subjects/${c.subjectId}`}
                    className="flex items-center gap-4 py-4 group"
                  >
                    <div className="w-16 shrink-0">
                      <p className="text-base font-bold" style={{ color: colorFor(c.subjectId) }}>
                        {minutesToClock(c.startMinutes)}
                      </p>
                      <p className="text-xs text-muted">
                        {c.startMinutes < 720 ? "AM" : "PM"}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0 border-l border-line dark:border-white/10 pl-4">
                      <p className="font-semibold text-ink dark:text-white truncate">
                        {c.subjectName}
                      </p>
                      <p className="text-sm text-muted truncate">
                        {sessionLabelOf(c.sessionType)}
                        {c.room ? ` · ${c.room}` : ""}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted group-hover:text-brand-500 transition" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl3 p-6 bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-soft flex flex-col">
            <div className="h-11 w-11 rounded-2xl bg-white/15 flex items-center justify-center mb-5">
              <Sparkles className="h-5 w-5" />
            </div>
            <p className="text-xs font-bold uppercase tracking-wide text-white/80 mb-2">
              Your focus today
            </p>
            <h3 className="text-2xl font-bold leading-snug mb-3">
              {pendingReview > 0
                ? "Review lectures waiting on you."
                : starredCount > 0
                ? "Revise your starred lectures."
                : "You're all caught up."}
            </h3>
            <p className="text-sm text-white/80 mb-4">
              {pendingReview > 0
                ? `${pendingReview} lecture${pendingReview === 1 ? "" : "s"} are waiting for a first review.`
                : starredCount > 0
                ? `${starredCount} lecture${starredCount === 1 ? "" : "s"} starred for revision.`
                : "Nothing urgent — a good time to get ahead."}
            </p>
            <Link
              href="/revision"
              className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-white hover:underline"
            >
              Open revision queue <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {pinned.length > 0 && (
          <div className="mt-6 card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Pin className="h-4 w-4 text-brand-500" />
              <h2 className="text-lg font-bold text-ink dark:text-white">Pinned subjects</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {pinned.map((s) => (
                <Link
                  key={s.id}
                  href={`/subjects/${s.id}`}
                  className="flex items-center gap-3 rounded-xl2 border border-line dark:border-white/10 px-4 py-3 hover:bg-canvas dark:hover:bg-white/5 transition"
                >
                  <div
                    className="h-9 w-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ background: colorFor(s.id) }}
                  >
                    {s.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="font-medium text-ink dark:text-white truncate">{s.name}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  iconBg,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: number;
  sub: string;
}) {
  return (
    <div className="card p-5">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-3 ${iconBg}`}>
        {icon}
      </div>
      <p className="text-sm text-muted mb-1">{label}</p>
      <p className="text-3xl font-extrabold text-ink dark:text-white">{value}</p>
      <p className="text-xs text-muted mt-1">{sub}</p>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function minutesToClock(m: number) {
  let h = Math.floor(m / 60);
  const mm = (m % 60).toString().padStart(2, "0");
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${mm}`;
}

function sessionLabelOf(s: string) {
  return s === "theory" ? "Theory" : s === "lab" ? "Lab" : "Tutorial";
}
