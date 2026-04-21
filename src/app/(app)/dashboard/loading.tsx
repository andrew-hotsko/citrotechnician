import { StatCardSkeleton, Skeleton } from "@/components/skeletons";

export default function DashboardLoading() {
  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 animate-enter">
      <div className="space-y-2">
        <Skeleton className="h-2.5 w-32" />
        <Skeleton className="h-7 w-80" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-80 w-full rounded-xl" />
          <Skeleton className="h-52 w-full rounded-xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-60 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
