import Link from "next/link";
import { MapPin, SearchX } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { RegionBadge, CycleBadge, StageBadge } from "@/components/badges";
import { EmptyState } from "@/components/empty-state";
import { formatDate, formatDueIn, urgencyFor, URGENCY_TONE } from "@/lib/job-helpers";
import { cn } from "@/lib/utils";

type Search = Promise<{ q?: string }>;

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "TECH") redirect("/tech");

  const params = await searchParams;
  const q = params.q?.trim();

  // One query: every property that isn't soft-deleted, with its
  // customer, a next-due job (non-terminal + earliest dueDate), and
  // counts of completed / total jobs for the service-history column.
  const properties = await prisma.property.findMany({
    where: {
      deletedAt: null,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { address: { contains: q, mode: "insensitive" } },
              { city: { contains: q, mode: "insensitive" } },
              { customer: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: {
      customer: { select: { id: true, name: true } },
      jobs: {
        where: { deletedAt: null },
        select: {
          id: true,
          jobNumber: true,
          stage: true,
          dueDate: true,
          cycleIndex: true,
          cyclesPlanned: true,
          type: true,
          completedAt: true,
        },
        orderBy: { dueDate: "asc" },
      },
    },
    orderBy: [{ name: "asc" }],
  });

  const rows = properties.map((p) => {
    const active = p.jobs.find(
      (j) => j.stage !== "COMPLETED" && j.stage !== "DEFERRED",
    );
    const completedCount = p.jobs.filter((j) => j.stage === "COMPLETED").length;
    const latestCompleted = p.jobs
      .filter((j) => j.stage === "COMPLETED" && j.completedAt)
      .sort(
        (a, b) =>
          (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0),
      )[0];
    return { property: p, active, completedCount, latestCompleted };
  });

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 animate-enter">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Properties</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {properties.length} {properties.length === 1 ? "property" : "properties"}
            {q ? ` matching “${q}”` : ""}
          </p>
        </div>
      </div>

      <form className="mb-4">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search property, address, city, or customer…"
          className="w-full max-w-md h-8 px-3 text-[13px] rounded-md border border-neutral-200 bg-white placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400 focus:border-neutral-400"
        />
      </form>

      {properties.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
          <EmptyState
            icon={SearchX}
            title="No properties match"
            description="Try clearing the search, or add a job to create a new property."
            action={
              q
                ? { type: "link", href: "/properties", label: "Clear search" }
                : undefined
            }
          />
        </div>
      ) : (
        <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr className="text-[10px] uppercase tracking-wider text-neutral-500">
                <th className="text-left font-medium px-3 py-2">Property</th>
                <th className="text-left font-medium px-3 py-2 w-40">Customer</th>
                <th className="text-left font-medium px-3 py-2 w-20">Region</th>
                <th className="text-left font-medium px-3 py-2 w-28">Active cycle</th>
                <th className="text-left font-medium px-3 py-2 w-32">Active stage</th>
                <th className="text-left font-medium px-3 py-2 w-36">Next due</th>
                <th className="text-left font-medium px-3 py-2 w-28">History</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ property, active, completedCount, latestCompleted }) => {
                const urgency = active ? urgencyFor(active.dueDate) : "none";
                return (
                  <tr
                    key={property.id}
                    className="border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50 transition-colors"
                  >
                    <td className="px-3 py-2.5 min-w-0">
                      <Link
                        href={active ? `/jobs/${active.id}` : `/jobs?q=${encodeURIComponent(property.name)}`}
                        className="flex flex-col min-w-0 hover:text-neutral-900"
                      >
                        <span className="font-medium text-neutral-900 truncate">
                          {property.name}
                        </span>
                        <span className="text-[11px] text-neutral-500 truncate inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {property.address}, {property.city}
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 truncate">
                      <Link
                        href={`/customers?q=${encodeURIComponent(property.customer.name)}`}
                        className="text-neutral-700 hover:text-neutral-900 hover:underline truncate block"
                      >
                        {property.customer.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">
                      <RegionBadge region={property.region} />
                    </td>
                    <td className="px-3 py-2.5">
                      {active ? (
                        <CycleBadge
                          cycleIndex={active.cycleIndex}
                          cyclesPlanned={active.cyclesPlanned}
                          type={active.type}
                          size="sm"
                        />
                      ) : (
                        <span className="text-[11px] text-neutral-400">
                          No active cycle
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {active ? (
                        <StageBadge stage={active.stage} />
                      ) : (
                        <span className="text-[11px] text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {active ? (
                        <div className="flex flex-col">
                          <span
                            className={cn(
                              "inline-flex w-fit rounded px-1 py-0.5 text-[11px] font-medium",
                              URGENCY_TONE[urgency],
                            )}
                          >
                            {formatDueIn(active.dueDate)}
                          </span>
                          <span className="text-[10px] text-neutral-400 mt-0.5">
                            {formatDate(active.dueDate)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-neutral-600">
                      {completedCount > 0 ? (
                        <span>
                          <span className="tabular-nums font-medium text-neutral-900">
                            {completedCount}
                          </span>{" "}
                          completed
                          {latestCompleted?.completedAt ? (
                            <span className="block text-[10px] text-neutral-400">
                              last: {formatDate(latestCompleted.completedAt)}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-neutral-400">No history</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
