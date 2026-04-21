import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "red" | "amber" | "blue" | "neutral";

const TONE_STYLES: Record<
  Tone,
  { dot: string; accent: string }
> = {
  red:     { dot: "bg-red-500",     accent: "from-red-50 to-transparent" },
  amber:   { dot: "bg-amber-500",   accent: "from-amber-50 to-transparent" },
  blue:    { dot: "bg-blue-500",    accent: "from-blue-50 to-transparent" },
  neutral: { dot: "bg-neutral-400", accent: "from-neutral-50 to-transparent" },
};

export function StatCard({
  label,
  value,
  tone,
  href,
  hint,
}: {
  label: string;
  value: number;
  tone: Tone;
  href?: string;
  hint?: string;
}) {
  const styles = TONE_STYLES[tone];

  const inner = (
    <div className="relative rounded-xl border border-neutral-200/80 bg-white card-glow card-glow-hover p-4 overflow-hidden">
        {/* Subtle gradient wash to differentiate tone */}
        <div
          className={cn(
            "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-60",
            styles.accent,
          )}
          aria-hidden
        />
        <div className="relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  styles.dot,
                )}
                aria-hidden
              />
              <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                {label}
              </span>
            </div>
            {href && (
              <ArrowUpRight
                className="h-3.5 w-3.5 text-neutral-300 transition-all group-hover:text-neutral-600 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                aria-hidden
              />
            )}
          </div>
          <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums leading-none">
            {value}
          </div>
          {hint && (
            <p className="mt-1.5 text-[11px] text-neutral-500">{hint}</p>
          )}
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
  return <div className="block">{inner}</div>;
}
