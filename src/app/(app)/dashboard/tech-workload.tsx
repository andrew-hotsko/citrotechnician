import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { TechWorkload as Workload } from "@/lib/dashboard-query";
import { TechAvatar } from "@/components/tech-avatar";
import { cn } from "@/lib/utils";

export function TechWorkload({ techs }: { techs: Workload[] }) {
  return (
    <section className="rounded-xl border border-neutral-200/80 bg-white card-glow overflow-hidden">
      <header className="flex items-baseline justify-between px-4 py-3 border-b border-neutral-100">
        <div>
          <h2 className="text-[13px] font-semibold tracking-tight">
            Tech workload
          </h2>
          <p className="text-[10px] uppercase tracking-wider text-neutral-500 mt-0.5">
            Next 14 days
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

      <ul className="divide-y divide-neutral-100">
        {techs.map((t) => (
          <li key={t.id} className="px-4 py-3">
            <div className="flex items-center gap-2.5 mb-2">
              <TechAvatar tech={t} size="md" />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium tracking-tight truncate">
                  {t.name}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[14px] font-semibold tabular-nums">
                  {t.scheduledCount}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-neutral-500">
                  jobs
                </div>
              </div>
            </div>
            <LoadBar value={t.utilization} color={t.color ?? "#525252"} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function LoadBar({ value, color }: { value: number; color: string }) {
  const pct = Math.round(value * 100);
  const tone =
    value >= 0.9
      ? "Heavy load"
      : value >= 0.5
        ? "On pace"
        : value > 0
          ? "Light"
          : "Open";
  return (
    <div>
      <div className="h-1.5 w-full rounded-full bg-neutral-100 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500 ease-standard",
          )}
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <div className="flex items-center justify-between mt-1 text-[10px] text-neutral-500">
        <span>{tone}</span>
        <span className="tabular-nums">{pct}%</span>
      </div>
    </div>
  );
}
