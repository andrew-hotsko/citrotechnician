import { cn } from "@/lib/utils";

/** Base shimmer — use inside any layout to imply loading. */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn(
        "animate-pulse rounded bg-neutral-200/60",
        className,
      )}
      style={style}
      aria-hidden
    />
  );
}

/** Table-row skeleton for the jobs list. */
export function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-3 border-b border-neutral-100 last:border-b-0">
      <Skeleton className="h-3 w-16" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-5 w-20 rounded-md" />
      <Skeleton className="h-5 w-14 rounded-md" />
      <Skeleton className="h-5 w-16 rounded-md" />
      <Skeleton className="h-5 w-5 rounded-full" />
      <Skeleton className="h-5 w-20" />
    </div>
  );
}

/** Kanban card skeleton. */
export function KanbanCardSkeleton() {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-2.5 space-y-2 shadow-elev-1">
      <div className="flex items-center justify-between">
        <Skeleton className="h-2.5 w-10" />
        <Skeleton className="h-3 w-14 rounded-md" />
      </div>
      <Skeleton className="h-3.5 w-32" />
      <Skeleton className="h-2.5 w-20" />
      <div className="flex items-center justify-between pt-1">
        <Skeleton className="h-3 w-14 rounded-md" />
        <Skeleton className="h-4 w-4 rounded-full" />
      </div>
    </div>
  );
}

/** Stat card skeleton for the dashboard. */
export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center gap-1.5 mb-3">
        <Skeleton className="h-1.5 w-1.5 rounded-full" />
        <Skeleton className="h-2.5 w-16" />
      </div>
      <Skeleton className="h-8 w-12" />
      <Skeleton className="h-2.5 w-28 mt-2" />
    </div>
  );
}
