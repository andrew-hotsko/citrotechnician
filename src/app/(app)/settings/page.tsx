import Link from "next/link";
import { Upload, Users, ListChecks, RefreshCw, ChevronRight, Zap } from "lucide-react";
import { RunRemindersButton } from "./run-reminders-button";

type SettingLink = {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  status?: "available" | "coming soon";
};

const LINKS: SettingLink[] = [
  {
    href: "/settings/import",
    icon: Upload,
    title: "Import from CSV",
    description:
      "Bulk-load existing maintenance jobs. Upload a CSV with customer, property, product, sqft, and last-service date.",
    status: "available",
  },
  {
    href: "/settings/templates",
    icon: ListChecks,
    title: "Checklist templates",
    description:
      "Edit the per-product checklist every tech sees when they open a job. MFB-31 / MFB-34 / MFB-35-FM.",
    status: "available",
  },
  {
    href: "/settings/team",
    icon: Users,
    title: "Team",
    description:
      "Promote users to admin / ops manager / tech. Toggle active status and edit tech avatar colors.",
    status: "available",
  },
  {
    href: "/settings/salesforce",
    icon: RefreshCw,
    title: "Salesforce sync",
    description:
      "Nightly one-way pull of Closed Won opportunities. Connection status, manual sync, and history.",
    status: "available",
  },
];

export default function SettingsPage() {
  return (
    <div className="max-w-[900px] mx-auto px-6 py-6 animate-enter">
      <h1 className="text-[18px] font-semibold tracking-tight">Settings</h1>
      <p className="text-[13px] text-neutral-500 mt-1">
        Team, templates, integrations.
      </p>

      <ul className="mt-6 space-y-2">
        {LINKS.map((l) => {
          const isAvailable = l.status === "available";
          const Icon = l.icon;
          const Row = (
            <div className="flex items-start gap-4 rounded-xl border border-neutral-200 bg-white px-5 py-4 transition-shadow duration-150 ease-standard hover:shadow-elev-1">
              <div className="h-8 w-8 rounded-md bg-neutral-100 grid place-items-center shrink-0">
                <Icon className="h-4 w-4 text-neutral-600" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-[14px] font-semibold tracking-tight">
                    {l.title}
                  </h2>
                  {!isAvailable && (
                    <span className="text-[10px] uppercase tracking-wider font-medium text-neutral-400">
                      Soon
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-neutral-500 mt-1 leading-relaxed">
                  {l.description}
                </p>
              </div>
              {isAvailable && (
                <ChevronRight className="h-4 w-4 text-neutral-300 mt-1 shrink-0" />
              )}
            </div>
          );
          return (
            <li key={l.title}>
              {isAvailable ? (
                <Link href={l.href} className="block">
                  {Row}
                </Link>
              ) : (
                <div className="opacity-60 cursor-not-allowed">{Row}</div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Admin utilities */}
      <div className="mt-8">
        <h2 className="text-[11px] uppercase tracking-wider text-neutral-500 font-medium">
          Admin utilities
        </h2>
        <div className="mt-2 flex items-start gap-4 rounded-xl border border-neutral-200 bg-white px-5 py-4">
          <div className="h-8 w-8 rounded-md bg-neutral-100 grid place-items-center shrink-0">
            <Zap className="h-4 w-4 text-neutral-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[14px] font-semibold tracking-tight">
              Run the maintenance engine now
            </h3>
            <p className="text-[12px] text-neutral-500 mt-1 leading-relaxed">
              Normally runs daily at 9am via Vercel Cron. Kicking it manually
              will fire any due reminders right now, create tasks, and
              auto-advance jobs at T-60. Safe to re-run: already-triggered
              reminders are skipped.
            </p>
          </div>
          <RunRemindersButton />
        </div>
      </div>
    </div>
  );
}
