import { Skeleton, TableRowSkeleton } from "@/components/skeletons";

export default function JobsLoading() {
  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 animate-enter">
      <div className="flex items-baseline justify-between mb-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>
      <Skeleton className="h-8 w-full max-w-md mb-3" />
      <div className="flex gap-1.5 mb-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-20 rounded-md" />
        ))}
      </div>
      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        {Array.from({ length: 10 }).map((_, i) => (
          <TableRowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
