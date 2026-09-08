"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { useLocalUser } from "@/lib/local/useLocalUser";
import { Semesters, Subjects, Lectures } from "@/lib/local/repo";
import type { Lecture, Subject } from "@/lib/local/types";

export default function RevisionPage() {
  const username = useLocalUser();
  const [lectures, setLectures] = useState<(Lecture & { subjectName: string })[]>([]);
  const [thumbs, setThumbs] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    if (!username) return;
    const semester = await Semesters.activeOne(username);
    if (!semester) return;
    const subjects = await Subjects.forSemester(username, semester.id);
    const subjectMap = new Map(subjects.map((s) => [s.id, s]));
    const starred = await Lectures.starred(
      username,
      subjects.map((s) => s.id)
    );
    const withNames = starred.map((l) => ({ ...l, subjectName: subjectMap.get(l.subjectId)?.name ?? "" }));
    setLectures(withNames);

    const urls: Record<number, string> = {};
    for (const l of withNames) {
      if (l.imageRef) urls[l.id] = l.imageRef;
    }
    setThumbs(urls);
  }, [username]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <TopBar crumbs={["Workspace", "Revision"]} />
      <div className="px-8 pb-14">
        <h1 className="text-2xl font-bold text-ink dark:text-white mb-1">Revision stack</h1>
        <p className="text-sm text-muted mb-6">Every lecture you&apos;ve starred for revision, in one place.</p>

        {lectures.length === 0 ? (
          <div className="card p-10 text-center text-sm text-muted">
            No starred lectures yet. Star a lecture from its subject&apos;s Lectures tab to add it here.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {lectures.map((l) => (
              <Link key={l.id} href={`/subjects/${l.subjectId}`} className="card overflow-hidden relative">
                {thumbs[l.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbs[l.id]} alt={l.lectureCode} className="w-full h-28 object-cover" />
                ) : (
                  <div className="w-full h-28 bg-canvas dark:bg-[#101223]" />
                )}
                <Star className="absolute top-2 right-2 h-4 w-4 text-amber-400 fill-amber-400" />
                <div className="p-3">
                  <p className="text-xs font-semibold text-ink dark:text-white truncate">{l.lectureCode}</p>
                  <p className="text-[11px] text-muted truncate">{l.subjectName}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
