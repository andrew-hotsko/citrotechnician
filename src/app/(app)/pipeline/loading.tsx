import { KanbanCardSkeleton, Skeleton } from "@/components/skeletons";

const STAGES = ["UPCOMING", "OUTREACH", "CONFIRMED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "DEFERRED"];

export default function PipelineLoading() {
  return (
    <div className="px-6 py-6 max-w-full animate-enter">
      <div className="space-y-2 mb-4">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-3 w-64" />
      </div>
      <div className="flex gap-3 overflow-x-auto">
        {STAGES.map((s) => (
          <div
            key={s}
            className="w-72 shrink-0 rounded-lg bg-neutral-100/60 p-2 space-y-1.5"
          >
            <div className="flex items-center justify-between px-1 py-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-6 rounded" />
            </div>
            <KanbanCardSkeleton />
            <KanbanCardSkeleton />
          </div>
        ))}
      </div>
    </div>
  );
}
