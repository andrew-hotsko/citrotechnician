import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import type { RecentActivity } from "@/lib/dashboard-query";

export function RecentActivityFeed({ events }: { events: RecentActivity[] }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
      <header className="px-4 py-3 border-b border-neutral-100">
        <h2 className="text-[13px] font-semibold tracking-tight">
          Recent activity
        </h2>
      </header>

      {events.length === 0 ? (
        <p className="px-4 py-8 text-[12px] text-neutral-500 text-center">
          No activity yet.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {events.map((e) => (
            <li key={e.id} className="px-4 py-2.5">
              <p className="text-[12px] text-neutral-700 leading-snug">
                <span className="font-medium">
                  {e.user?.name?.split(" ")[0] ?? "System"}
                </span>{" "}
                <span className="text-neutral-500">{e.description}</span>
              </p>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                {e.job && (
                  <Link
                    href={`/jobs/${e.job.id}`}
                    className="font-mono hover:text-neutral-700 transition-colors"
                  >
                    {e.job.jobNumber}
                  </Link>
                )}
                {e.job && <span className="mx-1.5 text-neutral-300">·</span>}
                {formatDistanceToNow(new Date(e.createdAt), {
                  addSuffix: true,
                })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
