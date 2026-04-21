import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import type { RecentActivity } from "@/lib/dashboard-query";
import { TechAvatar } from "@/components/tech-avatar";

export function RecentActivityFeed({ events }: { events: RecentActivity[] }) {
  return (
    <section className="rounded-xl border border-neutral-200/80 bg-white card-glow overflow-hidden">
      <header className="px-4 py-3 border-b border-neutral-100">
        <h2 className="text-[13px] font-semibold tracking-tight">
          Recent activity
        </h2>
      </header>

      {events.length === 0 ? (
        <p className="px-4 py-8 text-[12px] text-neutral-500 text-center">
          No activity yet. Start a job to populate.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {events.map((e) => (
            <li key={e.id} className="flex items-start gap-2.5 px-4 py-2.5">
              <TechAvatar tech={e.user} size="sm" className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] text-neutral-700 leading-snug">
                  <span className="font-medium">
                    {e.user?.name ?? "System"}
                  </span>{" "}
                  {e.description.toLowerCase()}
                  {e.job && (
                    <>
                      {" · "}
                      <Link
                        href={`/jobs/${e.job.id}`}
                        className="font-mono text-[11px] text-neutral-500 hover:text-neutral-900"
                      >
                        {e.job.jobNumber}
                      </Link>
                    </>
                  )}
                </p>
                <p className="text-[10px] text-neutral-400 mt-0.5">
                  {formatDistanceToNow(new Date(e.createdAt), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
