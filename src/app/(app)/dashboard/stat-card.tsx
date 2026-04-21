import Link from "next/link";
import { cn } from "@/lib/utils";

type Tone = "red" | "amber" | "blue" | "neutral";

const DOT: Record<Tone, string> = {
  red:     "bg-red-500",
  amber:   "bg-amber-500",
  blue:    "bg-blue-500",
  neutral: "bg-neutral-400",
};

export function StatCard({
  label,
  value,
  tone,
  href,
}: {
  label: string;
  value: number;
  tone: Tone;
  href?: string;
}) {
  const inner = (
    <div
      className={cn(
        "rounded-xl border border-neutral-200 bg-white p-4 transition-shadow duration-150 ease-standard",
        href && "group-hover:shadow-elev-1",
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className={cn("h-1.5 w-1.5 rounded-full", DOT[tone])} aria-hidden />
        <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
          {label}
        </span>
      </div>
      <div className="mt-3 text-[28px] font-semibold tracking-tight tabular-nums leading-none">
        {value}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="group block">
        {inner}
      </Link>
    );
  }
  return <div>{inner}</div>;
}
