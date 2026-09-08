import { Sparkles, CalendarDays } from "lucide-react";

const SCHEDULE_ROWS = [
  { time: "09:00", subject: "Data Structures", meta: "Lab · Room 204", dot: "bg-brand-400" },
  { time: "11:00", subject: "Linear Algebra", meta: "Theory · Room 118", dot: "bg-amber-400" },
  { time: "14:00", subject: "Thermodynamics", meta: "Tutorial · Room 302", dot: "bg-emerald-400" },
];

export function AuthShowcase({
  eyebrow,
  headline,
  subcopy,
}: {
  eyebrow: string;
  headline: string;
  subcopy: string;
}) {
  return (
    <div
      className="relative hidden lg:flex lg:w-[46%] xl:w-[42%] flex-col justify-between overflow-hidden px-12 py-14 text-white"
      style={{
        background:
          "radial-gradient(circle at 18% 15%, #363a72 0%, #1c1e3a 45%, #101223 100%)",
      }}
    >
      {/* dotted "notebook grid" texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.25]"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.35) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />

      <div className="relative flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-2xl bg-white/10 flex items-center justify-center ring-1 ring-white/15">
          <Sparkles className="h-4 w-4 text-amber-300" />
        </div>
        <span className="font-display text-lg font-semibold tracking-tight">
          Class<span className="text-brand-300">Vault</span>
        </span>
      </div>

      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-300 mb-4">
          {eyebrow}
        </p>
        <h1 className="font-display text-4xl xl:text-[2.75rem] font-semibold leading-[1.08] tracking-tight text-balance mb-4">
          {headline}
        </h1>
        <p className="text-sm text-white/60 max-w-sm leading-relaxed">{subcopy}</p>
      </div>

      {/* signature element: a floating "today's schedule" card with an AI
          chat bubble peeking off the corner — the two things ClassVault
          actually does, shown rather than described. */}
      <div className="relative mt-10 mb-2">
        <div className="rounded-xl2 border border-white/10 bg-white/[0.06] backdrop-blur-xl p-5 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-white/70 text-xs font-semibold">
              <CalendarDays className="h-3.5 w-3.5" /> Monday &middot; Semester 4
            </div>
            <span className="text-[10px] text-white/40">Today</span>
          </div>
          <div className="space-y-3">
            {SCHEDULE_ROWS.map((row) => (
              <div key={row.subject} className="flex items-center gap-3">
                <span className={`h-2 w-2 rounded-full shrink-0 ${row.dot}`} />
                <span className="text-xs font-mono text-white/50 w-11 shrink-0">{row.time}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{row.subject}</p>
                  <p className="text-[11px] text-white/40 truncate">{row.meta}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute -right-4 -bottom-7 w-56 rounded-xl2 border border-white/10 bg-[#20223f]/90 backdrop-blur-xl p-3.5 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.7)] rotate-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles className="h-3 w-3 text-amber-300" />
            <span className="text-[11px] font-semibold text-white/80">ClassVault AI</span>
          </div>
          <p className="text-[11px] text-white/60 leading-snug">
            &ldquo;Summarize today&apos;s Data Structures lecture into 5 key points.&rdquo;
          </p>
        </div>
      </div>
    </div>
  );
}