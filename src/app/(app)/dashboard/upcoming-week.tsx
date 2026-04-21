import Link from "next/link";
import { Calendar as CalendarIcon } from "lucide-react";
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
  const totalJobs = days.reduce(
    (sum, _, i) => sum + (buckets[i]?.length ?? 0),
    0,
  );

  return (
    <section className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
      <header className="flex items-baseline justify-between px-4 py-3 border-b border-neutral-100">
        <h2 className="text-[13px] font-semibold tracking-tight">
          Next 7 days
        </h2>
        <Link
          href="/calendar"
          className="text-[11px] font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          Calendar
        </Link>
      </header>

      <div className="grid grid-cols-7 divide-x divide-neutral-100 border-b border-neutral-100">
        {days.map((date, i) => {
          const isToday = isSameDay(date, new Date());
          return (
            <div key={i} className="px-2 py-2 text-center">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
                {format(date, "EEE")}
              </div>
              <div
                className={cn(
                  "text-[13px] tabular-nums mt-0.5",
                  isToday
                    ? "font-semibold text-neutral-900"
                    : "text-neutral-700",
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
                className="px-2 py-2 text-center text-[10px] text-neutral-300"
              >
                —
              </div>
            );
          }
          return (
            <div key={i} className="px-2 py-2 space-y-1">
              {jobs.slice(0, 3).map((j) => (
                <Link
                  key={j.id}
                  href={`/jobs/${j.id}`}
                  className="flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-medium truncate transition-colors hover:bg-neutral-50"
                  title={`${j.property.name} · ${j.assignedTech?.name ?? "Unassigned"}`}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: j.assignedTech?.color ?? "#a3a3a3",
                    }}
                    aria-hidden
                  />
                  <span className="truncate text-neutral-700">
                    {j.property.name}
                  </span>
                </Link>
              ))}
              {jobs.length > 3 && (
                <div className="text-[10px] text-neutral-400 text-center">
                  +{jobs.length - 3}
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
