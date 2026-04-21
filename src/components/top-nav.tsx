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

export function TopNav({
  user,
}: {
  user: { name: string; email: string; initials: string | null; role: string };
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-neutral-200 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="flex h-full items-center gap-6 px-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          <div
            className="h-6 w-6 rounded-md grid place-items-center text-white text-[11px] font-semibold"
            style={{ backgroundColor: "oklch(0.64 0.19 42)" }}
          >
            C
          </div>
          <span className="text-[13px] font-semibold tracking-tight">
            CitroTech
          </span>
        </Link>

        <nav className="flex items-center gap-0.5">
          {nav.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative flex items-center gap-1.5 px-2.5 h-8 rounded-md text-[13px] font-medium transition-all ease-standard duration-150",
                  active
                    ? "bg-neutral-900 text-white shadow-elev-1"
                    : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/70",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex-1" />

        <CommandPaletteTrigger />

        <Link
          href="/settings"
          className={cn(
            "flex items-center justify-center h-8 w-8 rounded-md transition-colors",
            pathname.startsWith("/settings")
              ? "bg-neutral-100 text-neutral-900"
              : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50",
          )}
          aria-label="Settings"
        >
          <Settings className="h-4 w-4" />
        </Link>

        <UserMenu user={user} />
      </div>
    </header>
  );
}
