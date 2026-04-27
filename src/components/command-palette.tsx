"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  Briefcase,
  User as UserIcon,
  Smartphone,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { STAGE_LABEL } from "@/lib/job-helpers";
import type { JobStage } from "@/generated/prisma/enums";

type JobItem = {
  id: string;
  jobNumber: string;
  propertyName: string;
  propertyCity: string;
  stage: JobStage;
};

type TechItem = { id: string; name: string };

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, shortcut: "G D" },
  { href: "/pipeline", label: "Pipeline", icon: Kanban, shortcut: "G P" },
  { href: "/map", label: "Map", icon: Map, shortcut: "G M" },
  { href: "/calendar", label: "Calendar", icon: Calendar, shortcut: "G C" },
  { href: "/jobs", label: "Jobs", icon: ListTodo, shortcut: "G J" },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/tasks", label: "Tasks", icon: Inbox },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function CommandPalette({
  jobs,
  techs,
  isAdmin,
}: {
  jobs: JobItem[];
  techs: TechItem[];
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  // ⌘K / Ctrl+K opens the palette; G + key (within 800ms) jumps to nav.
  useEffect(() => {
    let goMode = false;
    let goTimer: ReturnType<typeof setTimeout> | null = null;

    const isTypingContext = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        el.isContentEditable
      );
    };

    const onKey = (e: KeyboardEvent) => {
      // Cmd/Ctrl+K toggles palette.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }

      // "?" shows keyboard shortcuts (just opens palette and filters).
      if (
        e.key === "?" &&
        !(e.metaKey || e.ctrlKey || e.altKey) &&
        !isTypingContext(e.target)
      ) {
        e.preventDefault();
        setOpen(true);
        return;
      }

      // G-prefix navigation: press "g" then a letter (d/p/m/c/j).
      if (isTypingContext(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "g" && !goMode) {
        goMode = true;
        if (goTimer) clearTimeout(goTimer);
        goTimer = setTimeout(() => {
          goMode = false;
        }, 800);
        return;
      }

      if (goMode) {
        const map: Record<string, string> = {
          d: "/dashboard",
          p: "/pipeline",
          m: "/map",
          c: "/calendar",
          j: "/jobs",
          t: isAdmin ? "/tech" : "",
        };
        const dest = map[e.key.toLowerCase()];
        goMode = false;
        if (goTimer) {
          clearTimeout(goTimer);
          goTimer = null;
        }
        if (dest) {
          e.preventDefault();
          router.push(dest);
        }
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (goTimer) clearTimeout(goTimer);
    };
  }, [router, isAdmin]);

  function go(path: string) {
    setOpen(false);
    router.push(path);
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command menu"
      description="Jump to anywhere in CitroTechnician"
    >
      <CommandInput placeholder="Jump to a page, job, or tech..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigate">
          {NAV.map((n) => (
            <CommandItem
              key={n.href}
              value={`nav ${n.label}`}
              onSelect={() => go(n.href)}
            >
              <n.icon className="h-3.5 w-3.5" />
              {n.label}
              {n.shortcut && <CommandShortcut>{n.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
          {isAdmin && (
            <CommandItem value="nav tech" onSelect={() => go("/tech")}>
              <Smartphone className="h-3.5 w-3.5" />
              Tech view
              <CommandShortcut>G T</CommandShortcut>
            </CommandItem>
          )}
        </CommandGroup>

        {jobs.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Jobs">
              {jobs.map((j) => (
                <CommandItem
                  key={j.id}
                  value={`${j.jobNumber} ${j.propertyName} ${j.propertyCity} ${j.stage}`}
                  onSelect={() => go(`/jobs/${j.id}`)}
                >
                  <Briefcase className="h-3.5 w-3.5 text-neutral-400" />
                  <span className="font-mono text-[11px] text-neutral-500 mr-1.5">
                    {j.jobNumber}
                  </span>
                  <span className="truncate">{j.propertyName}</span>
                  <span className="ml-auto text-[10px] text-neutral-400">
                    {STAGE_LABEL[j.stage]}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {techs.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Techs">
              {techs.map((t) => (
                <CommandItem
                  key={t.id}
                  value={`tech ${t.name}`}
                  onSelect={() => go(`/jobs?tech=${t.id}`)}
                >
                  <UserIcon className="h-3.5 w-3.5 text-neutral-400" />
                  {t.name}
                  <span className="ml-auto text-[10px] text-neutral-400">
                    Filter jobs
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
