import Link from "next/link";
import { Mail, Phone, SearchX } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { formatDate } from "@/lib/job-helpers";

type Search = Promise<{ q?: string }>;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "TECH") redirect("/tech");

  const params = await searchParams;
  const q = params.q?.trim();

  const customers = await prisma.customer.findMany({
    where: {
      deletedAt: null,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      properties: {
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          city: true,
          jobs: {
            where: { deletedAt: null },
            select: {
              id: true,
              stage: true,
              dueDate: true,
              completedAt: true,
            },
          },
        },
        orderBy: { name: "asc" },
      },
    },
    orderBy: [{ name: "asc" }],
  });

  // Derive per-customer rollups for the table.
  const rows = customers.map((c) => {
    const allJobs = c.properties.flatMap((p) => p.jobs);
    const activeJobs = allJobs.filter(
      (j) => j.stage !== "COMPLETED" && j.stage !== "DEFERRED",
    );
    const completedJobs = allJobs.filter((j) => j.stage === "COMPLETED");
    const nextDue = activeJobs
      .map((j) => j.dueDate)
      .sort((a, b) => a.getTime() - b.getTime())[0];
    const lastCompletedAt = completedJobs
      .map((j) => j.completedAt)
      .filter((d): d is Date => !!d)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    return {
      customer: c,
      propertyCount: c.properties.length,
      activeCount: activeJobs.length,
      completedCount: completedJobs.length,
      nextDue: nextDue ?? null,
      lastCompletedAt: lastCompletedAt ?? null,
    };
  });

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 animate-enter">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Customers</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {customers.length} {customers.length === 1 ? "customer" : "customers"}
            {q ? ` matching \u201c${q}\u201d` : ""}
          </p>
        </div>
      </div>

      <form className="mb-4">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search customer, email, or phone\u2026"
          className="w-full max-w-md h-8 px-3 text-[13px] rounded-md border border-neutral-200 bg-white placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400 focus:border-neutral-400"
        />
      </form>

      {customers.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
          <EmptyState
            icon={SearchX}
            title="No customers match"
            description="Try clearing the search, or add a job to create a new customer."
            action={
              q
                ? { type: "link", href: "/customers", label: "Clear search" }
                : undefined
            }
          />
        </div>
      ) : (
        <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr className="text-[10px] uppercase tracking-wider text-neutral-500">
                <th className="text-left font-medium px-3 py-2">Customer</th>
                <th className="text-left font-medium px-3 py-2 w-56">Contact</th>
                <th className="text-right font-medium px-3 py-2 w-24">Properties</th>
                <th className="text-right font-medium px-3 py-2 w-24">Active</th>
                <th className="text-right font-medium px-3 py-2 w-24">Completed</th>
                <th className="text-left font-medium px-3 py-2 w-36">Next due</th>
                <th className="text-left font-medium px-3 py-2 w-36">Last service</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(
                ({
                  customer: c,
                  propertyCount,
                  activeCount,
                  completedCount,
                  nextDue,
                  lastCompletedAt,
                }) => (
                  <tr
                    key={c.id}
                    className="border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50 transition-colors"
                  >
                    <td className="px-3 py-2.5 min-w-0">
                      <Link
                        href={`/jobs?q=${encodeURIComponent(c.name)}`}
                        className="font-medium text-neutral-900 hover:underline truncate block"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 min-w-0">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        {c.phone ? (
                          <a
                            href={`tel:${c.phone.replace(/[^+\d]/g, "")}`}
                            className="inline-flex items-center gap-1 text-[12px] text-neutral-700 hover:text-neutral-900 truncate"
                          >
                            <Phone className="h-3 w-3 shrink-0" />
                            <span className="truncate">{c.phone}</span>
                          </a>
                        ) : null}
                        {c.email ? (
                          <a
                            href={`mailto:${c.email}`}
                            className="inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-700 truncate"
                          >
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">{c.email}</span>
                          </a>
                        ) : null}
                        {!c.phone && !c.email && (
                          <span className="text-[11px] text-neutral-400">\u2014</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-neutral-700">
                      {propertyCount}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-neutral-700">
                      {activeCount}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-neutral-500">
                      {completedCount}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-neutral-700 tabular-nums">
                      {nextDue ? formatDate(nextDue) : "\u2014"}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-neutral-600 tabular-nums">
                      {lastCompletedAt ? formatDate(lastCompletedAt) : "\u2014"}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
