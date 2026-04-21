import Link from "next/link";
import { ArrowUpRight, Calendar as CalendarIcon } from "lucide-react";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
import type { UpcomingWeekJob } from "@/lib/dashboard-query";
import { cn } from "@/lib/utils";

export function UpcomingWeek({
  buckets,
}: {
  buckets: Record<number, UpcomingWeekJob[]>;
}) {
  const start = startOfDay(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const totalJobs = days.reduce((sum, _, i) => sum + (buckets[i]?.length ?? 0), 0);

  return (
    <section className="rounded-xl border border-neutral-200/80 bg-white card-glow overflow-hidden">
      <header className="flex items-baseline justify-between px-4 py-3 border-b border-neutral-100">
        <div>
          <h2 className="text-[13px] font-semibold tracking-tight">
            Next 7 days
          </h2>
          <p className="text-[10px] uppercase tracking-wider text-neutral-500 mt-0.5">
            {totalJobs} {totalJobs === 1 ? "job" : "jobs"} scheduled
          </p>
        </div>
        <Link
          href="/calendar"
          className="group inline-flex items-center gap-0.5 text-[11px] font-medium text-neutral-500 hover:text-neutral-900"
        >
          Calendar
          <ArrowUpRight className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
      </header>

      <div className="grid grid-cols-7 divide-x divide-neutral-100 border-b border-neutral-100">
        {days.map((date, i) => {
          const isToday = isSameDay(date, new Date());
          return (
            <div
              key={i}
              className={cn(
                "px-2 py-2 text-center",
                isToday && "bg-orange-50/60",
              )}
            >
              <div className="text-[9px] uppercase tracking-wider text-neutral-500 font-medium">
                {format(date, "EEE")}
              </div>
              <div
                className={cn(
                  "text-[13px] tabular-nums mt-0.5",
                  isToday ? "font-semibold text-orange-700" : "text-neutral-700",
                )}
              >
                {format(date, "d")}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-7 divide-x divide-neutral-100 min-h-[72px]">
        {days.map((_, i) => {
          const jobs = buckets[i] ?? [];
          if (jobs.length === 0) {
            return (
              <div
                key={i}
                className="px-1.5 py-1.5 text-center text-[10px] text-neutral-300"
              >
                —
              </div>
            );
          }
          return (
            <div key={i} className="px-1.5 py-1.5 space-y-0.5">
              {jobs.slice(0, 3).map((j) => (
                <Link
                  key={j.id}
                  href={`/jobs/${j.id}`}
                  className="block rounded text-[10px] font-medium truncate px-1 py-0.5 text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: j.assignedTech?.color ?? "#525252" }}
                  title={`${j.property.name} · ${j.assignedTech?.name ?? "Unassigned"}`}
                >
                  {j.property.name}
                </Link>
              ))}
              {jobs.length > 3 && (
                <div className="text-[9px] text-neutral-500 text-center">
                  +{jobs.length - 3} more
                </div>
              )}
            </div>
          );
        })}
      </div>

      {totalJobs === 0 && (
        <div className="px-4 py-6 text-center">
          <CalendarIcon className="h-4 w-4 text-neutral-400 mx-auto mb-2" />
          <p className="text-[12px] text-neutral-500">
            No scheduled jobs this week
          </p>
        </div>
      )}
    </section>
  );
}
