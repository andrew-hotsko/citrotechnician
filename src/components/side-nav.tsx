"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Kanban,
  Map,
  Calendar,
  ListTodo,
  Building2,
  Users,
  Inbox,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/user-menu";
import { CommandPaletteTrigger } from "@/components/command-palette-trigger";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const nav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/map", label: "Map", icon: Map },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/jobs", label: "Jobs", icon: ListTodo },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/tasks", label: "Tasks", icon: Inbox },
];

export function SideNav({
  user,
}: {
  user: { name: string; email: string; initials: string | null; role: string };
}) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "shrink-0 flex flex-col border-r border-neutral-200 bg-white/80 backdrop-blur",
        // Collapsed on small screens, full on md+. On mobile we show as a top
        // bar via a separate component (MobileNav, below) so we hide this.
        "hidden md:flex w-[220px] h-screen sticky top-0",
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-neutral-100">
        <div
          className="h-7 w-7 rounded-lg grid place-items-center shadow-elev-1"
          style={{ backgroundColor: "#ea580c" }}
        >
          <svg viewBox="0 0 64 64" className="h-4 w-4" aria-hidden>
            <path
              d="M 13 8 H 51 Q 54 8 54 11 V 34 C 54 44 47 53 32 58 C 17 53 10 44 10 34 V 11 Q 10 8 13 8 Z"
              fill="#ffffff"
            />
          </svg>
        </div>
        <div className="leading-tight">
          <div className="text-[14px] font-semibold tracking-tight">
            <span className="text-orange-600">Citro</span>
            <span className="text-neutral-900">Tech</span>
          </div>
          <div className="text-[9px] font-semibold tracking-[0.14em] text-neutral-500 uppercase">
            Technician
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-2.5 px-2.5 h-8 rounded-md text-[13px] font-medium transition-all ease-standard duration-150",
                active
                  ? "bg-neutral-900 text-white shadow-elev-1"
                  : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/70",
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  active ? "text-white" : "text-neutral-500 group-hover:text-neutral-900",
                )}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer: command palette, settings, user */}
      <div className="px-2 py-3 border-t border-neutral-100 space-y-1">
        <div className="px-1 pb-1">
          <CommandPaletteTrigger />
        </div>
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-2.5 px-2.5 h-8 rounded-md text-[13px] font-medium transition-colors",
            pathname.startsWith("/settings")
              ? "bg-neutral-100 text-neutral-900"
              : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/70",
          )}
        >
          <Settings className="h-4 w-4 text-neutral-500" />
          Settings
        </Link>
        {/* User row — Slack/Linear pattern: avatar + name + role,
            whole row is the dropdown trigger via UserMenu. */}
        <div className="mt-2 pt-2 border-t border-neutral-100 flex items-center gap-2 px-1">
          <UserMenu user={user} />
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-medium text-neutral-900 truncate">
              {user.name}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-neutral-500 truncate">
              {user.role.replace("_", " ")}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

/**
 * Compact top bar shown only on small screens. Horizontal scroll for nav,
 * avatar on the right. Preserves one-tap access to every section without
 * the sidebar stealing screen real estate on a phone.
 */
export function MobileNav({
  user,
}: {
  user: { name: string; email: string; initials: string | null; role: string };
}) {
  const pathname = usePathname();

  return (
    <header className="md:hidden sticky top-0 z-40 h-14 border-b border-neutral-200 bg-white/90 backdrop-blur">
      <div className="flex h-full items-center gap-3 px-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 shrink-0"
        >
          <div
            className="h-6 w-6 rounded-md grid place-items-center"
            style={{ backgroundColor: "#ea580c" }}
          >
            <svg viewBox="0 0 64 64" className="h-3.5 w-3.5" aria-hidden>
              <path
                d="M 13 8 H 51 Q 54 8 54 11 V 34 C 54 44 47 53 32 58 C 17 53 10 44 10 34 V 11 Q 10 8 13 8 Z"
                fill="#ffffff"
              />
            </svg>
          </div>
          <span className="text-[13px] font-semibold tracking-tight">
            <span className="text-orange-600">Citro</span>
            <span className="text-neutral-900">Tech</span>
          </span>
        </Link>

        <nav className="flex-1 flex items-center gap-0.5 overflow-x-auto no-scrollbar">
          {nav.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "shrink-0 inline-flex items-center gap-1.5 px-2.5 h-8 rounded-md text-[12px] font-medium transition-all",
                  active
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-600 hover:bg-neutral-100",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            );
          })}
        </nav>

        <UserMenu user={user} />
      </div>
    </header>
  );
}
