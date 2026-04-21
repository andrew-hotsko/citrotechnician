import Link from "next/link";
import { format } from "date-fns";
import { Route, Plus } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  listNeedsAttention,
  listTechWorkload,
  listUpcomingWeek,
  listRecentActivity,
} from "@/lib/dashboard-query";
import { StatCard } from "./stat-card";
import { NeedsAttention } from "./needs-attention";
import { TechWorkload } from "./tech-workload";
import { UpcomingWeek } from "./upcoming-week";
import { RecentActivityFeed } from "./recent-activity";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const firstName = user?.name.split(" ")[0] ?? "there";

  const now = new Date();
  const in60 = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [overdue, dueSoon, scheduled, thisWeek, attention, workload, upcoming, activity] =
    await Promise.all([
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
      listNeedsAttention(6),
      listTechWorkload(),
      listUpcomingWeek(),
      listRecentActivity(8),
    ]);

  const canEdit =
    user?.role === "ADMIN" || user?.role === "OPS_MANAGER";

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 animate-enter">
      {/* Greeting + quick actions */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider font-medium text-neutral-500">
            {format(now, "EEEE, MMMM d")}
          </p>
          <h1 className="text-[22px] font-semibold tracking-tight mt-1.5">
            Good to see you, {firstName}.
          </h1>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Link
              href="/map?trip=1"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-neutral-200 bg-white text-[12px] font-medium text-neutral-700 transition-all hover:border-neutral-300 hover:bg-neutral-50 shadow-elev-1"
              title="Open the map with trip-select mode on"
            >
              <Route className="h-3.5 w-3.5" />
              Plan a trip
            </Link>
            <Link
              href="/jobs"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-neutral-900 text-white text-[12px] font-medium transition-all hover:bg-neutral-800 shadow-elev-1"
            >
              <Plus className="h-3.5 w-3.5" />
              New job
            </Link>
          </div>
        )}
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8 animate-enter-stagger">
        <StatCard
          label="Overdue"
          value={overdue}
          tone="red"
          href="/jobs?stage=UPCOMING,OUTREACH,CONFIRMED,SCHEDULED,IN_PROGRESS"
        />
        <StatCard
          label="Due in 60 days"
          value={dueSoon}
          tone="amber"
          href="/jobs"
        />
        <StatCard
          label="Scheduled"
          value={scheduled}
          tone="blue"
          href="/calendar"
        />
        <StatCard
          label="This week"
          value={thisWeek}
          tone="neutral"
          href="/calendar"
        />
      </div>

      {/* Widget grid */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4 animate-enter-stagger">
        <div className="lg:col-span-2 space-y-4">
          <NeedsAttention jobs={attention} />
          <UpcomingWeek buckets={upcoming} />
        </div>
        <div className="space-y-4">
          <TechWorkload techs={workload} />
          <RecentActivityFeed events={activity} />
        </div>
      </div>
    </div>
  );
}
