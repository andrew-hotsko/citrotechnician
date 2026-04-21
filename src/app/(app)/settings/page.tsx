import Link from "next/link";
import { Upload, Users, ListChecks, RefreshCw, ChevronRight } from "lucide-react";

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
    href: "/settings",
    icon: ListChecks,
    title: "Checklist templates",
    description:
      "Edit the per-product checklist every tech sees when they open a job. MFB-31 / MFB-34 / MFB-35-FM.",
    status: "coming soon",
  },
  {
    href: "/settings",
    icon: Users,
    title: "Team",
    description:
      "Promote users to admin / ops manager / tech. Seeded users sync to Supabase auth on first login.",
    status: "coming soon",
  },
  {
    href: "/settings",
    icon: RefreshCw,
    title: "Salesforce sync",
    description:
      "Nightly pull of Closed Won opportunities. Manual sync trigger and sync history.",
    status: "coming soon",
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
    </div>
  );
}
