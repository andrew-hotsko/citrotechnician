import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const firstName = user?.name.split(" ")[0] ?? "there";

  // Placeholder stats — real implementation arrives in Phase 4.
  const now = new Date();
  const in60 = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [overdue, dueSoon, scheduled, thisWeek] = await Promise.all([
    prisma.job.count({
      where: {
        deletedAt: null,
        dueDate: { lt: now },
        stage: { notIn: ["COMPLETED", "DEFERRED"] },
      },
    }),
    prisma.job.count({
      where: {
        deletedAt: null,
        dueDate: { gte: now, lte: in60 },
        stage: { notIn: ["COMPLETED", "DEFERRED"] },
      },
    }),
    prisma.job.count({
      where: { deletedAt: null, stage: "SCHEDULED" },
    }),
    prisma.job.count({
      where: {
        deletedAt: null,
        scheduledDate: { gte: now, lte: in7 },
      },
    }),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <h1 className="text-xl font-semibold tracking-tight">
        Good to see you, {firstName}.
      </h1>
      <p className="text-sm text-neutral-500 mt-0.5">
        Here&apos;s what&apos;s happening across your pipeline.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Overdue" value={overdue} tone="red" />
        <StatCard label="Due in 60 days" value={dueSoon} tone="amber" />
        <StatCard label="Scheduled" value={scheduled} tone="blue" />
        <StatCard label="This week" value={thisWeek} tone="neutral" />
      </div>

      <div className="mt-10 rounded-lg border border-dashed border-neutral-300 bg-white p-10 text-center">
        <p className="text-sm text-neutral-600">
          Full dashboard widgets — needs-attention list, tech workload,
          California mini-map — ship in Phase 4.
        </p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "red" | "amber" | "blue" | "neutral";
}) {
  const toneStyles = {
    red: "bg-red-500",
    amber: "bg-amber-500",
    blue: "bg-blue-500",
    neutral: "bg-neutral-400",
  } as const;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-center gap-1.5">
        <span
          className={`h-1.5 w-1.5 rounded-full ${toneStyles[tone]}`}
          aria-hidden
        />
        <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
          {label}
        </span>
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </div>
    </div>
  );
}
