import Link from "next/link";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?:
    | { type: "link"; href: string; label: string }
    | { type: "button"; onClick: () => void; label: string };
  className?: string;
};

/**
 * Designed empty state with a subtly haloed icon, concise title, and optional
 * single primary action. Use inside cards, tables, or full-page shells.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center px-6 py-10",
        className,
      )}
    >
      <div className="relative mb-3">
        <div
          className="absolute inset-0 -inset-2 rounded-full blur-md opacity-50"
          style={{
            background:
              "radial-gradient(circle, oklch(0.9 0.08 60) 0%, transparent 70%)",
          }}
          aria-hidden
        />
        <div className="relative h-10 w-10 rounded-full bg-white border border-neutral-200 shadow-elev-1 grid place-items-center">
          <Icon className="h-4 w-4 text-neutral-500" />
        </div>
      </div>
      <h3 className="text-[13px] font-semibold tracking-tight text-neutral-800">
        {title}
      </h3>
      {description && (
        <p className="mt-1 max-w-xs text-[12px] text-neutral-500 leading-relaxed">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-4">
          {action.type === "link" ? (
            <Link
              href={action.href}
              className="inline-flex items-center h-8 px-3 rounded-md bg-neutral-900 text-white text-[12px] font-medium transition-colors hover:bg-neutral-800"
            >
              {action.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center h-8 px-3 rounded-md bg-neutral-900 text-white text-[12px] font-medium transition-colors hover:bg-neutral-800"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
