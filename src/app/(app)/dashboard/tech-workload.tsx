import Link from "next/link";
import type { TechWorkload as Workload } from "@/lib/dashboard-query";
import { TechAvatar } from "@/components/tech-avatar";

export function TechWorkload({ techs }: { techs: Workload[] }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
      <header className="flex items-baseline justify-between px-4 py-3 border-b border-neutral-100">
        <h2 className="text-[13px] font-semibold tracking-tight">
          Tech workload
        </h2>
        <Link
          href="/calendar"
          className="text-[11px] font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          Calendar
        </Link>
      </header>

      <ul className="divide-y divide-neutral-100">
        {techs.map((t) => (
          <li key={t.id} className="px-4 py-3">
            <div className="flex items-center gap-3 mb-2">
              <TechAvatar tech={t} size="md" />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium tracking-tight truncate">
                  {t.name}
                </div>
              </div>
              <div className="text-[13px] font-semibold tabular-nums shrink-0">
                {t.scheduledCount}
                <span className="ml-1 text-[11px] font-normal text-neutral-500">
                  /14d
                </span>
              </div>
            </div>
            <div className="h-1 w-full rounded-full bg-neutral-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-standard"
                style={{
                  width: `${Math.round(t.utilization * 100)}%`,
                  backgroundColor: t.color ?? "#525252",
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
