import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ChevronLeft,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  RefreshCcw,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { readConfig } from "@/lib/salesforce/client";
import { SyncNowButton } from "./sync-now-button";
import { cn } from "@/lib/utils";

export default async function SalesforceSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN" && user.role !== "OPS_MANAGER") {
    redirect("/settings");
  }

  const status = readConfig();

  const recent = await prisma.salesforceSync.findMany({
    orderBy: { startedAt: "desc" },
    take: 10,
    include: {
      triggeredByUser: { select: { id: true, name: true, initials: true } },
    },
  });

  return (
    <div className="max-w-[900px] mx-auto px-6 py-6 animate-enter">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-[12px] text-neutral-500 hover:text-neutral-900"
      >
        <ChevronLeft className="h-3 w-3" />
        Settings
      </Link>

      <div className="mt-3 flex items-start justify-between gap-6">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight">
            Salesforce sync
          </h1>
          <p className="text-[13px] text-neutral-500 mt-1 leading-relaxed max-w-xl">
            One-way nightly pull of Closed-Won opportunities from Salesforce
            into CitroTech. Customers / properties / jobs are created or
            updated by their Salesforce IDs, so re-running a sync never
            duplicates. No data flows the other direction.
          </p>
        </div>
        {status.configured && <SyncNowButton />}
      </div>

      {/* ---- Connection status ------------------------------------------- */}
      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-[14px] font-semibold tracking-tight mb-2">
          Connection
        </h2>
        {status.configured ? (
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
            <div className="text-[13px] text-neutral-700">
              Configured for{" "}
              <span className="font-mono text-neutral-900">
                {status.config.username}
              </span>{" "}
              at{" "}
              <span className="font-mono text-neutral-500">
                {status.config.loginUrl}
              </span>
              <p className="text-[11px] text-neutral-500 mt-1">
                Credentials come from environment variables. Rotate in
                Vercel \u2192 Project Settings \u2192 Environment Variables.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-[13px] text-neutral-700">
              <p>Not configured. Set these environment variables on Vercel:</p>
              <ul className="mt-2 space-y-1 font-mono text-[11px] text-neutral-600">
                {status.missing.map((key) => (
                  <li key={key}>
                    <span className="inline-block px-1.5 py-0.5 bg-neutral-100 rounded">
                      {key}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-neutral-500 mt-3 max-w-lg">
                The security token comes from Salesforce \u2192 Your avatar
                \u2192 Settings \u2192 Reset My Security Token. It arrives by
                email. After setting the vars, redeploy (any commit on main,
                or Vercel \u2192 Deployments \u2192 Redeploy) and refresh this page.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ---- Defaults panel ---------------------------------------------- */}
      <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-[14px] font-semibold tracking-tight mb-2">
          What the sync does
        </h2>
        <ul className="text-[13px] text-neutral-700 space-y-1.5 list-disc pl-5">
          <li>
            Pulls every <strong>Closed Won</strong> Opportunity closed in the
            last 24 hours, with its Account.
          </li>
          <li>
            Upserts a <strong>Customer</strong> keyed by <code>Account.Id</code>{" "}
            (name + phone).
          </li>
          <li>
            Creates a <strong>Property</strong> from the Account&apos;s billing
            address (geocoded for the map).
          </li>
          <li>
            Creates a CitroTech <strong>Job</strong> at{" "}
            <strong>Install / Year 0</strong> (new 2-year maintenance
            agreement), dueDate = Opportunity close date + 12 months.
          </li>
          <li>
            Schedules T-90 / T-60 / T-30 / overdue reminders for the new job,
            same as manual entry.
          </li>
          <li>
            Skips any Opportunity already imported (dedup by
            <code> Opportunity.Id </code>).
          </li>
        </ul>
        <p className="text-[12px] text-neutral-500 mt-3 leading-relaxed">
          Customize the SOQL query via the{" "}
          <code className="font-mono bg-neutral-100 px-1 rounded">
            SALESFORCE_SOQL_QUERY
          </code>{" "}
          environment variable if your SF schema has custom fields or a
          different product field mapping.
        </p>
      </div>

      {/* ---- Recent syncs ------------------------------------------------ */}
      <div className="mt-4 rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-neutral-200">
          <h2 className="text-[14px] font-semibold tracking-tight">
            Recent syncs
          </h2>
        </div>
        {recent.length === 0 ? (
          <div className="px-5 py-8 text-center text-[13px] text-neutral-500">
            No syncs yet. {status.configured ? "Run one above." : "Connect Salesforce above to get started."}
          </div>
        ) : (
          <table className="w-full text-[12px]">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr className="text-[10px] uppercase tracking-wider text-neutral-500">
                <th className="text-left font-medium px-4 py-2 w-28">When</th>
                <th className="text-left font-medium px-4 py-2 w-20">Trigger</th>
                <th className="text-left font-medium px-4 py-2 w-24">Status</th>
                <th className="text-right font-medium px-4 py-2 w-20">Opps</th>
                <th className="text-right font-medium px-4 py-2 w-20">Jobs</th>
                <th className="text-right font-medium px-4 py-2 w-20">New cust</th>
                <th className="text-right font-medium px-4 py-2 w-20">Errors</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((s) => (
                <tr key={s.id} className="border-b border-neutral-100 last:border-b-0">
                  <td className="px-4 py-2.5 text-neutral-700">
                    {formatDistanceToNow(new Date(s.startedAt), {
                      addSuffix: true,
                    })}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-600">
                    <span className="inline-flex items-center gap-1 text-[11px]">
                      {s.triggeredBy === "CRON" ? (
                        <Clock className="h-3 w-3" />
                      ) : (
                        <RefreshCcw className="h-3 w-3" />
                      )}
                      {s.triggeredBy === "CRON" ? "Cron" : "Manual"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusPill status={s.status} />
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-neutral-700">
                    {s.opportunitiesSeen}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-neutral-700">
                    {s.jobsCreated}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-neutral-500">
                    {s.customersCreated}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-2.5 text-right tabular-nums",
                      s.errorCount > 0
                        ? "text-red-600 font-medium"
                        : "text-neutral-400",
                    )}
                  >
                    {s.errorCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "SUCCESS") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-900 ring-1 ring-inset ring-emerald-200/60 px-2 h-[20px] text-[10px] font-semibold">
        <CheckCircle2 className="h-2.5 w-2.5" />
        Success
      </span>
    );
  }
  if (status === "PARTIAL") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-200/60 px-2 h-[20px] text-[10px] font-semibold">
        <AlertCircle className="h-2.5 w-2.5" />
        Partial
      </span>
    );
  }
  if (status === "RUNNING") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-900 ring-1 ring-inset ring-blue-200/60 px-2 h-[20px] text-[10px] font-semibold">
        <Clock className="h-2.5 w-2.5" />
        Running
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-900 ring-1 ring-inset ring-red-200/60 px-2 h-[20px] text-[10px] font-semibold">
      <XCircle className="h-2.5 w-2.5" />
      Failed
    </span>
  );
}
